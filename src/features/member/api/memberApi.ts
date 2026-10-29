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
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** 会員APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class MemberApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("MemberApiError", "会員API", status, errorResponse);
  }
}

/**
 * 会員APIの非2xx Responseを`MemberApiError`へ変換する。
 *
 * @param response Backend Response
 * @throws MemberApiError HTTP statusが2xxでない場合
 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, errorResponse) => new MemberApiError(status, errorResponse));

/**
 * 会員一覧を取得する。
 *
 * @returns パスワードを含まない会員一覧Response
 * @throws MemberApiError 一覧APIが非2xxを返した場合
 */
const findList = async (): Promise<MemberListResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.MEMBER_LIST);
  await ensureSuccess(response);
  return (await response.json()) as MemberListResponse;
};

/**
 * 会員詳細を取得する。
 *
 * @param memberId 会員ID
 * @returns パスワードを含まない会員詳細Response
 * @throws MemberApiError 対象未検出を含め、詳細APIが非2xxを返した場合
 */
const findDetail = async (memberId: number): Promise<MemberDetailResponse> => {
  const response = await HttpClient.getRequest(`${API_PATHS.MEMBER_DETAIL}/${memberId}`);
  await ensureSuccess(response);
  return (await response.json()) as MemberDetailResponse;
};

/**
 * 指定された会員を削除する。
 *
 * @param memberIds 削除対象の会員ID
 * @returns 削除後の会員一覧Response
 * @throws MemberApiError 削除APIが非2xxを返した場合
 */
const deleteMembers = async (
  memberIds: ReadonlyArray<number | string>
): Promise<MemberListResponse> => {
  const urlParams = new URLSearchParams();
  memberIds.forEach((memberId) => {
    urlParams.append("ids", String(memberId));
  });
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.MEMBER_DELETE}?${urlParams.toString()}`
  );
  await ensureSuccess(response);
  return (await response.json()) as MemberListResponse;
};

/**
 * 会員情報を登録または更新する。
 *
 * @param payload 会員登録・更新情報
 * @returns Backendが確定した会員情報
 * @throws MemberApiError 保存APIが非2xxを返した場合
 */
const upsert = async (payload: MemberUpsertRequest): Promise<MemberUpsertResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.MEMBER_UPSERT, payload);
  await ensureSuccess(response);
  return (await response.json()) as MemberUpsertResponse;
};

/**
 * ログイン中の会員を退会させる。
 *
 * @param payload 退会情報
 * @returns 退会した会員ID
 * @throws MemberApiError 認証・パスワード確認を含め退会APIが非2xxを返した場合
 */
const cancel = async (payload: MemberCancelRequest): Promise<MemberCancelResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.MEMBER_CANCEL, payload);
  await ensureSuccess(response);
  return (await response.json()) as MemberCancelResponse;
};

export default {
  cancel,
  deleteMembers,
  findDetail,
  findList,
  upsert,
};
