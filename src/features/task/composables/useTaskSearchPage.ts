import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";

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
import {
  TASK_RECOVERY_PRIORITY_STATUSES,
  TASK_SAVED_VIEW_ERROR_CODES,
  TASK_SEARCH_ERROR_CODES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { hasApiFieldError, resolveApiErrorMessages } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";
import { TASK_PRIORITY_OPTIONS } from "@/features/task/utils/taskFormOptions";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";

/** キーワードの最大文字数。Backendの入力制約（`TaskSearchFilterRequest#keyword`の`@Size(max = 100)`）と同じ値。 */
export const TASK_SEARCH_KEYWORD_MAX_LENGTH = 100;

/**
 * Saved Viewの部品に付ける`data-task-search-control`属性の値。
 * 更新の409・削除の後は、押したボタンが一時的または以後disabledになりフォーカスがbodyへ外れるため、ここへ戻す
 * （動作確認/15_Task検索 G-7・G-8）。
 */
export const TASK_SEARCH_CONTROL = {
  /** 「保存した条件」の選択。削除の後に戻す。 */
  savedViewSelect: "saved-view-select",
  /** 「Saved View名」の入力欄。更新の409の後に戻す。 */
  savedViewName: "saved-view-name",
} as const;

/** `data-task-search-control`属性の値から、その要素を探すselectorを作る。 */
const buildTaskSearchControlSelector = createDataAttributeSelector("data-task-search-control");

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
  const { expireSession } = useSessionExpiry();
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

  const setErrors = (messages: string[]): void => {
    errorMessages.value = messages;
    successMessage.value = "";
  };

  /** Serverから取得した検索結果を破棄し、現在の条件と一致しないTaskを表示しない。 */
  const clearSearchResults = (): void => {
    tasks.value = [];
    businessDate.value = "";
    truncated.value = false;
  };

  /** Saved View一覧と選択中versionを破棄し、古い値で更新・削除できない状態へ戻す。 */
  const clearSavedViewState = (): void => {
    savedViews.value = [];
    selectedSavedViewId.value = null;
    savedViewName.value = "";
    isDeleteConfirmationOpen.value = false;
  };

  /**
   * 直近の処理で401を受けてLoginへ移ったか。Session切れの後に、破棄した画面へ案内を足さないために使う。
   * `handleUnauthorized`がtrueにし、続けて複数のAPIを呼ぶ処理（`recoverSavedViews`）が開始時にfalseへ戻す。
   */
  let isSessionEnded = false;

  /** 認証・認可状態が変化した場合にServer由来の画面状態をすべて破棄する。 */
  const clearProtectedState = (): void => {
    options.value = { projects: [], assignees: [], statuses: [] };
    clearSearchResults();
    clearSavedViewState();
  };

  /** API statusと契約済みerror codeを利用者向けメッセージへ変換する。 */
  const getErrorMessages = (
    error: unknown,
    fallback: string,
    knownCodes: ReadonlySet<string>,
    forbidden: string = DISPLAY_MESSAGES.task.search.operationForbidden
  ): string[] => {
    if (!(error instanceof TaskSearchApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.search.resourceNotFound];
    }
    return resolveApiErrorMessages(error.errorResponse, knownCodes, fallback);
  };

  /** 401ではServer由来の状態とSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskSearchApiError) || error.status !== 401) {
      return false;
    }
    isSessionEnded = true;
    clearProtectedState();
    errorMessages.value = [];
    successMessage.value = "";
    await expireSession();
    return true;
  };

  /** 検索結果をBackendの確定Responseで置き換える。二重検索中は新しいRequestを送らない。 */
  const executeSearch = async (): Promise<void> => {
    if (isSearching.value) return;
    if (filters.keyword.trim().length > TASK_SEARCH_KEYWORD_MAX_LENGTH) {
      setErrors([DISPLAY_MESSAGES.task.search.keywordTooLong]);
      return;
    }
    if (filters.dueFrom && filters.dueTo && filters.dueTo < filters.dueFrom) {
      setErrors(["期限の終了日は開始日以降にしてください。"]);
      return;
    }
    isSearching.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    clearSearchResults();
    try {
      const response = await searchTasks({ ...filters });
      tasks.value = response.tasks ?? [];
      businessDate.value = response.businessDate;
      truncated.value = response.truncated;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.searchFailed,
            TASK_SEARCH_ERROR_CODES,
            DISPLAY_MESSAGES.task.search.readForbidden
          )
        );
      }
    } finally {
      isSearching.value = false;
    }
  };

  /** Project選択に応じた担当者・状態候補を再取得し、利用できない現在値を解除する。 */
  const refreshOptions = async (
    preserveSelection = false
  ): Promise<boolean> => {
    if (isOptionsLoading.value) return false;
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
      return true;
    } catch (error: unknown) {
      options.value = { projects: [], assignees: [], statuses: [] };
      filters.assigneeAccountId = null;
      filters.statusCode = null;
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskSearchApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          clearSearchResults();
        }
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.optionsLoadFailed,
            TASK_SEARCH_ERROR_CODES,
            DISPLAY_MESSAGES.task.search.readForbidden
          )
        );
      }
      return false;
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
      clearProtectedState();
      if (!(await handleUnauthorized(error))) {
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.initializeFailed,
            TASK_SAVED_VIEW_ERROR_CODES,
            DISPLAY_MESSAGES.task.search.readForbidden
          )
        );
      }
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
    if (!view) {
      selectedSavedViewId.value = null;
      savedViewName.value = "";
      return;
    }
    savedViewName.value = view.name;
    copyFilters(filters, view.filters);
    visibleColumns.value = [...view.visibleColumns];
    if (await refreshOptions(true)) await executeSearch();
  };

  /** 絞り込みと表示列を初期値へ戻し、全Project候補と検索結果を再取得する。 */
  const resetSearch = async (): Promise<void> => {
    copyFilters(filters, createEmptyFilters());
    visibleColumns.value = [...DEFAULT_VISIBLE_COLUMNS];
    selectedSavedViewId.value = null;
    savedViewName.value = "";
    if (await refreshOptions()) await executeSearch();
  };

  /** 409・404後に本人Saved View一覧を再取得し、古いversionを画面へ残さない。 */
  const reloadSavedViews = async (preferredId: number | null): Promise<void> => {
    const latest = await getTaskSavedViews();
    savedViews.value = latest;
    const selected = latest.find((view) => view.savedViewId === preferredId);
    selectedSavedViewId.value = selected?.savedViewId ?? null;
    savedViewName.value = selected?.name ?? "";
    if (selected) {
      copyFilters(filters, selected.filters);
      visibleColumns.value = [...selected.visibleColumns];
    }
  };

  /** 保存操作確定後に一覧を再取得し、操作済みなのに失敗と誤表示しない。 */
  const refreshSavedViewsAfterMutation = async (
    preferredId: number | null,
    completedMessage: string
  ): Promise<void> => {
    clearSavedViewState();
    try {
      await reloadSavedViews(preferredId);
      successMessage.value = completedMessage;
    } catch (reloadError: unknown) {
      if (await handleUnauthorized(reloadError)) return;
      if (
        reloadError instanceof TaskSearchApiError &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
      ) {
        setErrors(
          getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.search.savedRefreshFailed,
            TASK_SAVED_VIEW_ERROR_CODES,
            DISPLAY_MESSAGES.task.search.readForbidden
          )
        );
        return;
      }
      setErrors([DISPLAY_MESSAGES.task.search.savedRefreshFailed]);
    }
  };

  /**
   * 404／409後に古いversionを破棄し、最新Saved View一覧へ安全に回復する。
   * version競合のBackendの文言は「最新状態を再取得してください。」だが、ここで取り直すため、
   * 取り直せたときは取り直し済みであることを添える（動作確認/15_Task検索 G-7。07・08・12・13の対応と同じ）。
   */
  const recoverSavedViews = async (
    error: TaskSearchApiError,
    preferredId: number,
    fallback: string
  ): Promise<void> => {
    const mutationMessages = getErrorMessages(
      error,
      fallback,
      TASK_SAVED_VIEW_ERROR_CODES
    );
    clearSavedViewState();
    try {
      await reloadSavedViews(preferredId);
      const recoveryMessages = hasApiFieldError(error.errorResponse, "TASK_SAVED_VIEW_VERSION_CONFLICT")
        ? [...mutationMessages, DISPLAY_MESSAGES.task.search.conflictReloaded]
        : mutationMessages;
      // 取り直したSaved Viewの条件は最新に戻るが、表示中の結果は古い条件のままなので検索し直す（改善提案 1-16）。
      // 検索は画面のメッセージを置き換えるため、取り直しの案内はその後に先頭へ足す。
      isSessionEnded = false;
      if (selectedSavedViewId.value !== null && (await refreshOptions(true))) {
        await executeSearch();
      }
      if (!isSessionEnded) {
        errorMessages.value = [...recoveryMessages, ...errorMessages.value];
      }
    } catch (reloadError: unknown) {
      if (await handleUnauthorized(reloadError)) return;
      if (
        reloadError instanceof TaskSearchApiError &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
      ) {
        setErrors(
          getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.search.reloadFailed,
            TASK_SAVED_VIEW_ERROR_CODES,
            DISPLAY_MESSAGES.task.search.readForbidden
          )
        );
        return;
      }
      setErrors([
        ...mutationMessages,
        DISPLAY_MESSAGES.task.search.reloadFailed,
      ]);
    }
  };

  /** 現在条件を新しい本人Saved Viewとして登録する。 */
  const createSavedView = async (): Promise<void> => {
    if (isSavedViewMutating.value) return;
    if (!savedViewName.value.trim()) {
      setErrors(["Saved View名を入力してください。"]);
      return;
    }
    if (visibleColumns.value.length === 0) {
      setErrors(["表示列を1つ以上選択してください。"]);
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
      await refreshSavedViewsAfterMutation(
        created.savedViewId,
        "Saved Viewを登録しました。"
      );
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.createFailed,
            TASK_SAVED_VIEW_ERROR_CODES
          )
        );
      }
    } finally {
      isSavedViewMutating.value = false;
    }
  };

  /** 選択中Saved Viewを取得時点version付きで更新する。 */
  const updateSavedView = async (): Promise<void> => {
    const current = activeSavedView.value;
    if (!current || isSavedViewMutating.value) return;
    if (!savedViewName.value.trim() || visibleColumns.value.length === 0) {
      setErrors(["Saved View名と1つ以上の表示列を指定してください。"]);
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
      await refreshSavedViewsAfterMutation(
        updated.savedViewId,
        "Saved Viewを更新しました。"
      );
    } catch (error: unknown) {
      if (
        error instanceof TaskSearchApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        await recoverSavedViews(
          error,
          current.savedViewId,
          DISPLAY_MESSAGES.task.search.updateFailed
        );
        // 取り直しの間「更新」はdisabledになりフォーカスが外れるため、名前の入力欄へ戻す。
        await focusFirstEnabledElement([buildTaskSearchControlSelector(TASK_SEARCH_CONTROL.savedViewName)]);
        return;
      }
      if (!(await handleUnauthorized(error))) {
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.updateFailed,
            TASK_SAVED_VIEW_ERROR_CODES
          )
        );
      }
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
      await refreshSavedViewsAfterMutation(
        null,
        "Saved Viewを削除しました。"
      );
      // 削除の後は選択がなくなり「削除」がdisabledになるため、「保存した条件」へ戻す。
      await focusFirstEnabledElement([buildTaskSearchControlSelector(TASK_SEARCH_CONTROL.savedViewSelect)]);
    } catch (error: unknown) {
      if (
        error instanceof TaskSearchApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        await recoverSavedViews(
          error,
          current.savedViewId,
          DISPLAY_MESSAGES.task.search.deleteFailed
        );
        return;
      }
      if (!(await handleUnauthorized(error))) {
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.search.deleteFailed,
            TASK_SAVED_VIEW_ERROR_CODES
          )
        );
      }
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
    priorityOptions: TASK_PRIORITY_OPTIONS,
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
