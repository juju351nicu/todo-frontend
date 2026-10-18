/**
 * Time Tracking APIでFrontendが表示契約を持つerror code。
 * 未知codeはBackend本文を表示せず、呼出元の固定fallbackへ変換する。
 */
export const TIME_TRACKING_ERROR_CODE = {
  invalidRequest: "INVALID_TASK_TIMER_REQUEST",
  projectNotFound: "PROJECT_NOT_FOUND",
  taskNotFound: "TASK_NOT_FOUND",
  projectArchived: "PROJECT_ARCHIVED",
  taskArchived: "TASK_ARCHIVED",
  timerAlreadyRunning: "TASK_TIMER_ALREADY_RUNNING",
  timerNotRunning: "TASK_TIMER_NOT_RUNNING",
  timerVersionConflict: "TASK_TIMER_VERSION_CONFLICT",
  timerDurationExceeded: "TASK_TIMER_DURATION_EXCEEDED",
  timerDailyLimitExceeded: "TASK_TIMER_DAILY_LIMIT_EXCEEDED",
  timerConflict: "TASK_TIMER_CONFLICT",
} as const;

/** Backend本文の表示を許可するTime Tracking error code集合。 */
export const TIME_TRACKING_ERROR_CODES: ReadonlySet<string> = new Set(
  Object.values(TIME_TRACKING_ERROR_CODE)
);
