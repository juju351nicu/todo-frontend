import { computed, ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import type { TaskPriority } from "@/features/project/types/project";
import TaskTemplateApi, {
  TaskTemplateApiError,
} from "@/features/task/api/taskTemplateApi";
import type {
  TaskTemplate,
  TaskTemplateApplyResponse,
  TaskTemplateUpdateRequest,
} from "@/features/task/types/taskTemplate";

/** Task Template編集Dialogが保持する入力値。 */
export interface TaskTemplateEditForm {
  name: string;
  title: string;
  detail: string;
  priority: TaskPriority;
  dueOffsetDays: number;
  plannedEffortMinutes: number;
  defaultStatusCode: string;
  defaultAssigneeAccountId: number | null;
  checklistContents: string[];
  version: number;
}

/** ブラウザーのローカル日付をdate input用のyyyy-MM-ddへ変換する。 */
const getToday = (): string => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

/** 空のTemplate編集フォームを作る。 */
const createEmptyEditForm = (): TaskTemplateEditForm => ({
  name: "",
  title: "",
  detail: "",
  priority: 2,
  dueOffsetDays: 0,
  plannedEffortMinutes: 0,
  defaultStatusCode: "",
  defaultAssigneeAccountId: null,
  checklistContents: [],
  version: 0,
});

/**
 * 本人所有Task Templateの一覧・編集・archive・Project適用を管理する。
 * 404／409では古い選択とversionを破棄し、最新一覧へ回復する。
 */
export const useTaskTemplates = (
  projectId: Readonly<Ref<number | null>>
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const templates = ref<TaskTemplate[]>([]);
  const selectedTemplateId = ref<number | null>(null);
  const isEditing = ref(false);
  const editForm = ref<TaskTemplateEditForm>(createEmptyEditForm());
  const applyDateFrom = ref(getToday());
  const applyAssigneeAccountId = ref<number | null>(null);
  const applyTaskStatusId = ref<number | null>(null);
  const errorMessage = ref("");
  const successMessage = ref("");
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isArchiving = ref(false);
  const isApplying = ref(false);
  const isMutating = computed(
    () => isSaving.value || isArchiving.value || isApplying.value
  );
  const selectedTemplate = computed(
    () =>
      templates.value.find(
        (template) => template.taskTemplateId === selectedTemplateId.value
      ) ?? null
  );

  /** Backend共通ErrorResponseから最初の利用者向けメッセージを取得する。 */
  const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof TaskTemplateApiError
      ? error.errorResponse?.fieldErrors?.[0]?.message ?? fallback
      : fallback;

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskTemplateApiError) || error.status !== 401) {
      return false;
    }
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** Template一覧を再取得し、存在しない選択・編集状態を破棄する。 */
  const loadTemplates = async (): Promise<boolean> => {
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      templates.value = await TaskTemplateApi.findOwnTemplates();
      if (
        selectedTemplateId.value !== null &&
        !templates.value.some(
          (template) => template.taskTemplateId === selectedTemplateId.value
        )
      ) {
        selectedTemplateId.value = null;
        isEditing.value = false;
      }
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "Task Templateを取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /** 一覧からTemplateを選択し、適用上書き値と編集中のdraftを初期化する。 */
  const selectTemplate = (template: TaskTemplate): void => {
    if (isMutating.value) return;
    selectedTemplateId.value = template.taskTemplateId;
    applyDateFrom.value = getToday();
    applyAssigneeAccountId.value = null;
    applyTaskStatusId.value = null;
    isEditing.value = false;
    editForm.value = createEmptyEditForm();
    errorMessage.value = "";
    successMessage.value = "";
  };

  /** 選択Templateのsnapshotを独立した編集フォームへ複製する。 */
  const beginEditing = (): void => {
    const template = selectedTemplate.value;
    if (!template || isMutating.value) return;
    editForm.value = {
      name: template.name,
      title: template.title,
      detail: template.detail,
      priority: template.priority,
      dueOffsetDays: template.dueOffsetDays,
      plannedEffortMinutes: template.plannedEffortMinutes,
      defaultStatusCode: template.defaultStatusCode,
      defaultAssigneeAccountId: template.defaultAssigneeAccountId,
      checklistContents: template.checklistItems.map((item) => item.content),
      version: template.version,
    };
    isEditing.value = true;
    errorMessage.value = "";
    successMessage.value = "";
  };

  /** 未送信のTemplate編集内容を破棄する。 */
  const cancelEditing = (): void => {
    isEditing.value = false;
    editForm.value = createEmptyEditForm();
  };

  /** 編集フォームをBackend契約に合わせて検証する。 */
  const validateEditForm = (): boolean => {
    const form = editForm.value;
    const checklistContents = form.checklistContents.map((content) =>
      content.trim()
    );
    let message = "";
    if (!form.name.trim() || form.name.trim().length > 100) {
      message = "Template名を1〜100文字で入力してください。";
    } else if (!form.title.trim() || form.title.trim().length > 45) {
      message = "Taskタイトルを1〜45文字で入力してください。";
    } else if (!form.detail.trim() || form.detail.trim().length > 1000) {
      message = "Task詳細を1〜1000文字で入力してください。";
    } else if (
      !Number.isInteger(form.dueOffsetDays) ||
      form.dueOffsetDays < 0 ||
      form.dueOffsetDays > 365
    ) {
      message = "期限オフセットを0〜365日で入力してください。";
    } else if (
      !Number.isSafeInteger(form.plannedEffortMinutes) ||
      form.plannedEffortMinutes < 0
    ) {
      message = "予定工数を0分以上の整数で入力してください。";
    } else if (!form.defaultStatusCode) {
      message = "既定のBoard列を選択してください。";
    } else if (
      checklistContents.length > 50 ||
      checklistContents.some(
        (content) => content.length === 0 || content.length > 255
      )
    ) {
      message = "チェック項目は1〜255文字、最大50件で入力してください。";
    }
    errorMessage.value = message;
    return !message;
  };

  /** 編集フォームから全置換Requestを組み立てる。 */
  const buildUpdateRequest = (): TaskTemplateUpdateRequest => ({
    name: editForm.value.name.trim(),
    title: editForm.value.title.trim(),
    detail: editForm.value.detail.trim(),
    priority: editForm.value.priority,
    dueOffsetDays: editForm.value.dueOffsetDays,
    plannedEffortMinutes: editForm.value.plannedEffortMinutes,
    defaultStatusCode: editForm.value.defaultStatusCode,
    defaultAssigneeAccountId: editForm.value.defaultAssigneeAccountId,
    checklistItems: editForm.value.checklistContents.map((content) => ({
      content: content.trim(),
    })),
    version: editForm.value.version,
  });

  /** Template snapshotを取得時点version付きで更新する。 */
  const saveTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (
      !template ||
      isMutating.value ||
      !validateEditForm()
    ) {
      return;
    }
    isSaving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const updated = await TaskTemplateApi.update(
        template.taskTemplateId,
        buildUpdateRequest()
      );
      templates.value = templates.value.map((candidate) =>
        candidate.taskTemplateId === updated.taskTemplateId
          ? updated
          : candidate
      );
      cancelEditing();
      successMessage.value = "Task Templateを更新しました。";
    } catch (error: unknown) {
      await handleMutationError(error, "Task Templateを更新できませんでした。");
    } finally {
      isSaving.value = false;
    }
  };

  /** 選択Templateをversion条件付きでarchiveする。 */
  const archiveTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (!template || isMutating.value) return;
    isArchiving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      await TaskTemplateApi.archive(
        template.taskTemplateId,
        template.version
      );
      templates.value = templates.value.filter(
        (candidate) => candidate.taskTemplateId !== template.taskTemplateId
      );
      selectedTemplateId.value = null;
      cancelEditing();
      successMessage.value = "Task Templateをアーカイブしました。";
    } catch (error: unknown) {
      await handleMutationError(
        error,
        "Task Templateをアーカイブできませんでした。"
      );
    } finally {
      isArchiving.value = false;
    }
  };

  /** 選択Templateを任意上書き値付きでProjectへ適用する。 */
  const applyTemplate = async (): Promise<TaskTemplateApplyResponse | null> => {
    const template = selectedTemplate.value;
    if (
      !template ||
      isMutating.value ||
      projectId.value === null
    ) {
      return null;
    }
    isApplying.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const created = await TaskTemplateApi.apply(projectId.value, {
        taskTemplateId: template.taskTemplateId,
        dateFrom: applyDateFrom.value || null,
        assigneeAccountId: applyAssigneeAccountId.value,
        taskStatusId: applyTaskStatusId.value,
      });
      successMessage.value = "TemplateからTaskを登録しました。";
      return created;
    } catch (error: unknown) {
      await handleMutationError(
        error,
        "Task TemplateをProjectへ適用できませんでした。"
      );
      return null;
    } finally {
      isApplying.value = false;
    }
  };

  /** 更新系APIの401と404／409再取得を共通処理する。 */
  async function handleMutationError(
    error: unknown,
    fallback: string
  ): Promise<void> {
    if (await handleUnauthorized(error)) return;
    if (
      error instanceof TaskTemplateApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      const message = getErrorMessage(
        error,
        "Task Templateが変更されています。最新の一覧を表示しました。"
      );
      cancelEditing();
      if (await loadTemplates()) errorMessage.value = message;
      return;
    }
    errorMessage.value = getErrorMessage(error, fallback);
  }

  return {
    applyAssigneeAccountId,
    applyDateFrom,
    applyTaskStatusId,
    applyTemplate,
    archiveTemplate,
    beginEditing,
    cancelEditing,
    editForm,
    errorMessage,
    isApplying,
    isArchiving,
    isEditing,
    isLoading,
    isMutating,
    isSaving,
    loadTemplates,
    saveTemplate,
    selectTemplate,
    selectedTemplate,
    selectedTemplateId,
    successMessage,
    templates,
  };
};
