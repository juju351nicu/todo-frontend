import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  AUTHENTICATED_HOME_ROUTE_NAME,
  LOGIN_REQUIRED_QUERY,
} from "@/app/router/authorization";
import AuthApi, { AuthApiError } from "@/features/auth/api/authApi";
import { useUserStore } from "@/features/auth/stores/user";
import type { LoginRequest } from "@/features/auth/types/auth";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const LOGIN_INPUT_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
]);

const OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  email_required: DISPLAY_MESSAGES.auth.oauth.emailRequired,
  account_unavailable: DISPLAY_MESSAGES.auth.oauth.accountUnavailable,
  unsupported_provider: DISPLAY_MESSAGES.auth.oauth.unsupportedProvider,
  login_failed: DISPLAY_MESSAGES.auth.oauth.loginFailed,
};

/**
 * 画面遷移元が付けたqueryの値を1件だけ取り出す。同じkeyが複数ある場合は先頭を使う。
 *
 * @param value `route.query`の値
 * @returns 文字列でない（未指定・null）場合はundefined
 */
const readQueryValue = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
};

/**
 * ログイン画面の入力、Session復元、OAuth2開始および認証後遷移を提供する。
 * 認証後はSessionのpermissionから利用可能な既定画面を選択する。
 *
 * `loginNotice`は、Router guardが未ログインの保護画面アクセスをLoginへ戻したとき（`LOGIN_REQUIRED_QUERY`）の
 * 案内文。エラーではないため`errorMessages`とは分け、ログイン操作を始めても消さない。
 */
export const useLoginPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const loginNotice = ref<string>("");
  const isLoading = ref(false);
  const isShowModal = ref(false);
  const loginForm = ref<LoginRequest>({
    loginId: "",
    password: "",
  });
  const showPassword = ref(false);

  /** エラー一覧を設定し、ログイン画面の通知Modalを表示する。 */
  const showErrors = (messages: string[]): void => {
    errorMessages.value = messages;
    isShowModal.value = true;
  };

  /**
   * ログイン画面を初期化する。既存Sessionがあれば既定画面へ移動し、なければ要ログインの案内とOAuth2エラーを
   * queryから表示する。表示したqueryは、再読込や共有URLで同じ案内が繰り返し出ないようURLから除去する。
   */
  const initialize = async (): Promise<void> => {
    if (await userStore.restoreSession(true)) {
      await router.push({
        name: AUTHENTICATED_HOME_ROUTE_NAME,
      });
      return;
    }

    const isLoginRequired =
      readQueryValue(route.query.reason) === LOGIN_REQUIRED_QUERY.reason;
    const oauthError = readQueryValue(route.query.oauthError);
    if (!isLoginRequired && oauthError === undefined) {
      return;
    }

    if (isLoginRequired) {
      loginNotice.value = DISPLAY_MESSAGES.auth.loginRequired;
    }
    if (oauthError !== undefined) {
      showErrors([
        OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.login_failed,
      ]);
    }
    await router.replace({ path: route.path, query: {} });
  };

  /** ログインIDとパスワードでログインする。 */
  const submitForm = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    isShowModal.value = false;
    errorMessages.value = [];
    try {
      if (!(await userStore.authLogin({ ...loginForm.value }))) {
        showErrors([DISPLAY_MESSAGES.auth.sessionRestoreFailed]);
        return;
      }
      await router.push({
        name: AUTHENTICATED_HOME_ROUTE_NAME,
      });
    } catch (error: unknown) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          showErrors([DISPLAY_MESSAGES.auth.credentialsRejected]);
          return;
        }
        if (error.status === 400) {
          showErrors(
            resolveApiErrorMessages(
              error.errorResponse,
              LOGIN_INPUT_ERROR_CODES,
              DISPLAY_MESSAGES.auth.invalidInput
            )
          );
          return;
        }
        if (error.status === 403) {
          showErrors([DISPLAY_MESSAGES.auth.requestForbidden]);
          return;
        }
        showErrors([DISPLAY_MESSAGES.auth.loginFailed]);
        return;
      }
      showErrors([DISPLAY_MESSAGES.common.connectionFailed]);
    } finally {
      isLoading.value = false;
    }
  };

  /** GitHub OAuth2ログインを開始する。 */
  const submitGithub = (): void => {
    window.location.assign(AuthApi.getGitHubAuthorizationUrl());
  };

  return {
    errorMessages,
    initialize,
    isLoading,
    isShowModal,
    loginForm,
    loginNotice,
    showPassword,
    submitForm,
    submitGithub,
  };
};
