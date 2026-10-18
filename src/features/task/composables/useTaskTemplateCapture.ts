import { ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TaskTemplateApi, {
  TaskTemplateApiError,
} from "@/features/task/api/taskTemplateApi";
import type { TaskTemplate } from "@/features/task/types/taskTemplate";
import { TASK_TEMPLATE_ERROR_CODES } from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  hasApiFieldError,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";

/** 既存Taskと未完了checklistを本人用Templateへ保存するDialog状態を管理する。 */
export const useTaskTemplateCapture = (
  projectId: Readonly<Ref<number>>,
  taskId: Readonly<Ref<number>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const userStore = useUserStore();
  const isOpen = ref(false);
  const name = ref("");
  const errorMessage = ref("");
  const successMessage = ref("");
  const isSaving = ref(false);

  /** API statusと契約済みerror codeをcapture用の安全な表示文言へ変換する。 */
  const getErrorMessage = (error: unknown): string => {
    if (!(error instanceof TaskTemplateApiError)) {
      return DISPLAY_MESSAGES.common.connectionFailed;
    }
    if (error.status === 403) {
      if (
        !hasApiFieldError(
          error.errorResponse,
          "FEATURE_NOT_ENTITLED",
          "featureCode"
        )
      ) {
        return DISPLAY_MESSAGES.task.template.operationForbidden;
      }
    }
    if (error.status === 404) {
      return DISPLAY_MESSAGES.task.template.resourceNotFound;
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      TASK_TEMPLATE_ERROR_CODES,
      DISPLAY_MESSAGES.task.template.captureFailed
    ).join("\n");
  };

  /** 認証切れ時にTask由来の入力と結果を破棄し、Loginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskTemplateApiError) || error.status !== 401) {
      return false;
    }
    name.value = "";
    isOpen.value = false;
    errorMessage.value = "";
    successMessage.value = "";
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** capture Dialogを空の入力状態で開く。 */
  const open = (): void => {
    if (disabled.value || isSaving.value) return;
    name.value = "";
    errorMessage.value = "";
    successMessage.value = "";
    isOpen.value = true;
  };

  /** 保存中でなければcapture Dialogを閉じる。 */
  const close = (): void => {
    if (!isSaving.value) isOpen.value = false;
  };

  /** Task snapshotをtrim済み名称で本人用Templateへ保存する。 */
  const capture = async (): Promise<TaskTemplate | null> => {
    const normalizedName = name.value.trim();
    if (disabled.value || isSaving.value) return null;
    if (!normalizedName || normalizedName.length > 100) {
      errorMessage.value = "Template名を1〜100文字で入力してください。";
      return null;
    }
    isSaving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const created = await TaskTemplateApi.capture(
        projectId.value,
        taskId.value,
        { name: normalizedName }
      );
      name.value = "";
      isOpen.value = false;
      successMessage.value = "TaskをTemplateとして保存しました。";
      return created;
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return null;
      errorMessage.value = getErrorMessage(error);
      return null;
    } finally {
      isSaving.value = false;
    }
  };

  return {
    capture,
    close,
    errorMessage,
    isOpen,
    isSaving,
    name,
    open,
    successMessage,
  };
};
