import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import {
  createTaskSavedView,
  deleteTaskSavedView,
  getTaskSavedViews,
  getTaskSearchOptions,
  searchTasks,
  TaskSearchApiError,
  updateTaskSavedView,
} from "@/features/task/api/taskSearchApi";
import type {
  TaskSavedView,
  TaskSearchColumn,
  TaskSearchFilters,
  TaskSearchItem,
  TaskSearchOptionsResponse,
  TaskSearchSavedFilters,
} from "@/features/task/types/taskSearch";

interface TaskSearchColumnOption {
  code: TaskSearchColumn;
  label: string;
}

const DEFAULT_VISIBLE_COLUMNS: TaskSearchColumn[] = [
  "PROJECT",
  "STATUS",
  "ASSIGNEE",
  "PRIORITY",
  "DUE_DATE",
  "PROGRESS",
];

const COLUMN_OPTIONS: TaskSearchColumnOption[] = [
  { code: "PROJECT", label: "Project" },
  { code: "STATUS", label: "状態" },
  { code: "ASSIGNEE", label: "担当者" },
  { code: "PRIORITY", label: "優先度" },
  { code: "START_DATE", label: "開始日" },
  { code: "DUE_DATE", label: "期限" },
  { code: "PROGRESS", label: "進捗" },
  { code: "DETAIL", label: "説明" },
];

/** 絞り込みなしのTask検索条件を新しいobjectとして生成する。 */
const createEmptyFilters = (): TaskSearchFilters => ({
  keyword: "",
  projectId: null,
  assigneeAccountId: null,
  statusCode: null,
  dueFrom: null,
  dueTo: null,
  priority: null,
});

/** Backend Responseまたは初期値を画面のreactive検索条件へコピーする。 */
const copyFilters = (
  target: TaskSearchFilters,
  source: TaskSearchFilters | TaskSearchSavedFilters
): void => {
  target.keyword = source.keyword ?? "";
  target.projectId = source.projectId;
  target.assigneeAccountId = source.assigneeAccountId;
  target.statusCode = source.statusCode;
  target.dueFrom = source.dueFrom;
  target.dueTo = source.dueTo;
  target.priority = source.priority;
};

