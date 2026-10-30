import type {
  AccountCancelRequest,
  AccountCancelResponse,
  AccountDetailResponse,
  AccountListResponse,
  AccountRegisterRequest,
  AccountUpdateRequest,
} from "@/features/account/types/account";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** アカウントAPIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class AccountApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("AccountApiError", "アカウントAPI", status, errorResponse);
  }
}

/**
 * アカウントAPIの非2xx Responseを`AccountApiError`へ変換する。
 *
 * @param response Backend Response
 * @throws AccountApiError HTTP statusが2xxでない場合
 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, errorResponse) => new AccountApiError(status, errorResponse));

/**
 * アカウント一覧を取得する。
 *
 * @returns パスワードを含まないアカウント一覧Response
 * @throws AccountApiError 一覧APIが非2xxを返した場合
 */
const findList = async (): Promise<AccountListResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.ACCOUNTS);
  await ensureSuccess(response);
  return (await response.json()) as AccountListResponse;
};

/**
 * アカウント詳細を取得する。
 *
 * @param accountId アカウントID
 * @returns パスワードを含まないアカウント詳細Response
 * @throws AccountApiError 対象未検出を含め、詳細APIが非2xxを返した場合
 */
const findDetail = async (accountId: number): Promise<AccountDetailResponse> => {
  const response = await HttpClient.getRequest(`${API_PATHS.ACCOUNTS}/${accountId}`);
  await ensureSuccess(response);
  return (await response.json()) as AccountDetailResponse;
};

/**
 * 指定されたアカウントを削除（無効化）する。
 *
 * @param accountIds 削除対象のアカウントID
 * @returns 削除後のアカウント一覧Response
 * @throws AccountApiError 削除APIが非2xxを返した場合
 */
const deleteAccounts = async (
  accountIds: ReadonlyArray<number | string>
): Promise<AccountListResponse> => {
  const urlParams = new URLSearchParams();
  accountIds.forEach((accountId) => {
    urlParams.append("ids", String(accountId));
  });
  const response = await HttpClient.deleteRequest(`${API_PATHS.ACCOUNTS}?${urlParams.toString()}`);
  await ensureSuccess(response);
  return (await response.json()) as AccountListResponse;
};

/**
 * アカウントを登録する。
 *
 * @param payload 登録内容
 * @returns 登録したアカウントの詳細
 * @throws AccountApiError 登録APIが非2xxを返した場合
 */
const register = async (payload: AccountRegisterRequest): Promise<AccountDetailResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.ACCOUNTS, payload);
  await ensureSuccess(response);
  return (await response.json()) as AccountDetailResponse;
};

/**
 * アカウントの情報を更新する。
 *
 * @param accountId 更新するアカウントID
 * @param payload 更新内容と、画面を開いたときのversion
 * @returns 更新後のアカウントの詳細
 * @throws AccountApiError 更新APIが非2xxを返した場合
 */
const update = async (
  accountId: number,
  payload: AccountUpdateRequest
): Promise<AccountDetailResponse> => {
  const response = await HttpClient.putRequest(`${API_PATHS.ACCOUNTS}/${accountId}`, payload);
  await ensureSuccess(response);
  return (await response.json()) as AccountDetailResponse;
};

/**
 * ログイン中のアカウントを退会させる。
 *
 * @param accountId 退会するアカウントID（ログイン中のアカウントと同じ）
 * @param payload 確認用のパスワード
 * @returns 退会したアカウントID
 * @throws AccountApiError 認証・パスワード確認を含め退会APIが非2xxを返した場合
 */
const cancel = async (
  accountId: number,
  payload: AccountCancelRequest
): Promise<AccountCancelResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ACCOUNTS}/${accountId}/cancel`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as AccountCancelResponse;
};

export default {
  cancel,
  deleteAccounts,
  findDetail,
  findList,
  register,
  update,
};
