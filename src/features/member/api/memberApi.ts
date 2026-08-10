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

const requireSuccess = (response: Response, operation: string): Response => {
  if (!response.ok) {
    throw new Error(`${operation}に失敗しました。status=${response.status}`);
  }
  return response;
};

/** 会員一覧を取得する。 */
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
