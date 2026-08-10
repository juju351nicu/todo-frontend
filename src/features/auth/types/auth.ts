/** ローカルログインAPIへ送信する情報。 */
export interface LoginRequest {
  loginId: string;
  password: string;
}

/** Backendで定義している初期ロールコード。 */
export type RoleCode = "SYSTEM_ADMIN" | "READ_ONLY_ADMIN" | "USER";

/** Session確認APIが返す認証済み利用者。 */
export interface SessionUserResponse {
  accountId: number;
  username: string;
  displayName: string | null;
  roleCodes: RoleCode[];
  permissionCodes: string[];
}
