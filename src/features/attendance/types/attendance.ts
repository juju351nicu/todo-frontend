/** 本人勤怠日の打刻状態。 */
export type AttendancePunchState = "OFF_DUTY" | "WORKING" | "ON_BREAK";

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
