import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TaskChecklistApi, {
  TaskChecklistApiError,
} from "@/features/task/api/taskChecklistApi";
import type { TaskChecklistItem } from "@/features/task/types/taskChecklist";
import {
  TASK_CHECKLIST_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

/** チェック項目本文の最大文字数（trim後）。Backendの入力制約と同じ値。 */
export const CHECKLIST_ITEM_MAX_LENGTH = 255;

/** 1 Taskに登録できるチェック項目の最大件数。Backendの入力制約と同じ値。 */
export const CHECKLIST_ITEM_MAX_COUNT = 50;

/** trim後1文字以上、最大文字数以下のチェック項目本文か。 */
const isValidChecklistContent = (content: string): boolean => {
  const trimmedContent = content.trim();
  return trimmedContent.length > 0 && trimmedContent.length <= CHECKLIST_ITEM_MAX_LENGTH;
};

/**
 * Task詳細内のchecklist取得・追加・更新・並び替え・削除を扱う。
 * 404／409では取得時点versionを破棄し、Backendの最新一覧へ回復する。
 */
export const useTaskChecklist = (
  projectId: Readonly<Ref<number | null>>,
  taskId: Readonly<Ref<number | null>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const items = ref<TaskChecklistItem[]>([]);
  const newContent = ref("");
  const editingItemId = ref<number | null>(null);
  const editContent = ref("");
  const deletingItem = ref<TaskChecklistItem | null>(null);
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const isReordering = ref(false);
  const isMutating = computed(
    () =>
      isCreating.value ||
      isUpdating.value ||
      isDeleting.value ||
      isReordering.value
  );
  const completedCount = computed(
    () => items.value.filter((item) => item.completed).length
  );
  const canAdd = computed(
    () =>
      !disabled.value &&
      !isMutating.value &&
      items.value.length < CHECKLIST_ITEM_MAX_COUNT &&
      isValidChecklistContent(newContent.value)
  );
  /** 完了済み項目の割合（0～100の整数）。項目がない場合は0。 */
  const progressPercent = computed<number>(() =>
    items.value.length === 0 ? 0 : Math.round((completedCount.value / items.value.length) * 100)
  );
  /** 編集中の本文が有効で、他の更新中でない場合だけ保存できる。 */
  const canSaveEdit = computed<boolean>(() => isValidChecklistContent(editContent.value) && !isMutating.value);

  /** API statusと契約済みerror codeを利用者向けメッセージへ変換する。 */
  const getErrorMessages = (
    error: unknown,
    fallback: string,
    forbidden: string = DISPLAY_MESSAGES.task.checklist.operationForbidden
  ): string[] => {
    if (!(error instanceof TaskChecklistApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.checklist.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      TASK_CHECKLIST_ERROR_CODES,
      fallback
    );
  };

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskChecklistApiError) || error.status !== 401) {
      return false;
    }
    items.value = [];
    clearMutationDrafts();
    errorMessages.value = [];
    successMessage.value = "";
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** 編集・削除対象を破棄し、古いversionを再利用できない状態へ戻す。 */
  const clearMutationDrafts = (): void => {
    editingItemId.value = null;
    editContent.value = "";
    deletingItem.value = null;
  };

  /** Task IDが有効なときだけchecklistを取得する。 */
  const loadItems = async (): Promise<boolean> => {
    if (projectId.value === null || taskId.value === null) {
      items.value = [];
      return false;
    }
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      items.value = await TaskChecklistApi.findItems(
        projectId.value,
        taskId.value
      );
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskChecklistApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          items.value = [];
          clearMutationDrafts();
        }
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.checklist.loadFailed,
          DISPLAY_MESSAGES.task.checklist.readForbidden
        );
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 404／409後に操作対象を破棄し、最新一覧へ置き換える。
   * 再取得に成功したら、Backendの文言（「最新状態を取得してください」等）の後ろに再取得済みの案内を添える。
   * 画面はすでに最新一覧を表示しているので、利用者が手動で再読込しなくてよいと分かるようにするため。
   */
  const recoverLatestItems = async (
    error: TaskChecklistApiError,
    fallback: string
  ): Promise<void> => {
    const currentProjectId = projectId.value;
    const currentTaskId = taskId.value;
    if (currentProjectId === null || currentTaskId === null) {
      items.value = [];
      clearMutationDrafts();
      return;
    }
    const mutationMessages = getErrorMessages(error, fallback);
    clearMutationDrafts();
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      items.value = await TaskChecklistApi.findItems(
        currentProjectId,
        currentTaskId
      );
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.checklist.conflictReloaded,
      ];
    } catch (reloadError: unknown) {
      if (await handleUnauthorized(reloadError)) {
        return;
      }
      if (
        reloadError instanceof TaskChecklistApiError &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
      ) {
        if (reloadError.status === 403 || reloadError.status === 404) {
          items.value = [];
        }
        errorMessages.value = getErrorMessages(
          reloadError,
          DISPLAY_MESSAGES.task.checklist.reloadFailed,
          DISPLAY_MESSAGES.task.checklist.readForbidden
        );
        return;
      }
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.checklist.reloadFailed,
      ];
    } finally {
      isLoading.value = false;
    }
  };

  /** 入力本文をtrimしてTask末尾へchecklist itemを追加する。 */
  const addItem = async (): Promise<void> => {
    if (
      !canAdd.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return;
    }
    isCreating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      items.value.push(
        await TaskChecklistApi.createItem(projectId.value, taskId.value, {
          content: newContent.value.trim(),
        })
      );
      newContent.value = "";
      successMessage.value = "チェック項目を追加しました。";
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      if (
        error instanceof TaskChecklistApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        await recoverLatestItems(
          error,
          DISPLAY_MESSAGES.task.checklist.conflictFallback
        );
        return;
      }
      errorMessages.value = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.checklist.createFailed
      );
    } finally {
      isCreating.value = false;
    }
  };

  /** checklist itemの本文編集を開始する。 */
  const startEditing = (item: TaskChecklistItem): void => {
    if (disabled.value || isMutating.value) return;
    deletingItem.value = null;
    editingItemId.value = item.checklistItemId;
    editContent.value = item.content;
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 未送信の本文編集を破棄する。 */
  const cancelEditing = (): void => {
    editingItemId.value = null;
    editContent.value = "";
  };

  /** Backend確定Responseで対象itemを置き換える。 */
  const replaceItem = (updated: TaskChecklistItem): void => {
    items.value = items.value.map((item) =>
      item.checklistItemId === updated.checklistItemId ? updated : item
    );
  };

  /** 取得時点versionを使用して本文を更新する。 */
  const saveEdit = async (): Promise<void> => {
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null ||
      editingItemId.value === null
    ) {
      return;
    }
    const item = items.value.find(
      (candidate) => candidate.checklistItemId === editingItemId.value
    );
    const content = editContent.value.trim();
    if (!item || !content || content.length > CHECKLIST_ITEM_MAX_LENGTH) {
      errorMessages.value = ["チェック項目を1〜255文字で入力してください。"];
      return;
    }
    isUpdating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      replaceItem(
        await TaskChecklistApi.updateItem(
          projectId.value,
          taskId.value,
          item.checklistItemId,
          { content, completed: item.completed, version: item.version }
        )
      );
      cancelEditing();
      successMessage.value = "チェック項目を更新しました。";
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.updateFailed
      );
    } finally {
      isUpdating.value = false;
    }
  };

  /** 取得時点versionを使用して完了状態を反転する。 */
  const toggleItem = async (item: TaskChecklistItem): Promise<void> => {
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return;
    }
    isUpdating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      replaceItem(
        await TaskChecklistApi.updateItem(
          projectId.value,
          taskId.value,
          item.checklistItemId,
          {
            content: item.content,
            completed: !item.completed,
            version: item.version,
          }
        )
      );
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.toggleFailed
      );
    } finally {
      isUpdating.value = false;
    }
  };

  /** itemを上下へ1件移動し、全itemのID・versionを送信する。 */
  const moveItem = async (
    item: TaskChecklistItem,
    direction: -1 | 1
  ): Promise<void> => {
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return;
    }
    const index = items.value.findIndex(
      (candidate) => candidate.checklistItemId === item.checklistItemId
    );
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= items.value.length) {
      return;
    }
    const reordered = [...items.value];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    isReordering.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      items.value = await TaskChecklistApi.reorderItems(
        projectId.value,
        taskId.value,
        {
          items: reordered.map((candidate) => ({
            checklistItemId: candidate.checklistItemId,
            version: candidate.version,
          })),
        }
      );
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.reorderFailed
      );
    } finally {
      isReordering.value = false;
    }
  };

  /** 削除確認対象を保持する。 */
  const openDeleteConfirm = (item: TaskChecklistItem): void => {
    if (disabled.value || isMutating.value) return;
    cancelEditing();
    deletingItem.value = item;
  };

  /** 削除確認を閉じる。 */
  const cancelDelete = (): void => {
    deletingItem.value = null;
  };

  /** 確認対象を取得時点version付きで削除する。 */
  const confirmDelete = async (): Promise<void> => {
    const item = deletingItem.value;
    if (
      !item ||
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return;
    }
    isDeleting.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await TaskChecklistApi.deleteItem(
        projectId.value,
        taskId.value,
        item.checklistItemId,
        item.version
      );
      items.value = items.value.filter(
        (candidate) => candidate.checklistItemId !== item.checklistItemId
      );
      cancelDelete();
      successMessage.value = "チェック項目を削除しました。";
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.deleteFailed
      );
    } finally {
      isDeleting.value = false;
    }
  };

  /** 更新系APIの401と競合回復を共通処理する。 */
  async function handleMutationError(
    error: unknown,
    fallback: string
  ): Promise<void> {
    if (await handleUnauthorized(error)) return;
    if (
      error instanceof TaskChecklistApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      await recoverLatestItems(
        error,
        DISPLAY_MESSAGES.task.checklist.conflictFallback
      );
      return;
    }
    errorMessages.value = getErrorMessages(error, fallback);
  }

  watch(
    [projectId, taskId],
    () => {
      clearMutationDrafts();
      newContent.value = "";
      void loadItems();
    },
    { immediate: true }
  );

  /** 削除確認dialogが閉じられた場合に削除対象を破棄する。 */
  const handleDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelDelete();
    }
  };

  return {
    canSaveEdit,
    handleDeleteDialogVisibility,
    progressPercent,
    addItem,
    canAdd,
    cancelDelete,
    cancelEditing,
    completedCount,
    confirmDelete,
    deletingItem,
    editContent,
    editingItemId,
    errorMessages,
    isCreating,
    isDeleting,
    isLoading,
    isMutating,
    isReordering,
    isUpdating,
    items,
    loadItems,
    moveItem,
    newContent,
    openDeleteConfirm,
    saveEdit,
    startEditing,
    successMessage,
    toggleItem,
  };
};
