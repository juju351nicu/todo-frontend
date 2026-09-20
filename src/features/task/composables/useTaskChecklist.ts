import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TaskChecklistApi, {
  TaskChecklistApiError,
} from "@/features/task/api/taskChecklistApi";
import type { TaskChecklistItem } from "@/features/task/types/taskChecklist";

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
  const errorMessage = ref("");
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
      items.value.length < 50 &&
      newContent.value.trim().length > 0 &&
      newContent.value.trim().length <= 255
  );

  /** Backend共通ErrorResponseから最初の利用者向けメッセージを取得する。 */
  const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof TaskChecklistApiError
      ? error.errorResponse?.fieldErrors?.[0]?.message ?? fallback
      : fallback;

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskChecklistApiError) || error.status !== 401) {
      return false;
    }
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
    errorMessage.value = "";
    successMessage.value = "";
    try {
      items.value = await TaskChecklistApi.findItems(
        projectId.value,
        taskId.value
      );
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "チェックリストを取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /** 404／409後に操作対象を破棄し、最新一覧へ置き換える。 */
  const recoverLatestItems = async (
    error: TaskChecklistApiError,
    fallback: string
  ): Promise<void> => {
    const message = getErrorMessage(error, fallback);
    clearMutationDrafts();
    if (await loadItems()) {
      errorMessage.value = message;
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
    errorMessage.value = "";
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
          "チェックリストが変更されています。最新の一覧を表示しました。"
        );
        return;
      }
      errorMessage.value = getErrorMessage(
        error,
        "チェック項目を追加できませんでした。"
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
    errorMessage.value = "";
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
    if (!item || !content || content.length > 255) {
      errorMessage.value = "チェック項目を1〜255文字で入力してください。";
      return;
    }
    isUpdating.value = true;
    errorMessage.value = "";
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
      await handleMutationError(error, "チェック項目を更新できませんでした。");
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
    errorMessage.value = "";
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
      await handleMutationError(error, "完了状態を更新できませんでした。");
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
    errorMessage.value = "";
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
      await handleMutationError(error, "チェック項目を並び替えできませんでした。");
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
    errorMessage.value = "";
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
      await handleMutationError(error, "チェック項目を削除できませんでした。");
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
        "チェックリストが変更されています。最新の一覧を表示しました。"
      );
      return;
    }
    errorMessage.value = getErrorMessage(error, fallback);
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

  return {
    addItem,
    canAdd,
    cancelDelete,
    cancelEditing,
    completedCount,
    confirmDelete,
    deletingItem,
    editContent,
    editingItemId,
    errorMessage,
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
