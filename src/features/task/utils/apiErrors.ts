/** Board／Task coreがBackendと表示契約を持つerror code集合。 */
export const TASK_BOARD_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "PROJECT_ARCHIVED",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "TASK_STATUS_NOT_FOUND",
  "ASSIGNEE_NOT_PROJECT_MEMBER",
  "INVALID_TASK_SCHEDULE",
  "ASSIGNEE_ID_OUT_OF_RANGE",
  "TASK_ARCHIVED",
  "TASK_VERSION_CONFLICT",
  "TASK_POSITION_CONFLICT",
]);

/** TaskコメントがBackendと表示契約を持つerror code集合。 */
export const TASK_COMMENT_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "PROJECT_ARCHIVED",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "TASK_COMMENT_NOT_FOUND",
  "TASK_COMMENT_VERSION_CONFLICT",
]);

/** Task checklistがBackendと表示契約を持つerror code集合。 */
export const TASK_CHECKLIST_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "INVALID_TASK_CHECKLIST_ITEM",
  "INVALID_CHECKLIST_ORDER",
  "PROJECT_ARCHIVED",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "TASK_CHECKLIST_ITEM_NOT_FOUND",
  "TASK_ARCHIVED",
  "CHECKLIST_LIMIT_EXCEEDED",
  "CHECKLIST_VERSION_CONFLICT",
]);

/** 競合回復中に古い409より優先する認証・認可・公開範囲のHTTP status。 */
export const TASK_RECOVERY_PRIORITY_STATUSES: ReadonlySet<number> = new Set([
  401, 403, 404,
]);
