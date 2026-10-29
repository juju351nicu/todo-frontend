import type { ErrorResponse } from "@/shared/types/error";
/**
 * Attendance APIでFrontendが表示契約を持つerror code集合。
 * 未知codeはBackend本文を表示せず、本人・管理・CSV操作ごとの固定fallbackへ変換する。
 */
export const ATTENDANCE_ERROR_CODES: ReadonlySet<string> = new Set([
  "ATTENDANCE_ACCOUNT_NOT_FOUND",
  "ATTENDANCE_ALREADY_CLOCKED_IN",
  "ATTENDANCE_BREAK_ACTIVE",
  "ATTENDANCE_BREAK_ALREADY_STARTED",
  "ATTENDANCE_BREAK_NOT_STARTED",
  "ATTENDANCE_CORRECTION_BASE_CONFLICT",
  "ATTENDANCE_CORRECTION_CONFLICT",
  "ATTENDANCE_CORRECTION_EMPTY",
  "ATTENDANCE_CORRECTION_MONTH_STATE_CONFLICT",
  "ATTENDANCE_CORRECTION_NOT_FOUND",
  "ATTENDANCE_CORRECTION_PENDING_EXISTS",
  "ATTENDANCE_CORRECTION_PERIODS_REQUIRED",
  "ATTENDANCE_CORRECTION_PERIOD_INVALID",
  "ATTENDANCE_CORRECTION_REASON_REQUIRED",
  "ATTENDANCE_CORRECTION_STATE_CONFLICT",
  "ATTENDANCE_CORRECTION_VERSION_CONFLICT",
  "ATTENDANCE_DATA_INCONSISTENT",
  "ATTENDANCE_DATE_RANGE_INVALID",
  "ATTENDANCE_DATE_RANGE_REQUIRED",
  "ATTENDANCE_DATE_RANGE_TOO_LONG",
  "ATTENDANCE_EXPORT_GENERATION_FAILED",
  "ATTENDANCE_EXPORT_ROW_LIMIT_EXCEEDED",
  "ATTENDANCE_MONTH_CONFLICT",
  "ATTENDANCE_MONTH_INCOMPLETE",
  "ATTENDANCE_MONTH_LOCKED",
  "ATTENDANCE_MONTH_NOT_FOUND",
  "ATTENDANCE_MONTH_STATE_CONFLICT",
  "ATTENDANCE_MONTH_VERSION_CONFLICT",
  "ATTENDANCE_NOT_CLOCKED_IN",
  "ATTENDANCE_PUNCH_CONFLICT",
  "ATTENDANCE_REJECTION_REASON_REQUIRED",
  "ATTENDANCE_TIMESTAMP_CONFLICT",
  "ATTENDANCE_VERSION_CONFLICT",
  "ATTENDANCE_VERSION_REQUIRED",
  "ATTENDANCE_WORK_DATE_REQUIRED",
  "ATTENDANCE_YEAR_MONTH_REQUIRED",
]);

/** 409回復中に古い競合案内より優先する認証・認可・公開範囲のHTTP status。 */
export {
  API_RECOVERY_PRIORITY_STATUSES as ATTENDANCE_RECOVERY_PRIORITY_STATUSES,
} from "@/shared/utils/apiError";

/**
 * Backendの文言が「最新状態を読み直してください。」「最新状態から申請し直してください。」となる409のerror code
 * （`messages.properties`の`error.attendance.conflict.version`・`punch`・`month-version`・`month-persistence`・
 * `correction-version`・`correction-persistence`・`correction-base`）。
 * 本人勤怠・勤怠管理の画面は409の後に必ず取り直すため、取り直せたときだけ取り直し済みの案内を添える
 * （Project設定・WBSの409と同じ書き方）。月の状態・打刻の順序等の409は取り直しても同じなので添えない。
 */
export const ATTENDANCE_RELOAD_GUIDANCE_ERROR_CODES: ReadonlySet<string> = new Set([
  "ATTENDANCE_VERSION_CONFLICT",
  "ATTENDANCE_PUNCH_CONFLICT",
  "ATTENDANCE_MONTH_VERSION_CONFLICT",
  "ATTENDANCE_MONTH_CONFLICT",
  "ATTENDANCE_CORRECTION_VERSION_CONFLICT",
  "ATTENDANCE_CORRECTION_CONFLICT",
  "ATTENDANCE_CORRECTION_BASE_CONFLICT",
]);

/**
 * 409のResponseに、取り直し済みの案内を添えるerror codeが含まれるか。
 *
 * @param errorResponse 勤怠APIの409が持つBackend共通エラー
 * @returns `ATTENDANCE_RELOAD_GUIDANCE_ERROR_CODES`のcodeがあればtrue
 */
export const needsAttendanceReloadGuidance = (
  errorResponse: ErrorResponse | null
): boolean =>
  Array.isArray(errorResponse?.fieldErrors) &&
  errorResponse.fieldErrors.some(
    (fieldError) =>
      typeof fieldError?.errorCode === "string" &&
      ATTENDANCE_RELOAD_GUIDANCE_ERROR_CODES.has(fieldError.errorCode)
  );
