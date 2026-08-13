import { ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { useTodoStore } from "@/features/task/stores/task";
import type {
  TodoListItem,
  TodoListRequest,
  TodoListResponse,
} from "@/features/task/types/task";
import type { ErrorResponse } from "@/shared/types/error";
import {
  DATA_TABLE_PAGE_OPTIONS,
  DEFAULT_ITEMS_PER_PAGE,
} from "@/shared/constants/ui";
import { toNumberList } from "@/shared/utils/number";

interface TodoTableHeader {
  title: string;
  align: "start" | "center" | "end";
  key: string;
}

const TODO_TABLE_HEADERS: TodoTableHeader[] = [
  { title: "重要度", align: "start", key: "priority" },
  { title: "着手日", align: "start", key: "start" },
  { title: "期限日", align: "start", key: "end" },
  { title: "残り日数", align: "start", key: "remainingDays" },
  { title: "タイトル", align: "start", key: "title" },
  { title: "詳細情報", align: "start", key: "detail" },
  { title: "完了フラグ", align: "start", key: "doneFlag" },
  { title: "操作", align: "start", key: "actions" },
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
  const headers = TODO_TABLE_HEADERS;
  const isLoading = ref(false);
  const itemsPerPage = ref<number>(DEFAULT_ITEMS_PER_PAGE);
  const pages = DATA_TABLE_PAGE_OPTIONS;
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

  /** Backendの項目エラーを画面メッセージへ変換し、項目がない失敗にも既定文言を設定する。 */
  const setResponseErrors = (errorResponse: ErrorResponse): void => {
    errorMessages.value = (errorResponse.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    if (errorMessages.value.length === 0) {
      errorMessages.value = ["Todo情報を取得できませんでした。"];
    }
  };

  /**
   * 指定条件でTodo一覧を取得し、画面とStoreを同じ一覧へ同期する。
   * API失敗時は不完全なResponseで既存一覧を上書きしない。
   */
  const loadTodoList = async (payload: TodoListRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.findTodoList(payload);
      if (!response.ok) {
        setResponseErrors((await response.json()) as ErrorResponse);
        return;
      }
      const data = (await response.json()) as TodoListResponse;
      todoList.value = data.todoList;
      todoStore.setTodoList(data.todoList);
    } catch (_error: unknown) {
      if (errorMessages.value.length === 0) {
        errorMessages.value = ["Backendへ接続できませんでした。"];
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

  /** 指定されたTodoを完了状態へ更新する。 */
  const completeTodo = async (todo: TodoListItem): Promise<void> => {
    if (!canWriteTodo(todo)) {
      errorMessages.value = ["Todoを更新するpermissionがありません。"];
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.completeTodo(todo.todoId);
      if (!response.ok) {
        throw new Error("Todoの完了更新に失敗しました。");
      }
      todo.doneFlag = true;
    } catch (_error: unknown) {
      errorMessages.value = ["Todoを完了状態へ更新できませんでした。"];
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
    pages,
    search,
    searchTitle,
    selectedDoneFlag,
    showTodoDetail,
    todoList,
  };
};
