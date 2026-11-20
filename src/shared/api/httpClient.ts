import { API_BASE_URL, API_PATHS } from "@/shared/constants/api";

const METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

type HttpMethod = (typeof METHOD)[keyof typeof METHOD];

const CSRF_HEADER_NAME = "X-XSRF-TOKEN";
const JSON_MEDIA_TYPE = "application/json";
const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set([METHOD.POST, METHOD.PUT, METHOD.DELETE]);

/** CSRF APIの固定契約。tokenはSessionに結び付いたmasked値であり永続化しない。 */
interface CsrfTokenResponse {
  /** 送信先の固定Header名。 */
  headerName: string;
  /** form用の固定parameter名。 */
  parameterName: string;
  /** Headerへ送るランダム化されたtoken。 */
  token: string;
}

let csrfToken: string | null = null;
let csrfRefreshPromise: Promise<string> | null = null;
let csrfTokenGeneration = 0;

/** Backend APIの相対pathを環境別の接続先URLへ解決する。 */
const buildApiUrl = (uri: string): string => API_BASE_URL + uri;

/** 外部JSONの固定Header・parameterと空でないtokenを検査する。 */
const isCsrfTokenResponse = (value: unknown): value is CsrfTokenResponse =>
  typeof value === "object" &&
  value !== null &&
  "headerName" in value &&
  value.headerName === CSRF_HEADER_NAME &&
  "parameterName" in value &&
  value.parameterName === "_csrf" &&
  "token" in value &&
  typeof value.token === "string" &&
  value.token.trim().length > 0;

/** 認証境界でtokenを破棄し、進行中の古い取得結果も再利用させない。 */
const clearCsrfToken = (): void => {
  csrfToken = null;
  csrfRefreshPromise = null;
  csrfTokenGeneration += 1;
};

/** 認証状態が変わった後に古いtokenを保存したり更新Requestへ使用したりしない。 */
const validateCsrfTokenGeneration = (generation: number): void => {
  if (generation !== csrfTokenGeneration) {
    throw new Error("認証状態が変わったためCSRFトークンを再取得してください。");
  }
};

/**
 * 同じSessionからmasked tokenを取得し、認証状態が変わっていない場合だけメモリーへ保存する。
 * @param generation 取得を開始した認証状態の世代
 * @returns 更新Headerへ送信できるmasked token
 * @throws 通信・Response契約不正、または取得中に認証状態が変わった場合
 */
const loadCsrfToken = async (generation: number): Promise<string> => {
  try {
    const response = await fetch(buildApiUrl(API_PATHS.CSRF), {
      method: METHOD.GET,
      headers: { Accept: JSON_MEDIA_TYPE },
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`CSRFトークンの取得に失敗しました。status=${response.status}`);
    }
    const body: unknown = await response.json();
    if (!isCsrfTokenResponse(body)) {
      throw new Error("CSRF Responseの形式が正しくありません。");
    }
    validateCsrfTokenGeneration(generation);
    csrfToken = body.token;
    return csrfToken;
  } finally {
    if (generation === csrfTokenGeneration) {
      csrfRefreshPromise = null;
    }
  }
};

/**
 * 現在のSession用tokenを再取得する。失敗時も古いtokenへ戻さず、Cookieは読み取らない。
 * @returns メモリーに保存したmasked token
 * @throws CSRF APIの失敗・契約不正、または取得中の認証状態変更
 */
const refreshCsrfToken = (): Promise<string> => {
  clearCsrfToken();
  csrfRefreshPromise = loadCsrfToken(csrfTokenGeneration);
  return csrfRefreshPromise;
};

/** 初回の並行更新は同じ取得を待ち、token取得に成功するまで業務Requestを送信しない。 */
const ensureCsrfToken = (): Promise<string> =>
  csrfToken !== null ? Promise.resolve(csrfToken) : (csrfRefreshPromise ?? refreshCsrfToken());

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
    const tokenPromise = ensureCsrfToken();
    const generation = csrfTokenGeneration;
    const token = await tokenPromise;
    // cache済みtokenでもawaitで制御が戻るため、送信直前に認証境界を再検査する。
    validateCsrfTokenGeneration(generation);
    headers.set(CSRF_HEADER_NAME, token);
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: "include",
  };
  if (requestData !== null && method !== METHOD.GET) {
    options.body = JSON.stringify(requestData);
  }
  return fetch(buildApiUrl(uri), options);
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
const putRequest = <TRequest = unknown>(uri: string, requestData: TRequest): Promise<Response> =>
  request(uri, METHOD.PUT, requestData);

/** Session Cookie・CSRF token付きDELETE Requestを送信する。 */
const deleteRequest = (uri: string): Promise<Response> => request(uri, METHOD.DELETE);

export default {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
  refreshCsrfToken,
  clearCsrfToken,
};
