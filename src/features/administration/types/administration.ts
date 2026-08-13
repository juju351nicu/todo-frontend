/** Backendが返すアカウントの利用状態コード。 */
export type AccountStatus = "ACTIVE" | "LOCKED" | "DISABLED";

/**
 * 権限管理APIが返すアカウントと現在ロールの情報。
 * `version`はロール更新時の楽観ロック値として、そのままBackendへ返す。
 */
export interface AccountAuthorization {
  accountId: number;
  displayName: string;
  email: string | null;
  status: AccountStatus;
  roleCodes: string[];
  version: number;
}

/** アカウント権限一覧APIのResponseルート。 */
export interface AccountAuthorizationListResponse {
  accounts: AccountAuthorization[];
}

/** 権限管理画面で選択できるBackendロール。 */
export interface AdministrationRole {
  roleCode: string;
  roleName: string;
  systemRole: boolean;
  version: number;
}

/** ロール一覧APIのResponseルート。 */
export interface RoleListResponse {
  roles: AdministrationRole[];
}

/**
 * アカウントのロール集合を置き換えるRequest。
 * `roleCodes`は1件以上、`version`は一覧取得時点の値を指定する。
 */
export interface AccountRoleUpdateRequest {
  roleCodes: string[];
  version: number;
}

/** Backendが記録する権限変更操作コード。 */
export type AuthorizationAuditAction = "ROLE_ASSIGNED" | "ROLE_REVOKED";

/**
 * 権限変更監査ログAPIが返す1件の操作履歴。
 * `occurredAt`はBackendのUTC InstantをISO 8601文字列として受け取る。
 */
export interface AuthorizationAuditLog {
  authorizationAuditLogId: number;
  actorAccountId: number;
  actorDisplayName: string;
  targetAccountId: number;
  targetDisplayName: string;
  action: AuthorizationAuditAction;
  roleCode: string;
  beforeRoleCodes: string[];
  afterRoleCodes: string[];
  occurredAt: string;
}

/** 権限変更監査ログAPIの0始まりページングResponse。 */
export interface AuthorizationAuditLogListResponse {
  auditLogs: AuthorizationAuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
