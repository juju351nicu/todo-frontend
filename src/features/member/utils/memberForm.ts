import type {
  AccountRole,
  MemberDetailResponse,
  MemberUpsertRequest,
} from "@/features/member/types/member";

/** 旧会員の単一ロール（0/1/2）の表示名。会員登録・編集画面の選択肢と確認画面で使う。 */
export const MEMBER_ROLE_LABELS: Readonly<Record<AccountRole, string>> = {
  0: "管理者",
  1: "閲覧管理者",
  2: "ユーザ",
};

/** 確認画面の1行（項目名と値）。 */
export interface MemberConfirmItem {
  label: string;
  value: string;
}

/** 会員登録・編集画面で使用するフォーム。 */
export interface MemberDetailForm {
  memberId: number;
  lastName: string;
  firstName: string;
  loginId: string;
  password: string;
  email: string;
  role: AccountRole;
  version: number;
}

/** 会員詳細APIレスポンスをパスワードなしの編集フォームへ変換する。 */
export const createMemberDetailForm = (
  detail: Partial<MemberDetailResponse> = {}
): MemberDetailForm => ({
  memberId: detail.memberId ?? 0,
  lastName: detail.lastName ?? "",
  firstName: detail.firstName ?? "",
  loginId: detail.loginId ?? "",
  password: "",
  email: detail.email ?? "",
  role: detail.role ?? 2,
  version: detail.version ?? 0,
});

/** 会員編集フォームをBackendの登録更新Requestへ変換する。 */
export const buildMemberUpsertRequest = (form: MemberDetailForm): MemberUpsertRequest => ({
  memberId: form.memberId,
  lastName: form.lastName,
  firstName: form.firstName,
  loginId: form.loginId,
  password: form.password,
  email: form.email,
  role: form.role,
  version: form.version,
});

/**
 * 登録・更新前の確認画面に並べる項目を作る。パスワードは値を出さず、入力の有無だけを示す。
 * ロールは数値（0/1/2）ではなく表示名にする（数値では利用者に意味が分からないため）。
 *
 * @param form 確認する会員フォーム
 * @returns 項目名と値の一覧
 */
export const buildMemberConfirmItems = (form: MemberDetailForm): MemberConfirmItem[] => [
  { label: "氏名", value: `${form.lastName} ${form.firstName}` },
  { label: "ログインID", value: form.loginId },
  { label: "パスワード", value: form.password ? "入力済み" : "変更なし" },
  { label: "Email アドレス", value: form.email },
  { label: "権限", value: MEMBER_ROLE_LABELS[form.role] ?? String(form.role) },
];
