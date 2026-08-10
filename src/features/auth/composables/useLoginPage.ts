import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import AuthApi from "@/features/auth/api/authApi";
import { useUserStore } from "@/features/auth/stores/user";
import type { LoginRequest } from "@/features/auth/types/auth";
import type { ErrorResponse } from "@/shared/types/error";

const OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  email_required:
    "GitHubからメールアドレスを取得できませんでした。GitHubのメール設定を確認してください。",
  account_unavailable: "このアカウントは現在利用できません。",
  unsupported_provider: "対応していないOAuth2プロバイダーです。",
  login_failed: "GitHubでログインできませんでした。もう一度お試しください。",
};

/** ログイン画面の状態と操作を提供する。 */
export const useLoginPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const isShowModal = ref(false);
  const loginForm = ref<LoginRequest>({
    loginId: "",
    password: "",
  });
  const showPassword = ref(false);

  const showErrors = (messages: string[]): void => {
    errorMessages.value = messages;
    isShowModal.value = true;
  };

  /** ログイン画面を初期化し、既存SessionとOAuth2エラーを確認する。 */
  const initialize = async (): Promise<void> => {
    if (await userStore.restoreSession(true)) {
      await router.push({ name: "MemberList" });
      return;
    }

    const queryValue = route.query.oauthError;
    const oauthError = Array.isArray(queryValue) ? queryValue[0] : queryValue;
    if (typeof oauthError !== "string") {
      return;
    }

    showErrors([
      OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.login_failed,
    ]);
    await router.replace({ path: route.path, query: {} });
  };

  /** ログインIDとパスワードでログインする。 */
  const submitForm = async (): Promise<void> => {
    isLoading.value = true;
    isShowModal.value = false;
    errorMessages.value = [];
    try {
      const response = await userStore.authLogin({ ...loginForm.value });
      if (response.ok) {
        await router.push({ name: "MemberList" });
        return;
      }

      if (response.status === 400) {
        const errorResponse = (await response.json()) as ErrorResponse;
        errorMessages.value = (errorResponse.fieldErrors ?? []).map(
          (fieldError) => fieldError.message
        );
      }
      if (errorMessages.value.length === 0) {
        errorMessages.value = [
          response.status === 401
            ? "ログインIDまたはパスワードが正しくありません。"
            : "ログインできませんでした。",
        ];
      }
      isShowModal.value = true;
    } catch (_error: unknown) {
      showErrors(["Backendへ接続できませんでした。"]);
    } finally {
      isLoading.value = false;
    }
  };

  /** 会員登録画面へ移動する。 */
  const submitRegister = (): void => {
    void router.push({ name: "MemberRegister" });
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
    showPassword,
    submitForm,
    submitGithub,
    submitRegister,
  };
};
