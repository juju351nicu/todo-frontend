import { ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
import type { ProjectTemplate } from "@/features/project/types/projectTemplate";
import { PROJECT_TEMPLATE_ERROR_CODES } from "@/features/project/utils/apiErrors";
import {
  isValidLocalDateInput,
  toLocalDateInputValue,
} from "@/features/project/utils/projectTemplateDate";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  hasApiFieldError,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";

/** Project全体を本人所有TemplateへcaptureするDialog状態を管理する。 */
export const useProjectTemplateCapture = (
  projectId: Readonly<Ref<number>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const userStore = useUserStore();
  const isOpen = ref(false);
  const name = ref("");
  const baseDate = ref(toLocalDateInputValue());
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isSaving = ref(false);

  /** capture Dialogを空の名称と今日の基準日で開く。 */
  const open = (): void => {
    if (disabled.value || isSaving.value) return;
    name.value = "";
    baseDate.value = toLocalDateInputValue();
    errorMessages.value = [];
    successMessage.value = "";
    isOpen.value = true;
  };

  /** 保存中でなければcapture Dialogを閉じる。 */
  const close = (): void => {
    if (!isSaving.value) isOpen.value = false;
  };

  /** ACTIVE Projectのmember・Board・WBS snapshotを本人所有Templateへ保存する。 */
  const capture = async (): Promise<ProjectTemplate | null> => {
    const normalizedName = name.value.trim();
    if (disabled.value || isSaving.value) return null;
    if (!normalizedName || normalizedName.length > 100) {
      errorMessages.value = ["Template名を1〜100文字で入力してください。"];
      return null;
    }
    if (!isValidLocalDateInput(baseDate.value)) {
      errorMessages.value = ["Task日付の基準日を入力してください。"];
      return null;
    }
    isSaving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const created = await ProjectTemplateApi.capture(projectId.value, {
        name: normalizedName,
        baseDate: baseDate.value,
      });
      name.value = "";
      isOpen.value = false;
      successMessage.value = "ProjectをTemplateとして保存しました。";
      return created;
    } catch (error: unknown) {
      if (error instanceof ProjectTemplateApiError && error.status === 401) {
        isOpen.value = false;
        errorMessages.value = [];
        successMessage.value = "";
        userStore.clearSession();
        await router.push({ name: "Login" });
        return null;
      }
      if (!(error instanceof ProjectTemplateApiError)) {
        errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
        return null;
      }
      if (error.status === 403) {
        errorMessages.value = hasApiFieldError(
          error.errorResponse,
          "FEATURE_NOT_ENTITLED",
          "featureCode"
        )
          ? resolveApiErrorMessages(
              error.errorResponse,
              PROJECT_TEMPLATE_ERROR_CODES,
              DISPLAY_MESSAGES.project.template.captureFailed
            )
          : [DISPLAY_MESSAGES.project.template.operationForbidden];
        return null;
      }
      if (error.status === 404) {
        errorMessages.value = [
          DISPLAY_MESSAGES.project.template.resourceNotFound,
        ];
        return null;
      }
      errorMessages.value = resolveApiErrorMessages(
        error.errorResponse,
        PROJECT_TEMPLATE_ERROR_CODES,
        DISPLAY_MESSAGES.project.template.captureFailed
      );
      return null;
    } finally {
      isSaving.value = false;
    }
  };

  return {
    baseDate,
    capture,
    close,
    errorMessages,
    isOpen,
    isSaving,
    name,
    open,
    successMessage,
  };
};
