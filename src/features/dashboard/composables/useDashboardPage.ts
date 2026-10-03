import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import DashboardApi, {
  DashboardApiError,
} from "@/features/dashboard/api/dashboardApi";
import type {
  AdvancedDashboardProject,
  AdvancedDashboardResponse,
  BasicDashboardResponse,
  DashboardNotificationEvent,
  DashboardProject,
  DashboardTask,
} from "@/features/dashboard/types/dashboard";
import { useUserStore } from "@/features/auth/stores/user";
import { normalizeNotificationNavigationPath } from "@/features/notification/utils/notification";
import { validateEarnedValueStatusDate } from "@/features/wbs/utils/earnedValue";

/**
 * Basic／高度Dashboardの取得、再読込、既存業務画面への遷移を管理する。
 * 初期表示後は明示的な再読込だけを行い、Spring Sessionを延長する定期pollingは追加しない。
 */
export const useDashboardPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const dashboard = ref<BasicDashboardResponse | null>(null);
  const advancedDashboard = ref<AdvancedDashboardResponse | null>(null);
  const advancedStatusDate = ref("");
  const errorMessages = ref<string[]>([]);
  const advancedErrorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const isAdvancedLoading = ref(false);
  const isAdvancedNotEntitled = ref(false);

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
      const loadedDashboard = await DashboardApi.getBasicDashboard();
      dashboard.value = loadedDashboard;
      if (!loadedDashboard.myTasks.available) {
        advancedDashboard.value = null;
        advancedErrorMessages.value = [];
        isAdvancedNotEntitled.value = false;
        return;
      }
      if (advancedStatusDate.value.length === 0) {
        advancedStatusDate.value = loadedDashboard.businessDate;
      }
      await loadAdvancedDashboard(advancedStatusDate.value);
    } catch (error: unknown) {
      await handleApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** 高度Dashboardの安定error codeから、機能資格不足だけを判定する。 */
  const isFeatureNotEntitled = (error: DashboardApiError): boolean =>
    error.status === 403 &&
    (error.errorResponse?.fieldErrors ?? []).some(
      (fieldError) =>
        fieldError.errorCode === "FEATURE_NOT_ENTITLED" &&
        fieldError.field === "featureCode"
    );

  /** 高度Dashboard APIのstatusをSession、upgrade案内、業務エラーへ分離する。 */
  const handleAdvancedApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof DashboardApiError)) {
      advancedErrorMessages.value = ["高度Dashboardへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (isFeatureNotEntitled(error)) {
      advancedDashboard.value = null;
      isAdvancedNotEntitled.value = true;
      return;
    }
    if (error.status === 403 || error.status === 404) {
      // permissionまたはProject参照範囲が変わった後に、以前取得した横断値を画面へ残さない。
      advancedDashboard.value = null;
    }
    const backendMessage = error.errorResponse?.fieldErrors?.[0]?.message;
    advancedErrorMessages.value = [
      backendMessage ?? "高度Dashboardを取得できませんでした。",
    ];
  };

  /**
   * 指定基準日の高度Dashboardを取得し、失敗時は資格取消を除いて直前snapshotを維持する。
   * 入力不正と処理中の再操作ではAPIを呼ばない。
   */
  const loadAdvancedDashboard = async (
    requestedStatusDate = advancedStatusDate.value
  ): Promise<void> => {
    if (isAdvancedLoading.value) {
      return;
    }
    const normalizedStatusDate = requestedStatusDate.trim();
    const validationErrors = validateEarnedValueStatusDate(
      normalizedStatusDate
    );
    if (validationErrors.length > 0) {
      advancedErrorMessages.value = validationErrors;
      return;
    }
    advancedStatusDate.value = normalizedStatusDate;
    isAdvancedLoading.value = true;
    isAdvancedNotEntitled.value = false;
    advancedErrorMessages.value = [];
    try {
      advancedDashboard.value = await DashboardApi.getAdvancedDashboard(
        normalizedStatusDate
      );
    } catch (error: unknown) {
      await handleAdvancedApiError(error);
    } finally {
      isAdvancedLoading.value = false;
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

  /** 高度DashboardのProject summaryから既存WBS・EVM画面へ遷移する。 */
  const openAdvancedProject = async (
    project: AdvancedDashboardProject
  ): Promise<void> => {
    await router.push({
      name: "Wbs",
      params: { projectId: project.projectId },
    });
  };

  /** 課金画面導入前の高度機能利用相談を既存問い合わせ画面へ接続する。 */
  const openAdvancedAccessInquiry = async (): Promise<void> => {
    await router.push({ name: "InquiryForm" });
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
    advancedDashboard,
    advancedErrorMessages,
    advancedStatusDate,
    dashboard,
    displayName,
    errorMessages,
    isAdvancedLoading,
    isAdvancedNotEntitled,
    isInitialLoading,
    isLoading,
    loadAdvancedDashboard,
    loadDashboard,
    openAdvancedAccessInquiry,
    openAdvancedProject,
    openAttendance,
    openMyTasks,
    openNotificationEvent,
    openProject,
    openProjects,
    openTask,
  };
};
