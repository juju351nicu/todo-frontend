/** Backendの既存会員APIで使用している権限コード。 */
export type AccountRole = 0 | 1 | 2;

/** Backendの既存会員APIで使用している認証プロバイダーコード。 */
export type AuthProviderCode =
  | "local"
  | "facebook"
  | "google"
  | "github";

/** 会員一覧APIに含まれる会員情報。パスワードは返却されない。 */
export interface MemberListItem {
  memberId: number;
  lastName: string;
  firstName: string;
  loginId: string;
  email: string;
  provider: AuthProviderCode | null;
  registeredDate: string | null;
  updatedDate: string | null;
  lastLogin: string | null;
  deleteFlag: boolean | null;
  role: AccountRole;
  version: number;
}

/** 会員一覧APIレスポンス。 */
export interface MemberListResponse {
  memberId: number;
  memberList: MemberListItem[];
  ids: string[];
  role: AccountRole;
}

/** 会員詳細APIレスポンス。 */
export interface MemberDetailResponse {
  memberId: number;
  firstName: string;
  lastName: string;
  loginId: string;
  email: string;
  version: number;
  role: AccountRole;
}

/** 会員登録・更新APIリクエスト。 */
export interface MemberUpsertRequest extends MemberDetailResponse {
  password: string;
}

/** 会員登録・更新APIレスポンス。 */
export interface MemberUpsertResponse extends MemberUpsertRequest {
  type?: string | null;
}

/** 退会APIリクエスト。 */
export interface MemberCancelRequest {
  memberId: number;
  password: string;
}

/** 退会APIレスポンス。 */
export interface MemberCancelResponse {
  memberId: number;
}
