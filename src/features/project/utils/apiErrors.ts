/**
 * Project一覧・設定・member管理でFrontendが表示契約を持つerror code集合。
 * Project Template固有codeとTask固有codeは、それぞれの変更単位で別集合へ分離する。
 */
export const PROJECT_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "PROJECT_NOT_FOUND",
  "PROJECT_MEMBER_NOT_FOUND",
  "PROJECT_KEY_CONFLICT",
  "PROJECT_MEMBER_ALREADY_EXISTS",
  "PROJECT_MEMBER_ACCOUNT_UNAVAILABLE",
  "PROJECT_MEMBER_CONFLICT",
  "PROJECT_ARCHIVED",
  "PROJECT_VERSION_CONFLICT",
  "PROJECT_MEMBER_VERSION_CONFLICT",
  "PROJECT_LAST_OWNER",
]);

/** 409回復中に古い競合案内より優先する認証・認可・公開範囲のHTTP status。 */
export const PROJECT_RECOVERY_PRIORITY_STATUSES: ReadonlySet<number> = new Set([
  401,
  403,
  404,
]);
