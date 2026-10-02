import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import DashboardApi, {
  DashboardApiError,
} from "@/features/dashboard/api/dashboardApi";
import type {
  BasicDashboardResponse,
  DashboardNotificationEvent,
  DashboardProject,
  DashboardTask,
} from "@/features/dashboard/types/dashboard";
import { useUserStore } from "@/features/auth/stores/user";
import { normalizeNotificationNavigationPath } from "@/features/notification/utils/notification";

/**
 * Basic Dashboardの取得、再読込、既存業務画面への遷移を管理する。
 * 初期表示後は明示的な再読込だけを行い、Spring Sessionを延長する定期pollingは追加しない。
 */
export const useDashboardPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const dashboard = ref<BasicDashboardResponse | null>(null);
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);

  const displayName = computed(
    () => userStore.displayName ?? userStore.username ?? "利用者"
  );
  const isInitialLoading = computed(
    () => isLoading.value && dashboard.value === null
  );

  /** Basic Dashboardを取得し、失敗時は直前の表示可能なsnapshotを維持する。 */
  const loadDashboard = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      dashboard.value = await DashboardApi.getBasicDashboard();
    } catch (error: unknown) {
      await handleApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** Dashboard APIのstatusを、認証状態を含む画面案内へ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof DashboardApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    const backendMessage = error.errorResponse?.fieldErrors?.[0]?.message;
    errorMessages.value = [
      backendMessage ?? "Dashboardを取得できませんでした。",
    ];
  };

  /** DashboardのTask previewから既存Board詳細へ遷移する。 */
  const openTask = async (task: DashboardTask): Promise<void> => {
    await router.push({
      name: "TaskBoard",
      params: { projectId: task.projectId },
      query: { taskId: String(task.taskId) },
    });
  };

  /** DashboardのProject cardから既存Boardへ遷移する。 */
  const openProject = async (project: DashboardProject): Promise<void> => {
    await router.push({
      name: "TaskBoard",
      params: { projectId: project.projectId },
    });
  };

  /** Backend通知の安全なFrontend内pathだけへ遷移する。 */
  const openNotificationEvent = async (
    event: DashboardNotificationEvent
  ): Promise<void> => {
    const navigationPath = normalizeNotificationNavigationPath(
      event.navigationPath
    );
    if (navigationPath === null) {
      return;
    }
    await router.push(navigationPath);
  };

  /** My Tasksの全件画面へ遷移する。 */
  const openMyTasks = async (): Promise<void> => {
    await router.push({ name: "MyTasks" });
  };

  /** 参照可能Projectの一覧画面へ遷移する。 */
  const openProjects = async (): Promise<void> => {
    await router.push({ name: "ProjectList" });
  };

  /** 本人勤怠画面へ遷移する。 */
  const openAttendance = async (): Promise<void> => {
    await router.push({ name: "Attendance" });
  };

  return {
    dashboard,
    displayName,
    errorMessages,
    isInitialLoading,
    isLoading,
    loadDashboard,
    openAttendance,
    openMyTasks,
    openNotificationEvent,
    openProject,
    openProjects,
    openTask,
  };
};
