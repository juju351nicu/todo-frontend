import type {
  WorkingCalendarDateRange,
  WorkingCalendarDay,
  WorkingCalendarTarget,
  WorkingDayCreateRequest,
  WorkingDayForm,
  WorkingDayOverride,
  WorkingDaySource,
  WorkingDayType,
  WorkingDayUpdateRequest,
} from "@/features/wbs/types/wbs";
import { isValidIsoLocalDate } from "@/features/wbs/utils/effort";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_CALENDAR_DAYS = 366;
const PROJECT_TARGET_KEY = "PROJECT";
const MEMBER_TARGET_PREFIX = "MEMBER:";

/** yyyy-MM-ddをUTC日付へ変換する。呼出元で実在日検証済みの値だけを渡す。 */
const parseIsoLocalDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** date inputへ渡す日付をブラウザーのローカル年月から組み立てる。 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** 初期calendar検索期間としてブラウザー現在月の初日・末日を返す。 */
export const buildDefaultWorkingCalendarDateRange =
  (): WorkingCalendarDateRange => {
    const now = new Date();
    return {
      dateFrom: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: formatLocalDate(
        new Date(now.getFullYear(), now.getMonth() + 1, 0)
      ),
    };
  };

/** Project共通またはmember固有の対象をselectへ保存できる一意な文字列へ変換する。 */
export const buildWorkingCalendarTargetKey = (
  target: Readonly<WorkingCalendarTarget>
): string =>
  target.kind === "PROJECT"
    ? PROJECT_TARGET_KEY
    : `${MEMBER_TARGET_PREFIX}${target.accountId}`;

/** select値を検証し、API queryと認可判定で使うcalendar対象へ復元する。 */
export const parseWorkingCalendarTargetKey = (
  targetKey: string
): WorkingCalendarTarget | null => {
  if (targetKey === PROJECT_TARGET_KEY) {
    return { kind: "PROJECT", accountId: null };
  }
  if (!targetKey.startsWith(MEMBER_TARGET_PREFIX)) {
    return null;
  }
  const accountId = Number(targetKey.slice(MEMBER_TARGET_PREFIX.length));
  return Number.isSafeInteger(accountId) && accountId > 0
    ? { kind: "MEMBER", accountId }
    : null;
};

/** calendar検索期間をBackendと同じ境界を含む最大366日で検証する。 */
export const validateWorkingCalendarDateRange = (
  dateRange: Readonly<WorkingCalendarDateRange>
): string[] => {
  const messages: string[] = [];
  if (!isValidIsoLocalDate(dateRange.dateFrom)) {
    messages.push("calendar開始日を入力してください。");
  }
  if (!isValidIsoLocalDate(dateRange.dateTo)) {
    messages.push("calendar終了日を入力してください。");
  }
  if (messages.length > 0) {
    return messages;
  }
  const dateFrom = parseIsoLocalDate(dateRange.dateFrom);
  const dateTo = parseIsoLocalDate(dateRange.dateTo);
  if (dateTo.getTime() < dateFrom.getTime()) {
    return ["calendar終了日は開始日以降にしてください。"];
  }
  const inclusiveDays =
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / MILLIS_PER_DAY) + 1;
  return inclusiveDays > MAX_CALENDAR_DAYS
    ? ["calendarの検索期間は366日以内にしてください。"]
    : [];
};

/** 選択中のProject共通・member固有階層に保存された例外だけを取り出す。 */
export const getWorkingDayOverride = (
  day: Readonly<WorkingCalendarDay>,
  target: Readonly<WorkingCalendarTarget>
): WorkingDayOverride | null =>
  target.kind === "PROJECT" ? day.projectOverride : day.memberOverride;

/** 有効値または選択階層の保存済み例外から独立した編集Formを作る。 */
export const buildWorkingDayForm = (
  day: Readonly<WorkingCalendarDay>,
  target: Readonly<WorkingCalendarTarget>
): WorkingDayForm => {
  const override = getWorkingDayOverride(day, target);
  return {
    workDate: override?.workDate ?? day.workDate,
    dayType: override?.dayType ?? day.dayType,
    availableMinutes:
      override?.availableMinutes ?? day.availableMinutes,
  };
};

/** 稼働日例外フォームをBackendと同じ種別・分数制約で検証する。 */
export const validateWorkingDayForm = (
  form: Readonly<WorkingDayForm>
): string[] => {
  const messages: string[] = [];
  if (!isValidIsoLocalDate(form.workDate)) {
    messages.push("設定日を入力してください。");
  }
  if (form.dayType !== "WORKING_DAY" && form.dayType !== "HOLIDAY") {
    messages.push("稼働日種別を選択してください。");
  }
  if (
    form.availableMinutes === null ||
    !Number.isSafeInteger(form.availableMinutes)
  ) {
    messages.push("稼働可能時間を整数で入力してください。");
    return messages;
  }
  if (
    form.dayType === "WORKING_DAY" &&
    (form.availableMinutes < 1 || form.availableMinutes > 1440)
  ) {
    messages.push(
      "稼働日の稼働可能時間は1分以上1440分以下で入力してください。"
    );
  }
  if (form.dayType === "HOLIDAY" && form.availableMinutes !== 0) {
    messages.push("休日の稼働可能時間は0分にしてください。");
  }
  return messages;
};

/** 検証済みFormを稼働日例外登録Requestへ変換する。 */
export const buildWorkingDayCreateRequest = (
  form: Readonly<WorkingDayForm>
): WorkingDayCreateRequest => ({
  workDate: form.workDate,
  dayType: form.dayType,
  availableMinutes: form.availableMinutes as number,
});

/** 検証済みFormと取得時点versionを稼働日例外更新Requestへ変換する。 */
export const buildWorkingDayUpdateRequest = (
  form: Readonly<WorkingDayForm>,
  version: number
): WorkingDayUpdateRequest => ({
  ...buildWorkingDayCreateRequest(form),
  version,
});

/** Backendの稼働日種別コードを画面表示名へ変換する。 */
export const getWorkingDayTypeLabel = (dayType: WorkingDayType): string =>
  dayType === "WORKING_DAY" ? "稼働日" : "休日";

/** Backendの有効値設定元コードを画面表示名へ変換する。 */
export const getWorkingDaySourceLabel = (
  source: WorkingDaySource
): string => {
  if (source === "MEMBER") {
    return "個人例外";
  }
  return source === "PROJECT" ? "Project共通" : "曜日既定値";
};
