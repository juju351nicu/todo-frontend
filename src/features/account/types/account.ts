/** アカウント一覧APIに含まれるアカウント情報。パスワードとメールアドレスは返却されない。 */
export interface AccountListItem {
  accountId: number;
  lastName: string;
  firstName: string;
  /** ローカルログインのログインID。GitHubだけでログインするアカウントはnull。 */
  loginId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

/**
 * アカウント一覧APIとアカウント削除APIのレスポンス。削除APIは削除後の一覧を返す。
 * `ACCOUNT_READ`がない利用者には自分の行だけが入る。
 */
export interface AccountListResponse {
  accounts: AccountListItem[];
}

/** アカウント詳細APIレスポンス。登録・更新APIも、保存後のアカウント詳細を返す。 */
export interface AccountDetailResponse {
  accountId: number;
  lastName: string;
  firstName: string;
  /** ローカルログインのログインID。GitHubだけでログインするアカウントはnull。 */
  loginId: string | null;
  email: string;
  version: number;
  /** 付与されているロールの表示名。この画面では変えられない（アカウント・ロール管理で変える）。 */
  roleNames: string[];
}

/** アカウント登録APIリクエスト。ロールは送らない（登録したアカウントはユーザになる）。 */
export interface AccountRegisterRequest {
  lastName: string;
  firstName: string;
  loginId: string;
  password: string;
  email: string;
}

/** アカウント更新APIリクエスト。パスワードが空なら保存済みのパスワードを変えない。 */
export interface AccountUpdateRequest extends AccountRegisterRequest {
  version: number;
}

/** 退会APIリクエスト。 */
export interface AccountCancelRequest {
  password: string;
}

/** 退会APIレスポンス。 */
export interface AccountCancelResponse {
  accountId: number;
}
