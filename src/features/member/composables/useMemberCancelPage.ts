import { computed, ref, type Ref } from "vue";

import { useMemberStore } from "@/features/member/stores/member";
import type { MemberCancelRequest } from "@/features/member/types/member";

/**
 * 会員退会画面の状態と操作を提供する。
 *
 * @param memberId 退会対象の会員ID
 */
export const useMemberCancelPage = (
  memberId: Readonly<Ref<number>>
) => {
  const memberStore = useMemberStore();

  const isLoading = computed<boolean>(() => memberStore.isLoading);
  const message = ref("");
  const password = ref("");

  /** Modalを閉じる際に平文パスワードと失敗メッセージを画面メモリーから破棄する。 */
  const clearPassword = (): void => {
    password.value = "";
    message.value = "";
  };

  /** パスワードを付けて退会処理を実行する。 */
  const confirmCancellation = async (): Promise<void> => {
    message.value = "";
    const payload: MemberCancelRequest = {
      memberId: memberId.value,
      password: password.value,
    };
    const response = await memberStore.cancelMemberInfo(payload);
    if (!response) {
      message.value = "退会処理に失敗しました。入力内容を確認してください。";
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
