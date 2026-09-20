import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";
import { TASK_WRITE_PERMISSION_CODES } from "@/features/auth/types/auth";
import type { MyTaskItem } from "@/features/task/types/task";

interface MyTaskGroup {
  key: "overdue" | "today" | "upcoming";
  title: string;
  icon: string;
  color: string;
  items: MyTaskItem[];
}

type MyTaskFilter = "ALL" | "THIS_WEEK";

/** 本人担当Taskを日付グループへ分けるMy Tasks画面の状態と操作を提供する。 */
export const useMyTasksPage = () => {
  const router = useRouter();
  const todoStore = useTodoStore();
  const userStore = useUserStore();
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const myTasks = ref<MyTaskItem[]>([]);
  const businessDate = ref("");
  const selectedFilter = ref<MyTaskFilter>("ALL");
  const canCompleteTasks = computed(() =>
    userStore.hasAnyPermission(TASK_WRITE_PERMISSION_CODES)
  );

  /** Backendの業務日から今週末までに期限を迎える、期限超過ではないTaskだけを返す。 */
  const visibleTasks = computed<MyTaskItem[]>(() => {
    if (selectedFilter.value === "ALL" || !businessDate.value) {
      return myTasks.value;
    }
    const dayOfWeek = new Date(`${businessDate.value}T00:00:00Z`).getUTCDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    return myTasks.value.filter(
      (task) => task.remainingDays >= 0 && task.remainingDays <= daysUntilSunday
    );
  });

  const groups = computed<MyTaskGroup[]>(() => {
    const overdue = visibleTasks.value.filter(
      (task) => task.dueGroup === "OVERDUE"
    );
    const todayTasks = visibleTasks.value.filter(
      (task) => task.dueGroup === "TODAY"
    );
    const upcoming = visibleTasks.value.filter(
      (task) => task.dueGroup === "UPCOMING"
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
   * 専用APIからBackendが本人・Project・状態を絞り込んだTaskを取得する。
   * 通信失敗では既存一覧を上書きせず、エラーメッセージだけを更新する。
   */
  const loadTasks = async (): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const data = await todoStore.findMyTasks();
      myTasks.value = data.tasks;
      businessDate.value = data.businessDate;
    } catch (error: unknown) {
      if (error instanceof TaskApiError) {
        if (error.status === 401) {
          userStore.clearSession();
          await router.push({ name: "Login" });
          return;
        }
        const backendMessage = error.errorResponse?.fieldErrors?.[0]?.message;
        setError(backendMessage ?? "My Tasksを取得できませんでした。");
      } else {
        setError("Backendへ接続できませんでした。");
      }
    } finally {
      isLoading.value = false;
    }
  };

  const showTask = (task: MyTaskItem): void => {
    void router.push({
      name: "TaskBoard",
      params: { projectId: task.projectId },
      query: { taskId: String(task.taskId) },
    });
  };

  const completeTask = async (task: MyTaskItem): Promise<void> => {
    if (!canCompleteTasks.value) {
      setError("Taskを完了するpermissionがありません。");
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.completeTodo(task.taskId);
      if (!response.ok) {
        setError("Taskを完了状態へ更新できませんでした。");
        return;
      }
      myTasks.value = myTasks.value.filter((item) => item.taskId !== task.taskId);
    } catch (_error: unknown) {
      setError("Taskを完了状態へ更新できませんでした。");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    businessDate,
    canCompleteTasks,
    completeTask,
    errorMessages,
    groups,
    isLoading,
    loadTasks,
    myTasks,
    selectedFilter,
    showTask,
    visibleTasks,
  };
};
