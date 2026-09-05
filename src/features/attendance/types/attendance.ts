/** 本人勤怠日の打刻状態。 */
export type AttendancePunchState = "OFF_DUTY" | "WORKING" | "ON_BREAK";

/** 月次勤怠の提出・審査・締め状態。 */
export type AttendanceMonthStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

/** 勤務・休憩区間を登録した業務経路。 */
export type AttendanceEntrySource =
  | "SELF_PUNCH"
  | "ADMIN_CORRECTION"
  | "IMPORT";

/** 本人勤怠日に属する1休憩区間。 */
export interface AttendanceBreakPeriod {
  attendanceBreakPeriodId: number;
  startedAt: string;
  endedAt: string | null;
  entrySource: AttendanceEntrySource;
}

/** 本人勤怠日に属する1勤務区間と、その区間内の休憩。 */
export interface AttendanceWorkPeriod {
  attendanceWorkPeriodId: number;
  startedAt: string;
  endedAt: string | null;
  entrySource: AttendanceEntrySource;
  breakPeriods: AttendanceBreakPeriod[];
}

/** 本人の指定勤務日の打刻状態と全勤務・休憩区間。 */
export interface AttendanceDayResponse {
  attendanceDayId: number | null;
  workDate: string;
  note: string | null;
  punchState: AttendancePunchState;
  workPeriods: AttendanceWorkPeriod[];
}

/** 本人の指定期間に登録済みの勤怠日一覧。 */
export interface AttendanceDayListResponse {
  dateFrom: string;
  dateTo: string;
  days: AttendanceDayResponse[];
}

/** 本人または管理者が参照する月次workflow状態、集計値、日別明細。 */
export interface AttendanceMonthResponse {
  attendanceMonthId: number | null;
  accountId: number;
  yearMonth: string;
  statusCode: AttendanceMonthStatus;
  submittedBy: number | null;
  submittedAt: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  closedBy: number | null;
  closedAt: string | null;
  grossWorkMinutes: number;
  breakMinutes: number;
  netWorkMinutes: number;
  hasIncompletePeriod: boolean;
  version: number;
  days: AttendanceDayResponse[];
}

/** 管理者向け月次確認一覧の1アカウント分。 */
export interface AttendanceMonthListItem {
  attendanceMonthId: number;
  accountId: number;
  loginId: string | null;
  displayName: string;
  yearMonth: string;
  statusCode: AttendanceMonthStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  closedAt: string | null;
  version: number;
}

/** 管理者向け月次確認一覧と検索対象月。 */
export interface AttendanceMonthListResponse {
  yearMonth: string;
  months: AttendanceMonthListItem[];
}

/** yyyy-MMから解決した月初日と月末日。 */
export interface AttendanceMonthDateRange {
  dateFrom: string;
  dateTo: string;
}

/** 1勤怠日の勤務・休憩・差引時間と未完了区間の有無。 */
export interface AttendanceDaySummary {
  grossWorkMinutes: number;
  breakMinutes: number;
  netWorkMinutes: number;
  incomplete: boolean;
}

/** 月一覧へ表示する日付と、登録済み勤怠から算出した集計値。 */
export interface AttendanceMonthRow extends AttendanceDaySummary {
  workDate: string;
  attendanceDayId: number | null;
  punchState: AttendancePunchState;
  hasRecord: boolean;
}

/** 本人打刻APIで許可する操作。 */
export type AttendancePunchAction =
  | "clock-in"
  | "clock-out"
  | "break-start"
  | "break-end";
