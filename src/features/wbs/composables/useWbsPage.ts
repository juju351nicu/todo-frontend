import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  WbsResponse,
  WbsTask,
  WbsTaskEditForm,
} from "@/features/wbs/types/wbs";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";

/**
 * WBS画面の読込、階層変換、Task編集、競合回復、認証エラーとBoard遷移を管理する。
 * Boardと同じTaskを正本とし、更新成功・409競合後はBackendのWBS全体で表示を作り直す。
 */
export const useWbsPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const editingTask = ref<WbsTask | null>(null);
  const editorErrorMessages = ref<string[]>([]);
  const errorMessages = ref<string[]>([]);
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const successMessage = ref("");
  const wbs = ref<WbsResponse | null>(null);

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const rows = computed(() => buildWbsTreeRows(wbs.value?.tasks ?? []));
  const taskCount = computed(
    () => rows.value.filter((row) => row.taskType === "TASK").length
  );
  const summaryCount = computed(
    () => rows.value.filter((row) => row.taskType === "SUMMARY").length
  );
  const milestoneCount = computed(
    () => rows.value.filter((row) => row.taskType === "MILESTONE").length
  );
  const canEditWbs = computed(() => userStore.hasPermission("TASK_UPDATE"));
  const parentOptions = computed(() =>
    editingTask.value === null
      ? []
      : buildWbsParentOptions(
          wbs.value?.tasks ?? [],
          editingTask.value.taskId
        )
  );

  /** WBS API Responseを唯一の画面スナップショットとして差し替える。 */
  const loadWbs = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    wbs.value = await WbsApi.getWbs(projectId.value);
  };

  /** Project IDを検証し、WBSをBackendの最新Responseへ置き換える。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    if (projectId.value === null) {
      wbs.value = null;
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      await loadWbs();
    } catch (error: unknown) {
      wbs.value = null;
      await handleReadApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS APIのstatusを、認証状態を含む参照画面の案内へ変換する。 */
  const handleReadApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["WBSを参照するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [
        "Projectが見つからないか、このProjectへ参加していません。",
      ];
      return;
    }
    errorMessages.value = ["WBSを取得できませんでした。"];
  };

  /** TASK_UPDATEを持つ利用者だけに、取得済みTaskの編集Dialogを開く。 */
  const openTaskEditor = (taskId: number): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canEditWbs.value) {
      errorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const task = wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) {
      errorMessages.value = ["編集対象のTaskが見つかりません。"];
      return;
    }
    editingTask.value = { ...task };
    editorErrorMessages.value = [];
    isEditorOpen.value = true;
  };

  /** 保存中でない場合だけ未確定のWBS入力を破棄してDialogを閉じる。 */
  const closeTaskEditor = (): void => {
    if (!isSaving.value) {
      closeTaskEditorAfterSaving();
    }
  };

  /** 更新成功・競合・Session失効時に、保存中でも古いversionを破棄する。 */
  const closeTaskEditorAfterSaving = (): void => {
    isEditorOpen.value = false;
    editingTask.value = null;
    editorErrorMessages.value = [];
  };

  /**
   * 検証済みフォームをWBS更新APIへ送り、成功時はResponse全体で画面を更新する。
   * 409競合では古いDialogを閉じ、最新WBSを再取得して再編集を促す。
   *
   * @param form WBS Task編集Dialogの入力値と取得時点version
   */
  const saveWbsTask = async (form: WbsTaskEditForm): Promise<void> => {
    const currentTask = editingTask.value;
    if (
      isSaving.value ||
      currentTask === null ||
      projectId.value === null
    ) {
      return;
    }
    if (!canEditWbs.value) {
      editorErrorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const validationMessages = validateWbsTaskEditForm(form);
    if (validationMessages.length > 0) {
      editorErrorMessages.value = validationMessages;
      return;
    }

    isSaving.value = true;
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    try {
      wbs.value = await WbsApi.updateWbsTask(
        projectId.value,
        currentTask.taskId,
        buildWbsTaskUpdateRequest(form)
      );
      closeTaskEditorAfterSaving();
      successMessage.value = "WBS Taskを更新しました。";
    } catch (error: unknown) {
      if (error instanceof WbsApiError && error.status === 409) {
        const conflictMessages = getFieldErrorMessages(error);
        closeTaskEditorAfterSaving();
        errorMessages.value =
          conflictMessages.length > 0
            ? conflictMessages
            : ["WBSが他の操作で更新されました。最新情報を確認してください。"];
        await reloadWbsAfterConflict();
      } else {
        await handleUpdateApiError(error);
      }
    } finally {
      isSaving.value = false;
    }
  };

  /** 409競合後に最新WBSを取得し、古い親関係とversionを画面へ残さない。 */
  const reloadWbsAfterConflict = async (): Promise<void> => {
    try {
      await loadWbs();
    } catch (_error: unknown) {
      errorMessages.value.push("最新のWBSを再取得できませんでした。再読込してください。");
    }
  };

  /** Backend項目エラーから空文字を除いた利用者向けメッセージを取り出す。 */
  const getFieldErrorMessages = (error: WbsApiError): string[] =>
    (error.errorResponse?.fieldErrors ?? [])
      .map((fieldError) => fieldError.message)
      .filter((message) => message.trim().length > 0);

  /** WBS更新APIのstatusと項目エラーを、DialogまたはSession動作へ変換する。 */
  const handleUpdateApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      editorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeTaskEditorAfterSaving();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      editorErrorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      editorErrorMessages.value = ["対象のProjectまたはTaskが見つかりません。"];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    editorErrorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["WBS Taskを更新できませんでした。"];
  };

  /** 現在のProject IDを保持したままTask Boardへ遷移する。 */
  const openBoard = async (): Promise<void> => {
    if (projectId.value === null) {
      return;
    }
    await router.push({
      name: "TaskBoard",
      params: { projectId: projectId.value },
    });
  };

  return {
    canEditWbs,
    closeTaskEditor,
    editingTask,
    editorErrorMessages,
    errorMessages,
    initialize,
    isEditorOpen,
    isLoading,
    isSaving,
    milestoneCount,
    openBoard,
    openTaskEditor,
    parentOptions,
    projectId,
    rows,
    saveWbsTask,
    successMessage,
    summaryCount,
    taskCount,
    wbs,
  };
};
