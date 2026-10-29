import { ref } from "vue";
import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { TASK_RECOVERY_PRIORITY_STATUSES } from "@/features/task/utils/apiErrors";
import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import { useTaskListStore } from "@/features/task-list/stores/taskList";
import type { TaskListItem, TaskListSearchRequest } from "@/features/task-list/types/taskList";
import { TASK_LIST_ERROR_CODES } from "@/features/task-list/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { DATA_TABLE_PAGE_OPTIONS, DEFAULT_ITEMS_PER_PAGE } from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { resolveStandardErrorMessages } from "@/shared/utils/apiError";
import { focusFirstEnabledElement } from "@/shared/utils/focus";
import { toNumberList } from "@/shared/utils/number";

/**
 * 行ごとの「編集」（参照のみなら「表示」）ボタンに付ける`data-task-list-control`属性の値を組み立てる。
 * 「完了」の後はそのボタンがdisabledになりフォーカスがbodyへ外れるため、同じ行のこのボタンへ戻す。
 *
 * @param taskId Task ID
 * @returns `"edit:{taskId}"`形式の属性値
 */
export const buildTaskEditControlKey = (taskId: number): string => `edit:${taskId}`;

const TASK_LIST_TABLE_HEADERS: DataTableHeader[] = [
  { title: "重要度", align: "start", key: "priority" },
  { title: "着手日", align: "start", key: "start" },
  { title: "期限日", align: "start", key: "end" },
  { title: "期限まで", align: "start", key: "remainingDays" },
  { title: "タイトル", align: "start", key: "title" },
  { title: "詳細情報", align: "start", key: "detail" },
  { title: "完了フラグ", align: "start", key: "doneFlag" },
  { title: "操作", align: "start", sortable: false, key: "actions" },
];

/**
 * Task一覧画面の検索、詳細遷移および完了操作を提供する。
 * Session利用者に更新permissionがない場合、更新操作を画面から公開しない。
 */
export const useTaskListPage = () => {
  const router = useRouter();
  const taskListStore = useTaskListStore();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const headers = TASK_LIST_TABLE_HEADERS;
  const isLoading = ref(false);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const searchTitle = ref("");
  const selectedDoneFlag = ref<string[]>(["0", "1"]);
  const taskList = ref<TaskListItem[]>([]);

  /**
   * 対象Taskの更新操作を画面へ表示できるか判定する。
   * 全件更新permissionは全Task、本人更新permissionはSession利用者が所有するTaskだけを許可する。
   */
  const canWriteTask = (task: TaskListItem): boolean =>
    userStore.hasPermission("TASK_WRITE_ALL") ||
    (userStore.hasPermission("TASK_WRITE_OWN") && userStore.accountId === task.userId);

  /** 画面の検索状態をBackendのsnake_case Requestへ変換する。 */
  const createSearchRequest = (): TaskListSearchRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: toNumberList(selectedDoneFlag.value),
  });

  /** 認証・認可状態が変化した場合にServer由来のTask一覧を破棄する。 */
  const clearProtectedState = (): void => {
    taskList.value = [];
  };

  /** Backendの確定Responseで画面のTask一覧を置き換える。 */
  const replaceTaskList = async (payload: TaskListSearchRequest): Promise<void> => {
    const data = await taskListStore.findTaskList(payload);
    taskList.value = data.taskList;
  };

  /** API statusと契約済みerror codeをTask一覧向け表示へ変換する。 */
  const getErrorMessages = (error: unknown, fallback: string, forbidden: string): string[] => {
    return resolveStandardErrorMessages(error, TaskListApiError, {
      forbidden,
      notFound: DISPLAY_MESSAGES.task.taskList.resourceNotFound,
      knownErrorCodes: TASK_LIST_ERROR_CODES,
      fallback,
    });
  };

  /** 401ではTask一覧とSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskListApiError) || error.status !== 401) {
      return false;
    }
    clearProtectedState();
    errorMessages.value = [];
    await expireSession();
    return true;
  };

  /**
   * 指定条件でTask一覧を取得し、画面とStoreを同じ一覧へ同期する。
   * 通信失敗時は既存一覧を維持し、認証・認可・公開範囲変更時は保護状態を破棄する。
   */
  const loadTaskList = async (payload: TaskListSearchRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await replaceTaskList(payload);
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (error instanceof TaskListApiError && (error.status === 403 || error.status === 404)) {
          clearProtectedState();
        }
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.taskList.listLoadFailed,
          DISPLAY_MESSAGES.task.taskList.readForbidden
        );
      }
    } finally {
      isLoading.value = false;
    }
  };

  /** 初期条件でTask一覧を取得する。 */
  const initialize = async (): Promise<void> => {
    await loadTaskList(createSearchRequest());
  };

  /** 入力された検索条件でTask一覧を取得する。 */
  const search = async (): Promise<void> => {
    await loadTaskList(createSearchRequest());
  };

  /** Task詳細画面へ移動する。 */
  const showTaskDetail = (task: TaskListItem): void => {
    void router.push({ name: ROUTE_NAMES.taskListDetail, params: { id: task.taskId } });
  };

  /**
   * 指定されたTaskを完了状態へ更新し、結果を出してから同じ行の「編集」へフォーカスを戻す。
   * 完了したTaskは「完了」がdisabledになるだけで一覧に残るため、何も表示しないと完了したかが分からない。
   */
  const completeTask = async (task: TaskListItem): Promise<void> => {
    await submitComplete(task);
    // 401でLoginへ移った後や、一覧から消えた後は部品が見つからないので何もしない。
    await focusFirstEnabledElement([
      `[data-task-list-control="${buildTaskEditControlKey(task.taskId)}"]`,
    ]);
  };

  /** 完了APIを呼び、一覧を取り直して結果をmessageへ反映する。 */
  const submitComplete = async (task: TaskListItem): Promise<void> => {
    successMessage.value = "";
    if (!canWriteTask(task)) {
      errorMessages.value = [DISPLAY_MESSAGES.task.taskList.operationForbidden];
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await taskListStore.completeTask(task.taskId);
      task.doneFlag = true;
      successMessage.value = DISPLAY_MESSAGES.task.taskList.completed(task.title);
      try {
        await replaceTaskList(createSearchRequest());
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        // 再取得の失敗を伝える文言が「完了しましたが…」を含むため、成功の案内は並べない。
        successMessage.value = "";
        if (
          reloadError instanceof TaskListApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.taskList.completedRefreshFailed,
            DISPLAY_MESSAGES.task.taskList.readForbidden
          );
          return;
        }
        errorMessages.value = [DISPLAY_MESSAGES.task.taskList.completedRefreshFailed];
      }
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      const operationMessages = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.taskList.completeFailed,
        DISPLAY_MESSAGES.task.taskList.operationForbidden
      );
      if (!(error instanceof TaskListApiError) || error.status !== 404) {
        errorMessages.value = operationMessages;
        return;
      }

      try {
        await replaceTaskList(createSearchRequest());
        errorMessages.value = operationMessages;
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskListApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.taskList.reloadFailed,
            DISPLAY_MESSAGES.task.taskList.readForbidden
          );
          return;
        }
        errorMessages.value = [...operationMessages, DISPLAY_MESSAGES.task.taskList.reloadFailed];
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    canWriteTask,
    completeTask,
    errorMessages,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    itemsPerPageOptions,
    search,
    searchTitle,
    selectedDoneFlag,
    showTaskDetail,
    successMessage,
    taskList,
  };
};
