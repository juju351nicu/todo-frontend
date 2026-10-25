import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";
import { TASK_WRITE_PERMISSION_CODES } from "@/features/auth/types/auth";
import type { MyTaskItem } from "@/features/task/types/task";
import {
  LEGACY_TODO_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import type { SemanticColor } from "@/shared/types/color";

interface MyTaskGroup {
  key: "overdue" | "today" | "upcoming";
  title: string;
  icon: string;
  color: SemanticColor;
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
  const canStartTimers = computed(() => userStore.hasPermission("TASK_UPDATE"));

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
        icon: "i-mdi-alert-circle-outline",
        color: "error",
        items: overdue,
      },
      {
        key: "today",
        title: "今日",
        icon: "i-mdi-calendar-today",
        color: "warning",
        items: todayTasks,
      },
      {
        key: "upcoming",
        title: "今後",
        icon: "i-mdi-calendar-arrow-right",
        color: "primary",
        items: upcoming,
      },
    ];
  });

  const setErrors = (messages: string[]): void => {
    errorMessages.value = messages;
  };

  /** 認証・認可状態が変化した場合にServer由来のMy Tasksを破棄する。 */
  const clearProtectedState = (): void => {
    myTasks.value = [];
    businessDate.value = "";
  };

  /** Backendの確定ResponseでMy Tasksと業務日を同時に置き換える。 */
  const replaceTasks = async (): Promise<void> => {
    const data = await todoStore.findMyTasks();
    myTasks.value = data.tasks;
    businessDate.value = data.businessDate;
  };

  /** API statusと契約済みerror codeをMy Tasks向け表示へ変換する。 */
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
      return [DISPLAY_MESSAGES.task.myTasks.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      LEGACY_TODO_ERROR_CODES,
      fallback
    );
  };

  /** 401ではMy TasksとSession表示を破棄してLoginへ戻す。 */
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
   * 専用APIからBackendが本人・Project・状態を絞り込んだTaskを取得する。
   * 通信失敗では既存一覧を上書きせず、エラーメッセージだけを更新する。
   */
  const loadTasks = async (): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await replaceTasks();
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          clearProtectedState();
        }
        setErrors(
          getErrorMessages(
            error,
            DISPLAY_MESSAGES.task.myTasks.loadFailed,
            DISPLAY_MESSAGES.task.myTasks.readForbidden
          )
        );
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
      setErrors([DISPLAY_MESSAGES.task.myTasks.operationForbidden]);
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await todoStore.completeTodo(task.taskId);
      myTasks.value = myTasks.value.filter((item) => item.taskId !== task.taskId);
      try {
        await replaceTasks();
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          setErrors(
            getErrorMessages(
              reloadError,
              DISPLAY_MESSAGES.task.myTasks.completedRefreshFailed,
              DISPLAY_MESSAGES.task.myTasks.readForbidden
            )
          );
          return;
        }
        setErrors([DISPLAY_MESSAGES.task.myTasks.completedRefreshFailed]);
      }
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      const operationMessages = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.myTasks.completeFailed,
        DISPLAY_MESSAGES.task.myTasks.operationForbidden
      );
      if (!(error instanceof TaskApiError) || error.status !== 404) {
        setErrors(operationMessages);
        return;
      }

      myTasks.value = myTasks.value.filter((item) => item.taskId !== task.taskId);
      try {
        await replaceTasks();
        setErrors(operationMessages);
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          setErrors(
            getErrorMessages(
              reloadError,
              DISPLAY_MESSAGES.task.myTasks.reloadFailed,
              DISPLAY_MESSAGES.task.myTasks.readForbidden
            )
          );
          return;
        }
        setErrors([
          ...operationMessages,
          DISPLAY_MESSAGES.task.myTasks.reloadFailed,
        ]);
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    businessDate,
    canCompleteTasks,
    canStartTimers,
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
