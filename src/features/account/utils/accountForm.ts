import type {
  AccountDetailResponse,
  AccountRegisterRequest,
  AccountUpdateRequest,
} from "@/features/account/types/account";

/** 新規登録したアカウントに付くロールの表示名。Backendは登録したアカウントをUSERロールにする。 */
export const NEW_ACCOUNT_ROLE_LABEL = "ユーザ";

/** 確認画面の1行（項目名と値）。 */
export interface AccountConfirmItem {
  label: string;
  value: string;
}

/** アカウント登録・設定画面で使用するフォーム。`accountId`が0なら新規登録。 */
export interface AccountDetailForm {
  accountId: number;
  lastName: string;
  firstName: string;
  loginId: string;
  password: string;
  email: string;
  version: number;
  /** 付与されているロールの表示名。表示だけに使い、Backendへは送らない。 */
  roleNames: string[];
}

/** アカウント詳細APIレスポンスをパスワードなしの編集フォームへ変換する。ログインIDがnullなら空文字にする。 */
export const createAccountDetailForm = (
  detail: Partial<AccountDetailResponse> = {}
): AccountDetailForm => ({
  accountId: detail.accountId ?? 0,
  lastName: detail.lastName ?? "",
  firstName: detail.firstName ?? "",
  loginId: detail.loginId ?? "",
  password: "",
  email: detail.email ?? "",
  version: detail.version ?? 0,
  roleNames: detail.roleNames ?? [],
});

/** アカウント編集フォームをBackendの登録Requestへ変換する。ロールは送らない。 */
export const buildAccountRegisterRequest = (form: AccountDetailForm): AccountRegisterRequest => ({
  lastName: form.lastName,
  firstName: form.firstName,
  loginId: form.loginId,
  password: form.password,
  email: form.email,
});

/** アカウント編集フォームをBackendの更新Requestへ変換する。ロールは送らない。 */
export const buildAccountUpdateRequest = (form: AccountDetailForm): AccountUpdateRequest => ({
  ...buildAccountRegisterRequest(form),
  version: form.version,
});

/**
 * 画面に出すロールの表示名を返す。新規登録ではBackendが付けるユーザロールの名前を出す。
 *
 * @param form アカウント編集フォーム
 * @returns ロールの表示名を「、」でつないだ文字列
 */
export const resolveAccountRoleLabel = (form: AccountDetailForm): string =>
  form.accountId === 0 ? NEW_ACCOUNT_ROLE_LABEL : form.roleNames.join("、");

/**
 * 登録・更新前の確認画面に並べる項目を作る。パスワードは値を出さず、入力の有無だけを示す。
 *
 * @param form 確認するアカウントフォーム
 * @returns 項目名と値の一覧
 */
export const buildAccountConfirmItems = (form: AccountDetailForm): AccountConfirmItem[] => [
  { label: "氏名", value: `${form.lastName} ${form.firstName}` },
  { label: "ログインID", value: form.loginId },
  { label: "パスワード", value: form.password ? "入力済み" : "変更なし" },
  { label: "Email アドレス", value: form.email },
  { label: "権限", value: resolveAccountRoleLabel(form) },
];
