import { computed, ref, type Ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { MEMBER_MESSAGES } from "@/features/member/constants/memberMessages";
import { useMemberStore } from "@/features/member/stores/member";
import type { MemberCancelRequest } from "@/features/member/types/member";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";

/**
 * 会員退会画面の状態と操作を提供する。
 *
 * @param memberId 退会対象の会員ID
 */
export const useMemberCancelPage = (
  memberId: Readonly<Ref<number>>
) => {
  const memberStore = useMemberStore();
  const { expireSession } = useSessionExpiry();

  const isLoading = computed<boolean>(() => memberStore.isLoading);
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
    const payload: MemberCancelRequest = {
      memberId: memberId.value,
      password: password.value,
    };
    try {
      await memberStore.cancelMemberInfo(payload);
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearPassword);
        return;
      }
      message.value = MEMBER_MESSAGES.cancelFailed;
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
