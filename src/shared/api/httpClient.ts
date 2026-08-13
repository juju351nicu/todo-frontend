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
const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set([
  METHOD.POST,
  METHOD.PUT,
  METHOD.DELETE,
]);

let csrfToken: string | null = null;

const apiUrl = (uri: string): string => API_BASE_URL + uri;

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

const ensureCsrfToken = async (): Promise<string> => {
  csrfToken = csrfToken ?? readCookie(CSRF_COOKIE_NAME);
  return csrfToken ?? refreshCsrfToken();
};

const clearCsrfToken = (): void => {
  csrfToken = null;
};

const request = async <TRequest = unknown>(
  uri: string,
  method: HttpMethod,
  requestData: TRequest | null = null
): Promise<Response> => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
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

const getRequest = (uri: string): Promise<Response> => request(uri, METHOD.GET);

const postRequest = <TRequest = unknown>(
  uri: string,
  requestData: TRequest | null
): Promise<Response> => request(uri, METHOD.POST, requestData);

const putRequest = <TRequest = unknown>(
  uri: string,
  requestData: TRequest
): Promise<Response> => request(uri, METHOD.PUT, requestData);

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
