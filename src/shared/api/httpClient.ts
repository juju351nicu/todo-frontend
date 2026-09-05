import { API_BASE_URL, API_PATHS } from "@/shared/constants/api";

const METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

type HttpMethod = (typeof METHOD)[keyof typeof METHOD];

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-XSRF-TOKEN";
const JSON_MEDIA_TYPE = "application/json";
const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set([
  METHOD.POST,
  METHOD.PUT,
  METHOD.DELETE,
]);

let csrfToken: string | null = null;

/** Backend APIの相対pathを環境別の接続先URLへ解決する。 */
const apiUrl = (uri: string): string => API_BASE_URL + uri;

/**
 * ブラウザーCookieから指定名の値をURL decodeして取得する。
 * SSRやVitest等でdocumentが存在しない環境ではnullを返す。
 *
 * @param name 取得するCookie名
 * @returns Cookie値。未設定またはdocumentが存在しない場合はnull
 */
const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.substring(prefix.length)) : null;
};

/**
 * Backendから新しいCSRF Cookieを取得する。
 * ログイン・ログアウトで古いトークンが破棄された後にも呼び出す。
 */
const refreshCsrfToken = async (): Promise<string> => {
  const response = await fetch(apiUrl(API_PATHS.CSRF), {
    method: METHOD.GET,
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`CSRFトークンの取得に失敗しました。status=${response.status}`);
  }
  csrfToken = readCookie(CSRF_COOKIE_NAME);
  if (!csrfToken) {
    throw new Error("CSRF Cookieを取得できませんでした。");
  }
  return csrfToken;
};

/**
 * 更新Requestに使用できるCSRFトークンをCookieまたはBackendから取得する。
 * メモリー上の値を優先し、未取得時だけCookie、CSRF APIの順で解決する。
 *
 * @returns X-XSRF-TOKEN headerへ設定するトークン
 * @throws CSRF APIが失敗するか、Cookieを取得できない場合
 */
const ensureCsrfToken = async (): Promise<string> => {
  csrfToken = csrfToken ?? readCookie(CSRF_COOKIE_NAME);
  return csrfToken ?? refreshCsrfToken();
};

/** ログイン・ログアウトで無効になったメモリー上のCSRFトークンを破棄する。 */
const clearCsrfToken = (): void => {
  csrfToken = null;
};

/**
 * JSESSIONIDを含む共通Requestを送信し、更新系ではCSRF headerを付与する。
 * HTTP statusは解釈せず、feature APIが業務エラーへ変換できるResponseを返す。
 *
 * @param uri Backend APIの相対path
 * @param method HTTP method
 * @param requestData JSON body。GETまたはbodyなしの場合はnull
 * @param accept Responseとして受け取るmedia type
 * @returns BackendのResponse
 */
const request = async <TRequest = unknown>(
  uri: string,
  method: HttpMethod,
  requestData: TRequest | null = null,
  accept = JSON_MEDIA_TYPE
): Promise<Response> => {
  const headers = new Headers({
    Accept: accept,
    "Content-Type": JSON_MEDIA_TYPE,
  });
  if (MUTATING_METHODS.has(method)) {
    headers.set(CSRF_HEADER_NAME, await ensureCsrfToken());
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: "include",
  };
  if (requestData !== null && method !== METHOD.GET) {
    options.body = JSON.stringify(requestData);
  }
  return fetch(apiUrl(uri), options);
};

/**
 * Session Cookie付きGET Requestを送信する。
 * JSON以外をdownloadするAPIはacceptへ期待するmedia typeを明示する。
 */
const getRequest = (uri: string, accept = JSON_MEDIA_TYPE): Promise<Response> =>
  request(uri, METHOD.GET, null, accept);

/** Session Cookie・CSRF token付きPOST Requestを送信する。 */
const postRequest = <TRequest = unknown>(
  uri: string,
  requestData: TRequest | null
): Promise<Response> => request(uri, METHOD.POST, requestData);

/** Session Cookie・CSRF token付きPUT Requestを送信する。 */
const putRequest = <TRequest = unknown>(
  uri: string,
  requestData: TRequest
): Promise<Response> => request(uri, METHOD.PUT, requestData);

/** Session Cookie・CSRF token付きDELETE Requestを送信する。 */
const deleteRequest = (uri: string): Promise<Response> =>
  request(uri, METHOD.DELETE);

export default {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
  refreshCsrfToken,
  clearCsrfToken,
};