/** Project横断検索、検索候補、本人Saved Viewの画面状態と操作を提供する。 */
export const useTaskSearchPage = () => {
  const router = useRouter();
  const userStore = useUserStore();
  const filters = reactive<TaskSearchFilters>(createEmptyFilters());
  const options = ref<TaskSearchOptionsResponse>({
    projects: [],
    assignees: [],
    statuses: [],
  });
  const tasks = ref<TaskSearchItem[]>([]);
  const businessDate = ref("");
  const truncated = ref(false);
  const savedViews = ref<TaskSavedView[]>([]);
  const selectedSavedViewId = ref<number | null>(null);
  const savedViewName = ref("");
  const visibleColumns = ref<TaskSearchColumn[]>([
    ...DEFAULT_VISIBLE_COLUMNS,
  ]);
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isInitializing = ref(false);
  const isSearching = ref(false);
  const isOptionsLoading = ref(false);
  const isSavedViewMutating = ref(false);
  const isDeleteConfirmationOpen = ref(false);

  const activeSavedView = computed(
    () =>
      savedViews.value.find(
        (view) => view.savedViewId === selectedSavedViewId.value
      ) ?? null
  );
  const isBusy = computed(
    () =>
      isInitializing.value ||
      isSearching.value ||
      isOptionsLoading.value ||
      isSavedViewMutating.value
  );

  const setError = (message: string): void => {
    errorMessages.value = [message];
    successMessage.value = "";
  };

  /** 401ではSession表示を破棄してLoginへ戻し、それ以外はBackendの先頭メッセージを表示する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (error instanceof TaskSearchApiError) {
      if (error.status === 401) {
        userStore.clearSession();
        await router.push({ name: "Login" });
        return;
      }
      setError(
        error.errorResponse?.fieldErrors?.[0]?.message ?? fallbackMessage
      );
      return;
    }
    setError("Backendへ接続できませんでした。");
  };

  /** 検索結果をBackendの確定Responseで置き換える。二重検索中は新しいRequestを送らない。 */
  const executeSearch = async (): Promise<void> => {
    if (isSearching.value) return;
    if (filters.dueFrom && filters.dueTo && filters.dueTo < filters.dueFrom) {
      setError("期限の終了日は開始日以降にしてください。");
      return;
    }
    isSearching.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const response = await searchTasks({ ...filters });
      tasks.value = response.tasks ?? [];
      businessDate.value = response.businessDate;
      truncated.value = response.truncated;
    } catch (error: unknown) {
      await handleApiError(error, "Taskを検索できませんでした。");
    } finally {
      isSearching.value = false;
    }
  };

  /** Project選択に応じた担当者・状態候補を再取得し、利用できない現在値を解除する。 */
  const refreshOptions = async (preserveSelection = false): Promise<void> => {
    if (isOptionsLoading.value) return;
    isOptionsLoading.value = true;
    try {
      const response = await getTaskSearchOptions(filters.projectId);
      options.value = response;
      if (!preserveSelection) {
        const assigneeExists = response.assignees.some(
          (item) => item.accountId === filters.assigneeAccountId
        );
        const statusExists = response.statuses.some(
          (item) => item.statusCode === filters.statusCode
        );
        if (!assigneeExists) filters.assigneeAccountId = null;
        if (!statusExists) filters.statusCode = null;
      }
    } catch (error: unknown) {
      await handleApiError(error, "検索候補を取得できませんでした。");
    } finally {
      isOptionsLoading.value = false;
    }
  };

  /** 初期表示で検索候補・Saved View・絞り込みなし検索を並行取得する。 */
  const initialize = async (): Promise<void> => {
    if (isInitializing.value) return;
    isInitializing.value = true;
    errorMessages.value = [];
    try {
      const [optionResponse, viewResponse, searchResponse] = await Promise.all([
        getTaskSearchOptions(filters.projectId),
        getTaskSavedViews(),
        searchTasks({ ...filters }),
      ]);
      options.value = optionResponse;
      savedViews.value = viewResponse;
      tasks.value = searchResponse.tasks ?? [];
      businessDate.value = searchResponse.businessDate;
      truncated.value = searchResponse.truncated;
    } catch (error: unknown) {
      await handleApiError(error, "Task検索画面を初期化できませんでした。");
    } finally {
      isInitializing.value = false;
    }
  };

  /** Project変更後に担当者・状態を解除し、そのProjectの候補を読み直す。 */
  const changeProject = async (projectId: number | null): Promise<void> => {
    filters.projectId = projectId;
    filters.assigneeAccountId = null;
    filters.statusCode = null;
    await refreshOptions();
  };

  /** Saved View条件・表示列を画面へ復元し、Project候補更新後に検索する。 */
  const applySavedView = async (savedViewId: number | null): Promise<void> => {
    selectedSavedViewId.value = savedViewId;
    const view = savedViews.value.find(
      (item) => item.savedViewId === savedViewId
    );
    if (!view) return;
    savedViewName.value = view.name;
    copyFilters(filters, view.filters);
    visibleColumns.value = [...view.visibleColumns];
    await refreshOptions(true);
    await executeSearch();
  };

  /** 絞り込みと表示列を初期値へ戻し、全Project候補と検索結果を再取得する。 */
  const resetSearch = async (): Promise<void> => {
    copyFilters(filters, createEmptyFilters());
    visibleColumns.value = [...DEFAULT_VISIBLE_COLUMNS];
    selectedSavedViewId.value = null;
    savedViewName.value = "";
    await refreshOptions();
    await executeSearch();
  };

  /** 409・404後に本人Saved View一覧を再取得し、古いversionを画面へ残さない。 */
  const reloadSavedViews = async (preferredId: number | null): Promise<void> => {
    const latest = await getTaskSavedViews();
    savedViews.value = latest;
    const selected = latest.find((view) => view.savedViewId === preferredId);
    selectedSavedViewId.value = selected?.savedViewId ?? null;
    if (selected) savedViewName.value = selected.name;
  };

  /** 現在条件を新しい本人Saved Viewとして登録する。 */
  const createSavedView = async (): Promise<void> => {
    if (isSavedViewMutating.value) return;
    if (!savedViewName.value.trim()) {
      setError("Saved View名を入力してください。");
      return;
    }
    if (visibleColumns.value.length === 0) {
      setError("表示列を1つ以上選択してください。");
      return;
    }
    isSavedViewMutating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const created = await createTaskSavedView({
        name: savedViewName.value,
        filters: { ...filters },
        visibleColumns: [...visibleColumns.value],
      });
      await reloadSavedViews(created.savedViewId);
      successMessage.value = "Saved Viewを登録しました。";
    } catch (error: unknown) {
      await handleApiError(error, "Saved Viewを登録できませんでした。");
    } finally {
      isSavedViewMutating.value = false;
    }
  };

  /** 選択中Saved Viewを取得時点version付きで更新する。 */
  const updateSavedView = async (): Promise<void> => {
    const current = activeSavedView.value;
    if (!current || isSavedViewMutating.value) return;
    if (!savedViewName.value.trim() || visibleColumns.value.length === 0) {
      setError("Saved View名と1つ以上の表示列を指定してください。");
      return;
    }
    isSavedViewMutating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updated = await updateTaskSavedView(current.savedViewId, {
        name: savedViewName.value,
        filters: { ...filters },
        visibleColumns: [...visibleColumns.value],
        version: current.version,
      });
      await reloadSavedViews(updated.savedViewId);
      successMessage.value = "Saved Viewを更新しました。";
    } catch (error: unknown) {
      if (
        error instanceof TaskSearchApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        try {
          await reloadSavedViews(current.savedViewId);
        } catch (_reloadError: unknown) {
          // 元の業務エラーを優先し、再取得失敗で競合理由を上書きしない。
        }
      }
      await handleApiError(error, "Saved Viewを更新できませんでした。");
    } finally {
      isSavedViewMutating.value = false;
    }
  };

  /** 選択中Saved Viewを取得時点version付きで削除する。 */
  const deleteSavedView = async (): Promise<void> => {
    const current = activeSavedView.value;
    if (!current || isSavedViewMutating.value) return;
    isSavedViewMutating.value = true;
    isDeleteConfirmationOpen.value = false;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await deleteTaskSavedView(current.savedViewId, current.version);
      await reloadSavedViews(null);
      savedViewName.value = "";
      successMessage.value = "Saved Viewを削除しました。";
    } catch (error: unknown) {
      if (
        error instanceof TaskSearchApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        try {
          await reloadSavedViews(current.savedViewId);
        } catch (_reloadError: unknown) {
          // 元の業務エラーを優先し、再取得失敗で競合理由を上書きしない。
        }
      }
      await handleApiError(error, "Saved Viewを削除できませんでした。");
    } finally {
      isSavedViewMutating.value = false;
    }
  };

  /** 検索結果のTaskを既存Board詳細deep linkで開く。 */
  const showTask = async (task: TaskSearchItem): Promise<void> => {
    await router.push({
      name: "TaskBoard",
      params: { projectId: task.projectId },
      query: { taskId: String(task.taskId) },
    });
  };

  const isColumnVisible = (column: TaskSearchColumn): boolean =>
    visibleColumns.value.includes(column);

  const requestDeleteSavedView = (): void => {
    if (activeSavedView.value) isDeleteConfirmationOpen.value = true;
  };

  const cancelDeleteSavedView = (): void => {
    isDeleteConfirmationOpen.value = false;
  };

  return {
    activeSavedView,
    applySavedView,
    businessDate,
    cancelDeleteSavedView,
    changeProject,
    columnOptions: COLUMN_OPTIONS,
    createSavedView,
    deleteSavedView,
    errorMessages,
    executeSearch,
    filters,
    initialize,
    isBusy,
    isColumnVisible,
    isInitializing,
    isDeleteConfirmationOpen,
    isOptionsLoading,
    isSavedViewMutating,
    isSearching,
    options,
    resetSearch,
    requestDeleteSavedView,
    savedViewName,
    savedViews,
    selectedSavedViewId,
    showTask,
    successMessage,
    tasks,
    truncated,
    updateSavedView,
    visibleColumns,
  };
};
