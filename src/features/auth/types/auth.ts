/** ローカルログインAPIへ送信する情報。 */
export interface LoginRequest {
  loginId: string;
  password: string;
}

/** Backendで定義している初期ロールコード。 */
export type RoleCode =
  | "SYSTEM_ADMIN"
  | "READ_ONLY_ADMIN"
  | "ATTENDANCE_MANAGER"
  | "USER";

/** Backendの認可テーブルで管理するpermissionコード。 */
export type PermissionCode =
  | "ACCOUNT_READ"
  | "ACCOUNT_UPDATE"
  | "ACCOUNT_ROLE_UPDATE"
  | "AUTHORIZATION_AUDIT_READ"
  | "PROJECT_READ"
  | "PROJECT_CREATE"
  | "PROJECT_UPDATE"
  | "PROJECT_MEMBER_UPDATE"
  | "TASK_READ"
  | "TASK_CREATE"
  | "TASK_UPDATE"
  | "TASK_ARCHIVE"
  | "TASK_MOVE"
  | "TASK_READ_ALL"
  | "TASK_WRITE_ALL"
  | "TASK_READ_OWN"
  | "TASK_WRITE_OWN"
  | "ATTENDANCE_READ_OWN"
  | "ATTENDANCE_WRITE_OWN"
  | "ATTENDANCE_READ_ALL"
  | "ATTENDANCE_REVIEW"
  | "ATTENDANCE_CLOSE"
  | "ATTENDANCE_EXPORT"
  | "ATTENDANCE_AUDIT_READ";

/** 本人勤怠の日・月表示に必要なpermission。 */
export const ATTENDANCE_READ_PERMISSION_CODES = [
  "ATTENDANCE_READ_OWN",
] as const satisfies readonly PermissionCode[];

/** 本人の出退勤・休憩打刻に必要なpermission。 */
export const ATTENDANCE_WRITE_PERMISSION_CODES = [
  "ATTENDANCE_WRITE_OWN",
] as const satisfies readonly PermissionCode[];

/** 管理者向け勤怠月一覧・詳細画面の参照に必要なpermission。 */
export const ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES = [
  "ATTENDANCE_READ_ALL",
] as const satisfies readonly PermissionCode[];

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
