import type {
  LoginRequest,
  SessionUserResponse,
} from "@/features/auth/types/auth";
import HttpClient from "@/shared/api/httpClient";
import { API_BASE_URL, API_PATHS } from "@/shared/constants/api";

/**
 * 現在のHttpSessionに保存された認証利用者を取得する。
 * 401等の非2xxは通信例外にせず、未認証としてnullへ正規化する。
 *
 * @returns 未認証の場合はnull、認証済みの場合は利用者情報
 */
const getSession = async (): Promise<SessionUserResponse | null> => {
  const response = await HttpClient.getRequest(API_PATHS.SESSION);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SessionUserResponse;
};

/**
 * ログインIDとパスワードでログインする。
 *
 * @param payload ログイン情報
 * @returns 認証結果のResponse。成功時は新しいSessionに対応するCSRF Cookieも取得済み
 * @throws ログイン成功後にCSRF Cookieを取得できない場合
 */
const login = async (payload: LoginRequest): Promise<Response> => {
  const response = await HttpClient.postRequest(
    API_PATHS.AUTH_LOGIN,
    payload
  );
  if (response.ok) {
    await HttpClient.refreshCsrfToken();
  }
  return response;
};

/**
 * 現在のHttpSessionを無効化してログアウトする。
 * 成功時は古いCSRF tokenを破棄し、未認証Session用の新しいtokenへ更新する。
 *
 * @returns HttpSessionを無効化したBackend Response
 * @throws ログアウトまたはログアウト後のCSRF Cookie取得に失敗した場合
 */
const logout = async (): Promise<Response> => {
  const response = await HttpClient.postRequest(API_PATHS.LOGOUT, null);
  if (!response.ok) {
    throw new Error(`ログアウトに失敗しました。status=${response.status}`);
  }
  HttpClient.clearCsrfToken();
  await HttpClient.refreshCsrfToken();
  return response;
};

/**
 * GitHub OAuth2ログインの開始URLを返す。
 *
 * @returns BackendのGitHub認可開始URL
 */
const getGitHubAuthorizationUrl = (): string =>
  `${API_BASE_URL}/oauth2/authorization/github`;

export default {
  getGitHubAuthorizationUrl,
  getSession,
  login,
  logout,
};
