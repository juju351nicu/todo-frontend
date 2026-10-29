/** Account管理APIがBackendと表示契約を持つerror code集合。 */
export const ACCOUNT_ADMINISTRATION_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "INVALID_ROLE_ASSIGNMENT",
  "ACCOUNT_NOT_FOUND",
  "AUTHORIZATION_CONFLICT",
]);

/** 認可監査APIがBackendと表示契約を持つerror code集合。 */
export const AUTHORIZATION_AUDIT_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_PARAMETER",
]);

/** 404／409回復中に元の操作エラーより優先する現在の参照状態。 */
export { API_RECOVERY_PRIORITY_STATUSES as ADMINISTRATION_RECOVERY_PRIORITY_STATUSES } from "@/shared/utils/apiError";
