import { computed, ref, type Ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
import { PROJECT_TEMPLATE_NAME_MAX_LENGTH } from "@/features/project/constants/projectLimits";
import type { ProjectTemplate } from "@/features/project/types/projectTemplate";
import { PROJECT_TEMPLATE_ERROR_CODES } from "@/features/project/utils/apiErrors";
import { isValidLocalDateInput } from "@/features/project/utils/projectTemplateDate";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { hasApiFieldError, resolveApiErrorMessages } from "@/shared/utils/apiError";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 保存Dialogの「Template名」入力欄に付ける`data-project-template-capture`属性の値。
 * 保存に失敗したとき（保存中はdisabledになりフォーカスが外れる）に、名前を直せるようここへ戻す。
 */
export const CAPTURE_NAME_CONTROL = "name";

/** Project全体を本人所有TemplateへcaptureするDialog状態を管理する。 */
export const useProjectTemplateCapture = (
  projectId: Readonly<Ref<number>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const { expireSession } = useSessionExpiry();
  const isOpen = ref(false);
  const name = ref("");
  const baseDate = ref(getBusinessToday());
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isSaving = ref(false);
  /** Template名（trim後1文字以上`PROJECT_TEMPLATE_NAME_MAX_LENGTH`文字以下）と基準日が入力済みで、参照専用・保存中でない場合だけ保存できる。Backendも再検査する。 */
  const canCapture = computed<boolean>(() => {
    const trimmedName = name.value.trim();
    return (
      !disabled.value &&
      !isSaving.value &&
      trimmedName.length > 0 &&
      trimmedName.length <= PROJECT_TEMPLATE_NAME_MAX_LENGTH &&
      baseDate.value.length > 0
    );
  });

  /** capture Dialogを空の名称と今日の基準日で開く。 */
  const open = (): void => {
    if (disabled.value || isSaving.value) return;
    name.value = "";
    baseDate.value = getBusinessToday();
    errorMessages.value = [];
    successMessage.value = "";
    isOpen.value = true;
  };

  /** 保存中でなければcapture Dialogを閉じる。 */
  const close = (): void => {
    if (!isSaving.value) isOpen.value = false;
  };

  /**
   * ACTIVE Projectのmember・Board・WBS snapshotを本人所有Templateへ保存する。
   * 失敗してDialogが開いたままのときは、「Template名」へフォーカスを戻す。
   */
  const capture = async (): Promise<ProjectTemplate | null> => {
    const created = await submitCapture();
    if (created === null && isOpen.value) {
      await focusFirstEnabledElement([`[data-project-template-capture="${CAPTURE_NAME_CONTROL}"]`]);
    }
    return created;
  };

  /** 入力を検証して保存APIを呼び、結果をmessageへ反映する。保存できなかった場合はnullを返す。 */
  const submitCapture = async (): Promise<ProjectTemplate | null> => {
    const normalizedName = name.value.trim();
    if (disabled.value || isSaving.value) return null;
    if (!normalizedName || normalizedName.length > PROJECT_TEMPLATE_NAME_MAX_LENGTH) {
      errorMessages.value = [
        `Template名を1〜${PROJECT_TEMPLATE_NAME_MAX_LENGTH}文字で入力してください。`,
      ];
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
        await expireSession();
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
        errorMessages.value = [DISPLAY_MESSAGES.project.template.resourceNotFound];
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
    canCapture,
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
