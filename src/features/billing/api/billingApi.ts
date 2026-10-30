import type {
  BillingAdministrationAccountListResponse,
  BillingCheckoutSessionCreateRequest,
  BillingCheckoutSessionResponse,
  BillingMeResponse,
  BillingPortalSessionResponse,
} from "@/features/billing/types/billing";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** 課金APIのHTTPエラーをstatusと安全に解析したBackendエラー本文付きで表す。 */
export class BillingApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("BillingApiError", "課金API", status, errorResponse);
  }
}

/** 非2xx Responseを、画面が401・403・409・503を区別できる課金例外へ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, errorResponse) => new BillingApiError(status, errorResponse));

/**
 * 現在のSession利用者のplan、Subscription状態、機能資格を取得する。
 *
 * @returns 契約がない場合もFREEと空の有料機能一覧を持つ本人用課金状態
 * @throws BillingApiError Backendが非2xxを返した場合
 */
const getMyBilling = async (): Promise<BillingMeResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.BILLING_ME);
  await ensureSuccess(response);
  const payload = (await response.json()) as BillingMeResponse;
  return { ...payload, featureCodes: payload.featureCodes ?? [] };
};

/**
 * Backendの販売allowlistからStripe-hosted Checkoutを開始する。
 * HttpClientがSession CookieとCSRF tokenを送信する。
 *
 * @param payload Stripe Price IDを含まないplan codeと請求間隔
 * @returns 永続化してはいけない短命Checkout URLと失効時刻
 * @throws BillingApiError 入力不正、契約競合、Stripe利用不可の場合
 */
const createCheckoutSession = async (
  payload: BillingCheckoutSessionCreateRequest
): Promise<BillingCheckoutSessionResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.BILLING_CHECKOUT_SESSIONS, payload);
  await ensureSuccess(response);
  return (await response.json()) as BillingCheckoutSessionResponse;
};

/**
 * 現在のSession利用者用Stripe Customer Portalを開始する。
 * Customer IDとreturn URLはBackendが本人Accountと固定設定から解決する。
 *
 * @returns 永続化してはいけない短命Portal URL
 * @throws BillingApiError Customer未作成、契約競合、Stripe利用不可の場合
 */
const createPortalSession = async (): Promise<BillingPortalSessionResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.BILLING_PORTAL_SESSIONS, null);
  await ensureSuccess(response);
  return (await response.json()) as BillingPortalSessionResponse;
};

/**
 * Customer未作成のFree利用者も含む課金Accountを運用permissionでページング取得する。
 *
 * @param page Backendへ渡す0始まりページ番号
 * @param size 1ページの取得件数。1以上100以下
 * @returns Stripe識別子を含まない課金状態一覧
 * @throws BillingApiError 入力不正、未認証、permission不足の場合
 */
const getAdministrationAccounts = async (
  page: number,
  size: number
): Promise<BillingAdministrationAccountListResponse> => {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const response = await HttpClient.getRequest(
    `${API_PATHS.BILLING_ADMINISTRATION_ACCOUNTS}?${query}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as BillingAdministrationAccountListResponse;
  return { ...payload, accounts: payload.accounts ?? [] };
};

/**
 * 対象Accountの課金projectionをStripe最新状態へ手動で再照合する。
 * HttpClientがSession CookieとCSRF tokenを送信する。
 *
 * @param accountId 照合対象の課金主体Account ID
 * @throws BillingApiError permission不足、処理競合、Stripe利用不可の場合
 */
const reconcileAdministrationAccount = async (accountId: number): Promise<void> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.BILLING_ADMINISTRATION_ACCOUNTS}/${accountId}/reconcile`,
    null
  );
  await ensureSuccess(response);
};

export default {
  createCheckoutSession,
  createPortalSession,
  getAdministrationAccounts,
  getMyBilling,
  reconcileAdministrationAccount,
};
