import Const from "@/constants/const.js";

const METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
};

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-XSRF-TOKEN";
const MUTATING_METHODS = new Set([METHOD.POST, METHOD.PUT, METHOD.DELETE]);

let csrfToken = null;

const apiUrl = (uri) => Const.API_PREFIX_PATH.LOCAL_HOST + uri;

const readCookie = (name) => {
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
 *
 * @returns {Promise<string>} CSRFトークン
 */
const refreshCsrfToken = async () => {
  const response = await fetch(apiUrl(Const.REST_PATH.CSRF), {
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

const ensureCsrfToken = async () => {
  csrfToken = csrfToken ?? readCookie(CSRF_COOKIE_NAME);
  return csrfToken ?? refreshCsrfToken();
};

const clearCsrfToken = () => {
  csrfToken = null;
};

const request = async (uri, method, requestData = null) => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (MUTATING_METHODS.has(method)) {
    headers.set(CSRF_HEADER_NAME, await ensureCsrfToken());
  }

  const options = {
    method,
    headers,
    credentials: "include",
  };
  if (requestData !== null && method !== METHOD.GET) {
    options.body = JSON.stringify(requestData);
  }
  return fetch(apiUrl(uri), options);
};

const getRequest = (uri) => request(uri, METHOD.GET);

const postRequest = (uri, requestData) =>
  request(uri, METHOD.POST, requestData);

const deleteRequest = (uri) => request(uri, METHOD.DELETE);

export default {
  getRequest,
  postRequest,
  deleteRequest,
  refreshCsrfToken,
  clearCsrfToken,
};
