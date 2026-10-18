import type {
  AccountAuthorization,
  AccountAuthorizationListResponse,
  AccountRoleUpdateRequest,
  AdministrationRole,
  AuthorizationAuditLogListResponse,
  RoleListResponse,
} from "@/features/administration/types/administration";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ensureApiSuccess } from "@/shared/utils/apiError";

/** 権限管理APIがHTTPエラーを返したことを、statusと項目エラー付きで表す。 */
export class AdministrationApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`権限管理APIの実行に失敗しました。status=${status}`);
    this.name = "AdministrationApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/**
 * 非2xx Responseを、画面で401・403・409を区別できる例外へ変換する。
 *
 * @param response Backend Response
 * @throws AdministrationApiError 非2xxの場合
 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new AdministrationApiError(status, errorResponse)
  );

/**
 * ACCOUNT_READ permissionを使用してアカウントと現在ロールを一覧取得する。
 *
 * @returns 対象がない場合は空配列
 * @throws AdministrationApiError Backendが非2xxを返した場合
 */
const getAccounts = async (): Promise<AccountAuthorization[]> => {
  const response = await HttpClient.getRequest(API_PATHS.ADMINISTRATION_ACCOUNTS);
  await ensureSuccess(response);
  const payload = (await response.json()) as AccountAuthorizationListResponse;
  return payload.accounts ?? [];
};

/**
 * ACCOUNT_READ permissionを使用して権限管理画面の選択可能ロールを取得する。
 *
 * @returns 対象がない場合は空配列
 * @throws AdministrationApiError Backendが非2xxを返した場合
 */
const getRoles = async (): Promise<AdministrationRole[]> => {
  const response = await HttpClient.getRequest(API_PATHS.ADMINISTRATION_ROLES);
  await ensureSuccess(response);
  const payload = (await response.json()) as RoleListResponse;
  return payload.roles ?? [];
};

/**
 * ACCOUNT_ROLE_UPDATE permissionを使用して対象アカウントのロール集合を置き換える。
 * HttpClientがCSRF tokenとJSESSIONIDを送信する。
 *
 * @param accountId 変更対象アカウントID
 * @param payload 変更後ロールコードと一覧取得時点のversion
 * @returns 更新後のアカウント権限情報
 * @throws AdministrationApiError 入力不正、権限不足、未検出、version競合の場合
 */
const updateAccountRoles = async (
  accountId: number,
  payload: AccountRoleUpdateRequest
): Promise<AccountAuthorization> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.ADMINISTRATION_ACCOUNTS}/${accountId}/roles`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as AccountAuthorization;
};

/**
 * AUTHORIZATION_AUDIT_READ permissionを使用して権限変更監査ログを取得する。
 *
 * @param page Backendへ渡す0始まりページ番号
 * @param size 1ページの取得件数。Backend契約上1以上100以下
 * @returns 新しい操作順の監査ログとページ情報
 * @throws AdministrationApiError 入力不正、未認証、permission不足の場合
 */
const getAuthorizationAuditLogs = async (
  page: number,
  size: number
): Promise<AuthorizationAuditLogListResponse> => {
  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  const response = await HttpClient.getRequest(
    `${API_PATHS.AUTHORIZATION_AUDIT_LOGS}?${query}`
  );
  await ensureSuccess(response);
  return (await response.json()) as AuthorizationAuditLogListResponse;
};

export default {
  getAccounts,
  getAuthorizationAuditLogs,
  getRoles,
  updateAccountRoles,
};
