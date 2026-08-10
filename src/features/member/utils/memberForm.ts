import type {
  AccountRole,
  MemberDetailResponse,
  MemberUpsertRequest,
} from "@/features/member/types/member";

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
export const buildMemberUpsertRequest = (
  form: MemberDetailForm
): MemberUpsertRequest => ({
  memberId: form.memberId,
  lastName: form.lastName,
  firstName: form.firstName,
  loginId: form.loginId,
  password: form.password,
  email: form.email,
  role: form.role,
  version: form.version,
});
