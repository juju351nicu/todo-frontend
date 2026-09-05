import type {
  AttendanceDayResponse,
  AttendanceDaySummary,
  AttendanceMonthDateRange,
  AttendanceMonthRow,
  AttendanceMonthStatus,
  AttendancePunchState,
} from "@/features/attendance/types/attendance";

const ISO_YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MILLISECONDS_PER_MINUTE = 60_000;
const TOKYO_TIME_ZONE = "Asia/Tokyo";

/**
 * 指定時刻をAsia/Tokyoの業務日へ変換する。
 *
 * @param now 変換対象時刻。省略時はブラウザー現在時刻
 * @returns yyyy-MM-dd形式の東京日付
 */
export const getTodayInTokyo = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
};

/**
 * yyyy-MM形式の表示月を境界を含む月初日・月末日へ変換する。
 *
 * @param yearMonth 表示月
 * @returns 本人勤怠一覧APIへ渡す日付範囲
 * @throws Error yyyy-MM形式でないか実在しない月の場合
 */
export const buildAttendanceMonthDateRange = (
  yearMonth: string
): AttendanceMonthDateRange => {
  const match = yearMonth.match(ISO_YEAR_MONTH_PATTERN);
  if (!match) {
    throw new Error("表示月はyyyy-MM形式で指定してください。");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || month < 1 || month > 12) {
    throw new Error("実在する表示月を指定してください。");
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: `${yearMonth}-01`,
    dateTo: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
};

/**
 * 勤怠日内の完了区間を分単位で合計する。
 * 未終了または不正な区間は合計へ含めず、画面へ「集計中」と示すためincompleteをtrueにする。
 *
 * @param day 集計する本人勤怠日
 * @returns 総勤務・休憩・差引勤務時間と未完了区間の有無
 */
export const summarizeAttendanceDay = (
  day: AttendanceDayResponse | null
): AttendanceDaySummary => {
  let grossWorkMinutes = 0;
  let breakMinutes = 0;
  let incomplete = false;

  for (const workPeriod of day?.workPeriods ?? []) {
    const workDuration = calculateCompletedMinutes(
      workPeriod.startedAt,
      workPeriod.endedAt
    );
    if (workDuration === null) {
      incomplete = true;
    } else {
      grossWorkMinutes += workDuration;
    }
    for (const breakPeriod of workPeriod.breakPeriods ?? []) {
      const breakDuration = calculateCompletedMinutes(
        breakPeriod.startedAt,
        breakPeriod.endedAt
      );
      if (breakDuration === null) {
        incomplete = true;
      } else {
        breakMinutes += breakDuration;
      }
    }
  }

  return {
    grossWorkMinutes,
    breakMinutes,
    netWorkMinutes: Math.max(0, grossWorkMinutes - breakMinutes),
    incomplete,
  };
};

/**
 * 表示月の全日付へ、APIが返した登録済み勤怠日の集計値を結合する。
 * APIが返さない未打刻日もOFF_DUTYの行として表示できる。
 *
 * @param yearMonth yyyy-MM形式の表示月
 * @param days 登録済み本人勤怠日
 * @returns 月初から月末までの日付順表示行
 */
export const buildAttendanceMonthRows = (
  yearMonth: string,
  days: AttendanceDayResponse[]
): AttendanceMonthRow[] => {
  const { dateFrom, dateTo } = buildAttendanceMonthDateRange(yearMonth);
  const daysByDate = new Map(days.map((day) => [day.workDate, day]));
  const first = new Date(`${dateFrom}T00:00:00Z`);
  const last = new Date(`${dateTo}T00:00:00Z`);
  const rows: AttendanceMonthRow[] = [];

  for (let cursor = first; cursor <= last; cursor = addUtcDays(cursor, 1)) {
    const workDate = cursor.toISOString().slice(0, 10);
    const day = daysByDate.get(workDate) ?? null;
    rows.push({
      workDate,
      attendanceDayId: day?.attendanceDayId ?? null,
      punchState: day?.punchState ?? "OFF_DUTY",
      hasRecord: day !== null,
      ...summarizeAttendanceDay(day),
    });
  }
  return rows;
};

/** 勤怠状態を本人画面の日本語表示へ変換する。 */
export const getAttendancePunchStateLabel = (
  state: AttendancePunchState
): string =>
  ({ OFF_DUTY: "退勤中", WORKING: "勤務中", ON_BREAK: "休憩中" })[state];

/** 勤怠状態をVuetify chip色へ変換する。 */
export const getAttendancePunchStateColor = (
  state: AttendancePunchState
): string =>
  ({ OFF_DUTY: "default", WORKING: "success", ON_BREAK: "warning" })[state];

/** 月次workflow状態を本人・管理画面共通の日本語へ変換する。 */
export const getAttendanceMonthStatusLabel = (
  status: AttendanceMonthStatus
): string =>
  ({
    DRAFT: "下書き",
    SUBMITTED: "提出済み",
    APPROVED: "承認済み",
    REJECTED: "差戻し",
    CLOSED: "締め済み",
  })[status];

/** 月次workflow状態をVuetify chip色へ変換する。 */
export const getAttendanceMonthStatusColor = (
  status: AttendanceMonthStatus
): string =>
  ({
    DRAFT: "default",
    SUBMITTED: "info",
    APPROVED: "success",
    REJECTED: "warning",
    CLOSED: "secondary",
  })[status];

/** APIのISO時刻をAsia/Tokyoの年月日時分へ変換する。 */
export const formatAttendanceInstant = (instant: string | null): string => {
  if (instant === null) {
    return "—";
  }
  const date = new Date(instant);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ja-JP", {
        timeZone: TOKYO_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
};

/** yyyy-MM-dd形式の日付を曜日付き日本語へ変換する。 */
export const formatAttendanceDate = (workDate: string): string => {
  const date = new Date(`${workDate}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? workDate
    : new Intl.DateTimeFormat("ja-JP", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(date);
};

/** UTC ISO時刻を日付跨ぎが分かるAsia/Tokyoの月日・時分へ変換する。 */
export const formatAttendanceTime = (instant: string | null): string => {
  if (instant === null) {
    return "未記録";
  }
  const date = new Date(instant);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ja-JP", {
        timeZone: TOKYO_TIME_ZONE,
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
};

/** 分単位の勤怠時間を0分・分・時間・時間分へ整形する。 */
export const formatAttendanceMinutes = (minutes: number): string => {
  const normalized = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const hours = Math.floor(normalized / 60);
  const remainingMinutes = normalized % 60;
  if (hours === 0) {
    return `${remainingMinutes}分`;
  }
  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
};

/** 開始・終了時刻が確定した区間を切り捨て分数へ変換する。 */
const calculateCompletedMinutes = (
  startedAt: string,
  endedAt: string | null
): number | null => {
  if (endedAt === null) {
    return null;
  }
  const startedMillis = Date.parse(startedAt);
  const endedMillis = Date.parse(endedAt);
  if (
    !Number.isFinite(startedMillis) ||
    !Number.isFinite(endedMillis) ||
    endedMillis <= startedMillis
  ) {
    return null;
  }
  return Math.floor((endedMillis - startedMillis) / MILLISECONDS_PER_MINUTE);
};

/** UTC日付へ指定日数を加算し、月の日付列挙でlocal timezone差を持ち込まない。 */
const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
