import { computed, reactive, ref, watch, type Ref } from "vue";

import { AccountApiError } from "@/features/account/api/accountApi";
import { ACCOUNT_MESSAGES } from "@/features/account/constants/accountMessages";
import { useAccountStore } from "@/features/account/stores/account";
import {
  buildAccountRegisterRequest,
  buildAccountUpdateRequest,
  createAccountDetailForm,
  resolveAccountRoleLabel,
  type AccountDetailForm,
} from "@/features/account/utils/accountForm";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";

/**
 * アカウント設定・アカウント登録画面の状態と操作を提供する。
 *
 * アカウントIDが0（または未指定）なら登録（`POST /api/v1/accounts`）、それ以外は更新（`PUT /api/v1/accounts/{id}`）を呼ぶ。
 *
 * @param accountId Routerから受け取ったアカウントID
 */
export const useAccountDetailPage = (accountId: Readonly<Ref<number | undefined>>) => {
  const accountStore = useAccountStore();
  const { expireSession } = useSessionExpiry();

  const isLoading = computed<boolean>(() => accountStore.isLoading);
  const isShowConfirm = ref(false);
  const loadError = ref("");
  /** 登録・更新に失敗したときの理由。次の保存を始めたときに消す。 */
  const submitError = ref("");
  const accountForm = reactive<AccountDetailForm>(createAccountDetailForm());
  const normalizedAccountId = computed<number>(() => {
    const value = accountId.value ?? 0;
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  /**
   * 権限（ロール）の表示名。この画面ではロールを変えられない（BackendのアカウントAPIがロールを受け取らない）ため、表示だけにする。
   * ロールの変更は、監査ログの残るアカウント・ロール管理で行う。
   */
  const roleLabel = computed<string>(() => resolveAccountRoleLabel(accountForm));

  /** アカウントフォームをパスワード未入力の初期状態へ戻し、取得エラーを破棄する。 */
  const clearForm = (): void => {
    Object.assign(accountForm, createAccountDetailForm());
    loadError.value = "";
  };

  /** アカウント詳細を取得し、パスワードを含まないフォームへ変換する。 */
  const loadAccountDetail = async (): Promise<void> => {
    clearForm();
    if (normalizedAccountId.value === 0) {
      return;
    }

    try {
      const detail = await accountStore.findAccountDetail(normalizedAccountId.value);
      Object.assign(accountForm, createAccountDetailForm(detail));
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearForm);
        return;
      }
      loadError.value = ACCOUNT_MESSAGES.detailLoadFailed;
    }
  };

  const openConfirm = (): void => {
    isShowConfirm.value = true;
  };

  const closeConfirm = (): void => {
    isShowConfirm.value = false;
  };

  /**
   * 確認したアカウント情報を登録または更新する。
   * 失敗したら理由を出す（権限がない403は、入力を直しても保存できないため別の文言にする）。
   * Sessionが切れていた（401）場合は、入力中のパスワードを含むフォームを捨ててログイン画面へ戻す。
   */
  const confirmSubmit = async (): Promise<void> => {
    closeConfirm();
    submitError.value = "";
    try {
      if (accountForm.accountId > 0) {
        await accountStore.updateAccount(
          accountForm.accountId,
          buildAccountUpdateRequest(accountForm)
        );
      } else {
        await accountStore.registerAccount(buildAccountRegisterRequest(accountForm));
      }
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearForm);
        return;
      }
      submitError.value =
        error instanceof AccountApiError && error.status === 403
          ? ACCOUNT_MESSAGES.saveForbidden
          : ACCOUNT_MESSAGES.saveFailed;
    }
  };

  watch(
    normalizedAccountId,
    () => {
      void loadAccountDetail();
    },
    { immediate: true }
  );

  return {
    accountForm,
    clearForm,
    closeConfirm,
    confirmSubmit,
    isLoading,
    isShowConfirm,
    loadError,
    openConfirm,
    roleLabel,
    submitError,
  };
};
