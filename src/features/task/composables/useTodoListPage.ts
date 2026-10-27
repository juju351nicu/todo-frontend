import { ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";
import type { TodoListItem, TodoListRequest } from "@/features/task/types/task";
import {
  LEGACY_TODO_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  DATA_TABLE_PAGE_OPTIONS,
  DEFAULT_ITEMS_PER_PAGE,
} from "@/shared/constants/ui";
import type { DataTableHeader } from "@/shared/types/dataTable";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { focusFirstEnabledElement } from "@/shared/utils/focus";
import { toNumberList } from "@/shared/utils/number";

/**
 * 行ごとの「編集」（参照のみなら「表示」）ボタンに付ける`data-todo-control`属性の値を組み立てる。
 * 「完了」の後はそのボタンがdisabledになりフォーカスがbodyへ外れるため、同じ行のこのボタンへ戻す（動作確認/16_Todo G-3）。
 *
 * @param todoId Todo ID
 * @returns `"edit:{todoId}"`形式の属性値
 */
export const todoEditControlKey = (todoId: number): string => `edit:${todoId}`;

const TODO_TABLE_HEADERS: DataTableHeader[] = [
  { title: "重要度", align: "start", key: "priority" },
  { title: "着手日", align: "start", key: "start" },
  { title: "期限日", align: "start", key: "end" },
  { title: "残り日数", align: "start", key: "remainingDays" },
  { title: "タイトル", align: "start", key: "title" },
  { title: "詳細情報", align: "start", key: "detail" },
  { title: "完了フラグ", align: "start", key: "doneFlag" },
  { title: "操作", align: "start", sortable: false, key: "actions" },
];

/**
 * Todo一覧画面の検索、詳細遷移および完了操作を提供する。
 * Session利用者に更新permissionがない場合、更新操作を画面から公開しない。
 */
export const useTodoListPage = () => {
  const router = useRouter();
  const todoStore = useTodoStore();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const headers = TODO_TABLE_HEADERS;
  const isLoading = ref(false);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const itemsPerPageOptions = DATA_TABLE_PAGE_OPTIONS;
  const searchTitle = ref("");
  const selectedDoneFlag = ref<string[]>(["0", "1"]);
  const todoList = ref<TodoListItem[]>([]);

  /**
   * 対象Todoの更新操作を画面へ表示できるか判定する。
   * 全件更新permissionは全Todo、本人更新permissionはSession利用者が所有するTodoだけを許可する。
   */
  const canWriteTodo = (todo: TodoListItem): boolean =>
    userStore.hasPermission("TASK_WRITE_ALL") ||
    (userStore.hasPermission("TASK_WRITE_OWN") &&
      userStore.memberId === todo.userId);

  /** 画面の検索状態をBackendのsnake_case Requestへ変換する。 */
  const createSearchRequest = (): TodoListRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: toNumberList(selectedDoneFlag.value),
  });

  /** 認証・認可状態が変化した場合にServer由来のTodo一覧を破棄する。 */
  const clearProtectedState = (): void => {
    todoList.value = [];
    todoStore.setTodoList([]);
  };

  /** Backendの確定Responseで画面とStoreのTodo一覧を同時に置き換える。 */
  const replaceTodoList = async (payload: TodoListRequest): Promise<void> => {
    const data = await todoStore.findTodoList(payload);
    todoList.value = data.todoList;
    todoStore.setTodoList(data.todoList);
  };

  /** API statusと契約済みerror codeを旧Todo一覧向け表示へ変換する。 */
  const getErrorMessages = (
    error: unknown,
    fallback: string,
    forbidden: string
  ): string[] => {
    if (!(error instanceof TaskApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.todo.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      LEGACY_TODO_ERROR_CODES,
      fallback
    );
  };

  /** 401ではTodo一覧とSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskApiError) || error.status !== 401) {
      return false;
    }
    clearProtectedState();
    errorMessages.value = [];
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /**
   * 指定条件でTodo一覧を取得し、画面とStoreを同じ一覧へ同期する。
   * 通信失敗時は既存一覧を維持し、認証・認可・公開範囲変更時は保護状態を破棄する。
   */
  const loadTodoList = async (payload: TodoListRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await replaceTodoList(payload);
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          clearProtectedState();
        }
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.todo.listLoadFailed,
          DISPLAY_MESSAGES.task.todo.readForbidden
        );
      }
    } finally {
      isLoading.value = false;
    }
  };

  /** 初期条件でTodo一覧を取得する。 */
  const initialize = async (): Promise<void> => {
    await loadTodoList(createSearchRequest());
  };

  /** 入力された検索条件でTodo一覧を取得する。 */
  const search = async (): Promise<void> => {
    await loadTodoList(createSearchRequest());
  };

  /** Todo詳細画面へ移動する。 */
  const showTodoDetail = (todo: TodoListItem): void => {
    void router.push({ name: "TodoDetail", params: { id: todo.todoId } });
  };

  /**
   * 指定されたTodoを完了状態へ更新し、結果を出してから同じ行の「編集」へフォーカスを戻す。
   * 完了したTodoは「完了」がdisabledになるだけで一覧に残るため、何も表示しないと完了したかが分からなかった（動作確認/16_Todo G-3）。
   */
  const completeTodo = async (todo: TodoListItem): Promise<void> => {
    await submitComplete(todo);
    // 401でLoginへ移った後や、一覧から消えた後は部品が見つからないので何もしない。
    await focusFirstEnabledElement([`[data-todo-control="${todoEditControlKey(todo.todoId)}"]`]);
  };

  /** 完了APIを呼び、一覧を取り直して結果をmessageへ反映する。 */
  const submitComplete = async (todo: TodoListItem): Promise<void> => {
    successMessage.value = "";
    if (!canWriteTodo(todo)) {
      errorMessages.value = [DISPLAY_MESSAGES.task.todo.operationForbidden];
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await todoStore.completeTodo(todo.todoId);
      todo.doneFlag = true;
      successMessage.value = DISPLAY_MESSAGES.task.todo.completed(todo.title);
      try {
        await replaceTodoList(createSearchRequest());
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        // 再取得の失敗を伝える文言が「完了しましたが…」を含むため、成功の案内は並べない。
        successMessage.value = "";
        if (
          reloadError instanceof TaskApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.todo.completedRefreshFailed,
            DISPLAY_MESSAGES.task.todo.readForbidden
          );
          return;
        }
        errorMessages.value = [
          DISPLAY_MESSAGES.task.todo.completedRefreshFailed,
        ];
      }
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      const operationMessages = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.todo.completeFailed,
        DISPLAY_MESSAGES.task.todo.operationForbidden
      );
      if (!(error instanceof TaskApiError) || error.status !== 404) {
        errorMessages.value = operationMessages;
        return;
      }

      try {
        await replaceTodoList(createSearchRequest());
        errorMessages.value = operationMessages;
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.todo.reloadFailed,
            DISPLAY_MESSAGES.task.todo.readForbidden
          );
          return;
        }
        errorMessages.value = [
          ...operationMessages,
          DISPLAY_MESSAGES.task.todo.reloadFailed,
        ];
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    canWriteTodo,
    completeTodo,
    errorMessages,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    itemsPerPageOptions,
    search,
    searchTitle,
    selectedDoneFlag,
    showTodoDetail,
    successMessage,
    todoList,
  };
};
