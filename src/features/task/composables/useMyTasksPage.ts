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
import { focusFirstEnabledElement } from "@/shared/utils/focus";
import type { SemanticColor } from "@/shared/types/color";

interface MyTaskGroup {
  key: "overdue" | "today" | "upcoming";
  title: string;
  icon: string;
  color: SemanticColor;
  items: MyTaskItem[];
}

type MyTaskFilter = "ALL" | "THIS_WEEK";

/** 画面右上の再読み込みボタンに付ける`data-my-task-control`属性の値。完了の後に戻す先がないときに使う。 */
export const MY_TASKS_RELOAD_CONTROL = "reload";

/**
 * Taskごとの「完了」ボタンに付ける`data-my-task-control`属性の値を組み立てる。
 * `MyTasksPage.vue`はこの値で属性を付け、`useMyTasksPage`は完了の後に同じ値で探してフォーカスを戻す。
 *
 * @param taskId Task ID
 * @returns `"complete:{taskId}"`形式の属性値
 */
export const myTaskCompleteControlKey = (taskId: number): string =>
  `complete:${taskId}`;

/** `data-my-task-control`属性の値から、その要素を探すselectorを作る。 */
const myTaskControlSelector = (key: string): string =>
  `[data-my-task-control="${key}"]`;

/** 本人担当Taskを日付グループへ分けるMy Tasks画面の状態と操作を提供する。 */
export const useMyTasksPage = () => {
  const router = useRouter();
  const todoStore = useTodoStore();
  const userStore = useUserStore();
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
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

  /** エラーを表示する。完了の直後に再取得で失敗した場合などに、成功の案内と並んで出ないよう成功を消す。 */
  const setErrors = (messages: string[]): void => {
    errorMessages.value = messages;
    successMessage.value = "";
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
    successMessage.value = "";
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

  /**
   * 画面に並んでいる順（期限超過・今日・今後の順、各グループ内は一覧の順）のTask。
   * 完了の後に、完了したTaskと同じ位置へ来たTaskを探すために使う。
   */
  const displayedTasks = (): MyTaskItem[] => groups.value.flatMap((group) => group.items);

  /**
   * 完了の後（失敗した場合も含む）に、フォーカスを戻す。
   * 完了したTaskの「完了」ボタンは一覧から消え、そのままではbodyへ外れるため（動作確認/14_MyTasks G-4）、
   * 同じ位置に来たTask、なければ1つ前のTaskの「完了」、それもなければ再読み込みボタンへ戻す。
   * 完了に失敗してTaskが残っている場合は、そのTaskの「完了」へ戻る。
   *
   * @param taskId 完了しようとしたTask ID
   * @param index 完了前に画面に並んでいた位置
   */
  const restoreFocusAfterComplete = (taskId: number, index: number): Promise<void> => {
    const tasksNow = displayedTasks();
    const candidates = [
      taskId,
      tasksNow[index]?.taskId,
      tasksNow[Math.min(index, tasksNow.length) - 1]?.taskId,
    ].filter((candidate): candidate is number => candidate !== undefined);
    return focusFirstEnabledElement([
      ...candidates.map((candidate) => myTaskControlSelector(myTaskCompleteControlKey(candidate))),
      myTaskControlSelector(MY_TASKS_RELOAD_CONTROL),
    ]);
  };

  /** Taskを完了し、結果を出してからフォーカスを戻す（`restoreFocusAfterComplete`）。 */
  const completeTask = async (task: MyTaskItem): Promise<void> => {
    if (!canCompleteTasks.value) {
      setErrors([DISPLAY_MESSAGES.task.myTasks.operationForbidden]);
      return;
    }
    const index = displayedTasks().findIndex((item) => item.taskId === task.taskId);
    await submitComplete(task);
    // 401でLoginへ移った後は、部品が見つからないので何もしない。
    await restoreFocusAfterComplete(task.taskId, Math.max(index, 0));
  };

  /** 完了APIを呼び、一覧を取り直して結果をmessageへ反映する。 */
  const submitComplete = async (task: MyTaskItem): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await todoStore.completeTodo(task.taskId);
      myTasks.value = myTasks.value.filter((item) => item.taskId !== task.taskId);
      successMessage.value = DISPLAY_MESSAGES.task.myTasks.completed(task.title);
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
    successMessage,
    visibleTasks,
  };
};
