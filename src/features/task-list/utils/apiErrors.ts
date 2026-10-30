/** Task一覧API（`/api/v1/task-list/*`）が共通Validation handlerから返すerror code。 */
export const TASK_LIST_ERROR_CODES: ReadonlySet<string> = new Set(["INVALID_REQUEST_BODY"]);
