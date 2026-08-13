import type {
  MemberCancelRequest,
  MemberCancelResponse,
  MemberDetailResponse,
  MemberListResponse,
  MemberUpsertRequest,
  MemberUpsertResponse,
} from "@/features/member/types/member";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

/**
 * 会員APIの非2xx Responseを、操作名とstatusを保持する例外へ変換する。
 *
 * @param response Backend Response
 * @param operation 例外メッセージで識別する画面操作
 * @returns 成功Response
 * @throws HTTP statusが2xxでない場合
 */
const requireSuccess = (response: Response, operation: string): Response => {
  if (!response.ok) {
    throw new Error(`${operation}に失敗しました。status=${response.status}`);
  }
  return response;
};

/**
 * 会員一覧を取得する。
 *
 * @returns パスワードを含まない会員一覧Response
 * @throws 一覧APIが非2xxを返した場合
 */
const findList = async (): Promise<MemberListResponse> => {
  const response = requireSuccess(
    await HttpClient.getRequest(API_PATHS.MEMBER_LIST),
    "会員一覧の取得"
  );
  return (await response.json()) as MemberListResponse;
};

/**
 * 会員詳細を取得する。
 *
 * @param memberId 会員ID
 * @returns パスワードを含まない会員詳細Response
 * @throws 対象未検出を含め、詳細APIが非2xxを返した場合
 */
const findDetail = async (memberId: number): Promise<MemberDetailResponse> => {
  const response = requireSuccess(
    await HttpClient.getRequest(`${API_PATHS.MEMBER_DETAIL}/${memberId}`),
    "会員詳細の取得"
  );
  return (await response.json()) as MemberDetailResponse;
};

/**
 * 指定された会員を削除する。
 *
 * @param memberIds 削除対象の会員ID
 * @returns 削除後の会員一覧Response
 * @throws 削除APIが非2xxを返した場合
 */
const deleteMembers = async (
  memberIds: ReadonlyArray<number | string>
): Promise<MemberListResponse> => {
  const urlParams = new URLSearchParams();
  memberIds.forEach((memberId) => {
    urlParams.append("ids", String(memberId));
  });
  const response = requireSuccess(
    await HttpClient.deleteRequest(
      `${API_PATHS.MEMBER_DELETE}?${urlParams.toString()}`
    ),
    "会員情報の削除"
  );
  return (await response.json()) as MemberListResponse;
};

/**
 * 会員情報を登録または更新する。
 *
 * @param payload 会員登録・更新情報
 * @returns Backendが確定した会員情報
 * @throws 保存APIが非2xxを返した場合
 */
const upsert = async (
  payload: MemberUpsertRequest
): Promise<MemberUpsertResponse> => {
  const response = requireSuccess(
    await HttpClient.postRequest(API_PATHS.MEMBER_UPSERT, payload),
    "会員情報の保存"
  );
  return (await response.json()) as MemberUpsertResponse;
};

/**
 * ログイン中の会員を退会させる。
 *
 * @param payload 退会情報
 * @returns 退会した会員ID
 * @throws 認証・パスワード確認を含め退会APIが非2xxを返した場合
 */
const cancel = async (
  payload: MemberCancelRequest
): Promise<MemberCancelResponse> => {
  const response = requireSuccess(
    await HttpClient.postRequest(API_PATHS.MEMBER_CANCEL, payload),
    "退会処理"
  );
  return (await response.json()) as MemberCancelResponse;
};

export default {
  cancel,
  deleteMembers,
  findDetail,
  findList,
  upsert,
};
