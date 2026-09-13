import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { useTodoStore } from "@/features/task/stores/task";
import type {
  TodoListItem,
  TodoListRequest,
  TodoListResponse,
} from "@/features/task/types/task";
import type { ErrorResponse } from "@/shared/types/error";

interface MyTaskGroup {
  key: "overdue" | "today" | "upcoming";
  title: string;
  icon: string;
  color: string;
  items: TodoListItem[];
}

const ALL_TODO_STATES: TodoListRequest = {
  search_title: "",
  date_range: "",
  done_flag_values: [0, 1],
};

/** 本人担当Taskを日付グループへ分けるMy Tasks画面の状態と操作を提供する。 */
export const useMyTasksPage = () => {
  const router = useRouter();
  const todoStore = useTodoStore();
  const userStore = useUserStore();
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const todoList = ref<TodoListItem[]>([]);

  /** 現地ブラウザの業務日を比較用のISO日付へ変換する。 */
  const today = (): string => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  /** Backendの日時または日付文字列から画面比較用の日付部分を取り出す。 */
  const dateKey = (value: string): string => value.slice(0, 10);

  const myTasks = computed<TodoListItem[]>(() =>
    todoList.value.filter(
      (todo) => todo.userId === userStore.memberId && !todo.doneFlag
    )
  );

  const groups = computed<MyTaskGroup[]>(() => {
    const currentDate = today();
    const overdue = myTasks.value.filter(
      (todo) => todo.end && dateKey(todo.end) < currentDate
    );
    const todayTasks = myTasks.value.filter(
      (todo) => todo.end && dateKey(todo.end) === currentDate
    );
    const upcoming = myTasks.value.filter(
      (todo) => !todo.end || dateKey(todo.end) > currentDate
    );
    return [
      {
        key: "overdue",
        title: "期限超過",
        icon: "mdi-alert-circle-outline",
        color: "error",
        items: overdue,
      },
      {
        key: "today",
        title: "今日",
        icon: "mdi-calendar-today",
        color: "warning",
        items: todayTasks,
      },
      {
        key: "upcoming",
        title: "今後",
        icon: "mdi-calendar-arrow-right",
        color: "primary",
        items: upcoming,
      },
    ];
  });

  const setError = (message: string): void => {
    errorMessages.value = [message];
  };

  /**
   * 既存Todo一覧APIから認可済みTaskを取得し、本人担当の未完了Taskだけを画面へ反映する。
   * BackendがTASK_READ_OWNで返す範囲を正本とし、TASK_READ_ALLの場合も画面表示では本人担当へ絞る。
   * 通信失敗や非2xx Responseでは既存一覧を上書きせず、エラーメッセージだけを更新する。
   */
  const loadTasks = async (): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.findTodoList(ALL_TODO_STATES);
      if (!response.ok) {
        const errorResponse = (await response.json()) as ErrorResponse;
        const backendMessage = errorResponse.fieldErrors?.[0]?.message;
        setError(backendMessage ?? "My Tasksを取得できませんでした。");
        return;
      }
      const data = (await response.json()) as TodoListResponse;
      todoList.value = data.todoList;
    } catch (_error: unknown) {
      setError("Backendへ接続できませんでした。");
    } finally {
      isLoading.value = false;
    }
  };

  const showTodoDetail = (todo: TodoListItem): void => {
    void router.push({ name: "TodoDetail", params: { id: todo.todoId } });
  };

  const completeTodo = async (todo: TodoListItem): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.completeTodo(todo.todoId);
      if (!response.ok) {
        setError("Taskを完了状態へ更新できませんでした。");
        return;
      }
      todo.doneFlag = true;
    } catch (_error: unknown) {
      setError("Taskを完了状態へ更新できませんでした。");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    completeTodo,
    errorMessages,
    groups,
    isLoading,
    loadTasks,
    myTasks,
    showTodoDetail,
  };
};
