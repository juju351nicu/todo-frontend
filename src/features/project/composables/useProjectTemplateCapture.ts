import { ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
import type { ProjectTemplate } from "@/features/project/types/projectTemplate";
import {
  isValidLocalDateInput,
  toLocalDateInputValue,
} from "@/features/project/utils/projectTemplateDate";

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
  const errorMessage = ref("");
  const successMessage = ref("");
  const isSaving = ref(false);

  /** capture Dialogを空の名称と今日の基準日で開く。 */
  const open = (): void => {
    if (disabled.value || isSaving.value) return;
    name.value = "";
    baseDate.value = toLocalDateInputValue();
    errorMessage.value = "";
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
      errorMessage.value = "Template名を1〜100文字で入力してください。";
      return null;
    }
    if (!isValidLocalDateInput(baseDate.value)) {
      errorMessage.value = "Task日付の基準日を入力してください。";
      return null;
    }
    isSaving.value = true;
    errorMessage.value = "";
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
        userStore.clearSession();
        await router.push({ name: "Login" });
        return null;
      }
      errorMessage.value =
        error instanceof ProjectTemplateApiError
          ? error.errorResponse?.fieldErrors?.[0]?.message ??
            "ProjectをTemplateとして保存できませんでした。"
          : "ProjectをTemplateとして保存できませんでした。";
      return null;
    } finally {
      isSaving.value = false;
    }
  };

  return {
    baseDate,
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
