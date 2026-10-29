import { computed, reactive, ref, watch, type Ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { MemberApiError } from "@/features/member/api/memberApi";
import { MEMBER_MESSAGES } from "@/features/member/constants/memberMessages";
import { useMemberStore } from "@/features/member/stores/member";
import {
  buildMemberUpsertRequest,
  createMemberDetailForm,
  MEMBER_ROLE_LABELS,
  type MemberDetailForm,
} from "@/features/member/utils/memberForm";
import { isUnauthorizedApiError } from "@/shared/utils/apiError";

/**
 * 会員詳細・登録画面の状態と操作を提供する。
 *
 * @param memberId Routerから受け取った会員ID
 */
export const useMemberDetailPage = (
  memberId: Readonly<Ref<number | undefined>>
) => {
  const memberStore = useMemberStore();
  const { expireSession } = useSessionExpiry();

  const isLoading = computed<boolean>(() => memberStore.isLoading);
  const isShowConfirm = ref(false);
  const loadError = ref("");
  /** 登録・更新に失敗したときの理由。次の保存を始めたときに消す。 */
  const submitError = ref("");
  const memberForm = reactive<MemberDetailForm>(createMemberDetailForm());
  const normalizedMemberId = computed<number>(() => {
    const value = memberId.value ?? 0;
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  /**
   * 会員の権限の表示名。会員画面ではロールを変えられない（Backendの旧会員APIが403で拒否する）ため、表示だけにする。
   * ロールの変更は監査ログの残るアカウント・ロール管理で行う（確認依頼「旧会員APIの認可」2、2026-10-28決定）。
   */
  const roleLabel = computed<string>(
    () => MEMBER_ROLE_LABELS[memberForm.role] ?? String(memberForm.role)
  );

  /** 会員フォームをパスワード未入力の初期状態へ戻し、取得エラーを破棄する。 */
  const clearForm = (): void => {
    Object.assign(memberForm, createMemberDetailForm());
    loadError.value = "";
  };

  /** 会員詳細を取得し、パスワードを含まないフォームへ変換する。 */
  const loadMemberDetail = async (): Promise<void> => {
    clearForm();
    if (normalizedMemberId.value === 0) {
      return;
    }

    try {
      const detail = await memberStore.findMemberDetail(
        normalizedMemberId.value
      );
      Object.assign(memberForm, createMemberDetailForm(detail));
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearForm);
        return;
      }
      loadError.value = MEMBER_MESSAGES.detailLoadFailed;
    }
  };

  const openConfirm = (): void => {
    isShowConfirm.value = true;
  };

  const closeConfirm = (): void => {
    isShowConfirm.value = false;
  };

  /**
   * 確認した会員情報を登録または更新する。
   * 失敗したら理由を出す（権限がない403は、入力を直しても保存できないため別の文言にする）。
   * Sessionが切れていた（401）場合は、入力中のパスワードを含むフォームを捨ててログイン画面へ戻す。
   */
  const confirmSubmit = async (): Promise<void> => {
    closeConfirm();
    submitError.value = "";
    try {
      await memberStore.upsertMemberInfo(buildMemberUpsertRequest(memberForm));
    } catch (error: unknown) {
      if (isUnauthorizedApiError(error)) {
        await expireSession(clearForm);
        return;
      }
      submitError.value =
        error instanceof MemberApiError && error.status === 403
          ? MEMBER_MESSAGES.saveForbidden
          : MEMBER_MESSAGES.saveFailed;
    }
  };

  watch(
    normalizedMemberId,
    () => {
      void loadMemberDetail();
    },
    { immediate: true }
  );

  return {
    clearForm,
    closeConfirm,
    confirmSubmit,
    isLoading,
    isShowConfirm,
    loadError,
    memberForm,
    openConfirm,
    roleLabel,
    submitError,
  };
};
