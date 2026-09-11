import type {
  AttendanceCorrectionCreateRequest,
  AttendanceCorrectionForm,
  AttendanceCorrectionStatus,
  AttendanceDayResponse,
} from "@/features/attendance/types/attendance";

const TOKYO_OFFSET = "+09:00";
const MAX_PERIOD_COUNT = 20;
const MAX_TEXT_LENGTH = 1000;

/** 勤怠修正申請状態を画面表示用の日本語へ変換する。 */
export const getAttendanceCorrectionStatusLabel = (
  status: AttendanceCorrectionStatus
): string =>
  ({
    PENDING: "審査待ち",
    APPROVED: "承認済み",
    REJECTED: "却下",
    CANCELLED: "取消済み",
  })[status];

/** 勤怠修正申請状態に対応するVuetify colorを返す。 */
export const getAttendanceCorrectionStatusColor = (
  status: AttendanceCorrectionStatus
): string =>
  ({
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "error",
    CANCELLED: "default",
  })[status];

/** APIのInstantを東京時刻のdatetime-local入力値へ変換する。 */
export const toTokyoDateTimeInput = (instant: string): string => {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const tokyoDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return tokyoDate.toISOString().slice(0, 19);
};

/** 東京時刻のdatetime-local入力値をBackendへ送るoffset付きISO文字列へ変換する。 */
export const toTokyoOffsetDateTime = (input: string): string => {
  // datetime-localは利用者が値を変更すると秒を省略するため、Instantが解釈できる形式へ揃える。
  const normalizedInput = input.length === 16 ? `${input}:00` : input;
  return `${normalizedInput}${TOKYO_OFFSET}`;
};

/** 現在の勤怠日を全置換用の修正申請フォーム初期値へ変換する。 */
export const buildAttendanceCorrectionForm = (
  day: AttendanceDayResponse
): AttendanceCorrectionForm => ({
  note: day.note ?? "",
  reason: "",
  workPeriods: day.workPeriods.map((workPeriod) => ({
    startedAt: toTokyoDateTimeInput(workPeriod.startedAt),
    endedAt: workPeriod.endedAt
      ? toTokyoDateTimeInput(workPeriod.endedAt)
      : "",
    breakPeriods: workPeriod.breakPeriods.map((breakPeriod) => ({
      startedAt: toTokyoDateTimeInput(breakPeriod.startedAt),
      endedAt: breakPeriod.endedAt
        ? toTokyoDateTimeInput(breakPeriod.endedAt)
        : "",
    })),
  })),
});

/** 検証済み画面入力を勤怠日version付きのBackend Requestへ変換する。 */
export const buildAttendanceCorrectionRequest = (
  day: AttendanceDayResponse,
  form: AttendanceCorrectionForm
): AttendanceCorrectionCreateRequest => ({
  baseDayVersion: day.version,
  note: form.note.trim() || null,
  reason: form.reason.trim(),
  workPeriods: form.workPeriods.map((workPeriod) => ({
    startedAt: toTokyoOffsetDateTime(workPeriod.startedAt),
    endedAt: toTokyoOffsetDateTime(workPeriod.endedAt),
    breakPeriods: workPeriod.breakPeriods.map((breakPeriod) => ({
      startedAt: toTokyoOffsetDateTime(breakPeriod.startedAt),
      endedAt: toTokyoOffsetDateTime(breakPeriod.endedAt),
    })),
  })),
});

/** 1勤務日全体の修正入力をBackend送信前に検査し、利用者向け理由を返す。 */
export const validateAttendanceCorrectionForm = (
  workDate: string,
  form: AttendanceCorrectionForm
): string[] => {
  const errors: string[] = [];
  if (!form.reason.trim()) {
    errors.push("修正理由を入力してください。");
  } else if (form.reason.trim().length > MAX_TEXT_LENGTH) {
    errors.push("修正理由は1000文字以内で入力してください。");
  }
  if (form.note.length > MAX_TEXT_LENGTH) {
    errors.push("メモは1000文字以内で入力してください。");
  }
  if (form.workPeriods.length > MAX_PERIOD_COUNT) {
    errors.push("勤務区間は20件以内で入力してください。");
  }

  const workRanges: Array<{ start: number; end: number }> = [];
  form.workPeriods.forEach((workPeriod, workIndex) => {
    const range = parseRange(
      workPeriod.startedAt,
      workPeriod.endedAt,
      workDate,
      `勤務区間${workIndex + 1}`,
      errors,
      true
    );
    if (range !== null) {
      workRanges.push(range);
    }
    if (workPeriod.breakPeriods.length > MAX_PERIOD_COUNT) {
      errors.push(`勤務区間${workIndex + 1}の休憩は20件以内で入力してください。`);
    }
    const breakRanges: Array<{ start: number; end: number }> = [];
    workPeriod.breakPeriods.forEach((breakPeriod, breakIndex) => {
      const breakRange = parseRange(
        breakPeriod.startedAt,
        breakPeriod.endedAt,
        workDate,
        `勤務区間${workIndex + 1}の休憩${breakIndex + 1}`,
        errors,
        false
      );
      if (breakRange !== null) {
        breakRanges.push(breakRange);
        if (
          range !== null &&
          (breakRange.start < range.start || breakRange.end > range.end)
        ) {
          errors.push(`勤務区間${workIndex + 1}の休憩${breakIndex + 1}は勤務時間内にしてください。`);
        }
      }
    });
    validateOverlap(breakRanges, `勤務区間${workIndex + 1}の休憩`, errors);
  });
  validateOverlap(workRanges, "勤務区間", errors);
  return errors;
};

/** 必須日時、勤務日、開始終了順を検査し比較可能なepoch範囲へ変換する。 */
const parseRange = (
  startedAt: string,
  endedAt: string,
  workDate: string,
  label: string,
  errors: string[],
  requireStartOnWorkDate: boolean
): { start: number; end: number } | null => {
  if (!startedAt || !endedAt) {
    errors.push(`${label}の開始・終了時刻を入力してください。`);
    return null;
  }
  if (requireStartOnWorkDate && !startedAt.startsWith(workDate)) {
    // 日跨ぎ勤務は許可するが、どの勤務日に属するかは開始日の東京日付で一意にする。
    errors.push(`${label}の開始日時は選択した勤務日に合わせてください。`);
    return null;
  }
  const start = new Date(toTokyoOffsetDateTime(startedAt)).getTime();
  const end = new Date(toTokyoOffsetDateTime(endedAt)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    errors.push(`${label}の終了時刻は開始時刻より後にしてください。`);
    return null;
  }
  return { start, end };
};

/** 同種区間を開始順で比較し、境界接触を許可しつつ重複だけを検出する。 */
const validateOverlap = (
  ranges: Array<{ start: number; end: number }>,
  label: string,
  errors: string[]
): void => {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) {
      errors.push(`${label}が重複しています。`);
      return;
    }
  }
};
