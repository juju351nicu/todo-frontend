/** ローカルログインAPIへ送信する情報。 */
export interface LoginRequest {
  loginId: string;
  password: string;
}

/** Backendで定義している初期ロールコード。 */
export type RoleCode = "SYSTEM_ADMIN" | "READ_ONLY_ADMIN" | "USER";

/** Backendの認可テーブルで管理するpermissionコード。 */
export type PermissionCode =
  | "ACCOUNT_READ"
  | "ACCOUNT_UPDATE"
  | "ACCOUNT_ROLE_UPDATE"
  | "AUTHORIZATION_AUDIT_READ"
  | "TASK_READ_ALL"
  | "TASK_WRITE_ALL"
  | "TASK_READ_OWN"
  | "TASK_WRITE_OWN";

/** Todo一覧・詳細・カレンダーのいずれかを参照できるpermission。 */
export const TASK_READ_PERMISSION_CODES = [
  "TASK_READ_ALL",
  "TASK_READ_OWN",
] as const satisfies readonly PermissionCode[];

/** Todo登録・更新・完了・カレンダー移動のいずれかを実行できるpermission。 */
export const TASK_WRITE_PERMISSION_CODES = [
  "TASK_WRITE_ALL",
  "TASK_WRITE_OWN",
] as const satisfies readonly PermissionCode[];

/**
 * Session確認APIが返す認証済み利用者。
 *
 * `permissionCodes`は画面表示とRouterの事前案内に使用する。最終的な認可は必ずBackendが行う。
 */
export interface SessionUserResponse {
  accountId: number;
  username: string;
  displayName: string | null;
  roleCodes: RoleCode[];
  permissionCodes: PermissionCode[];
}
