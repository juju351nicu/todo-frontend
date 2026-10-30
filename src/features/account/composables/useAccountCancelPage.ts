import { computed, ref, type Ref } from "vue";

import { ACCOUNT_MESSAGES } from "@/features/account/constants/accountMessages";
import { useAccountStore } from "@/features/account/stores/account";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";

/**
 * 退会画面の状態と操作を提供する。
 *
 * @param accountId 退会するアカウントID（ログイン中のアカウント。Backendは他人のIDを403で拒否する）
 */
export const useAccountCancelPage = (accountId: Readonly<Ref<number>>) => {
  const accountStore = useAccountStore();
  const { expireSession } = useSessionExpiry();

  const isLoading = computed<boolean>(() => accountStore.isLoading);
  const message = ref("");
  const password = ref("");

  /** Modalを閉じる際に平文パスワードと失敗メッセージを画面メモリーから破棄する。 */
  const clearPassword = (): void => {
    password.value = "";
    message.value = "";
  };

  /**
   * パスワードを付けて退会処理を実行する。
   * 失敗したら理由を出す。Sessionが切れていた（401）場合は、パスワードを捨ててログイン画面へ戻す。
   */
  const confirmCancellation = async (): Promise<void> => {
    message.value = "";
    try {
      await accountStore.cancelAccount(accountId.value, { password: password.value });
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearPassword);
        return;
      }
      message.value = ACCOUNT_MESSAGES.cancelFailed;
    }
  };

  return {
    clearPassword,
    confirmCancellation,
    isLoading,
    message,
    password,
  };
};
