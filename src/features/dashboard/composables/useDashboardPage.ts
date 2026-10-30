import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import DashboardApi, { DashboardApiError } from "@/features/dashboard/api/dashboardApi";
import type {
  AdvancedDashboardProject,
  AdvancedDashboardResponse,
  BasicDashboardResponse,
  DashboardNotificationEvent,
  DashboardProject,
  DashboardTask,
} from "@/features/dashboard/types/dashboard";
import { useUserStore } from "@/features/auth/stores/user";
import { useExpandableNotificationMessages } from "@/features/notification/composables/useExpandableNotificationMessages";
import { validateEarnedValueStatusDate } from "@/features/wbs/utils/earnedValue";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { hasApiFieldError, resolveApiErrorMessages } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * Dashboardの部品に付ける`data-dashboard-control`属性の値。
 * 再読込中は「再読み込み」が、集計中は「EVM基準日」がdisabledになりフォーカスがbodyへ外れるため、
 * 利用者が押した操作の後にここへ戻す。
 */
export const DASHBOARD_CONTROL = {
  /** 画面右上の「再読み込み」ボタン。 */
  reload: "reload",
  /** 高度Dashboardの「EVM基準日」入力欄。 */
  advancedStatusDate: "advanced-status-date",
} as const;

/** `data-dashboard-control`属性の値から、その要素を探すselectorを作る。 */
const buildDashboardControlSelector = createDataAttributeSelector("data-dashboard-control");

const DASHBOARD_ERROR_CODES: ReadonlySet<string> = new Set([
  "FEATURE_NOT_ENTITLED",
  "PROJECT_NOT_FOUND",
  "WBS_EVM_ACTIVE_BASELINE_REQUIRED",
  "WBS_EVM_STATUS_DATE_BEFORE_BASELINE",
  "WBS_EVM_STATUS_DATE_REQUIRED",
]);

/**
 * Basic／高度Dashboardの取得、再読込、既存業務画面への遷移を管理する。
 * 初期表示後は明示的な再読込だけを行い、Spring Sessionを延長する定期pollingは追加しない。
 */
export const useDashboardPage = () => {
  const router = useRouter();
  const { canExpandNotification, isNotificationExpanded, openOrToggleNotification } =
    useExpandableNotificationMessages();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const dashboard = ref<BasicDashboardResponse | null>(null);
  const advancedDashboard = ref<AdvancedDashboardResponse | null>(null);
  const advancedStatusDate = ref("");
  const errorMessages = ref<string[]>([]);
  const advancedErrorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const isAdvancedLoading = ref(false);
  const isAdvancedNotEntitled = ref(false);

  const displayName = computed(() => userStore.displayName ?? userStore.username ?? "利用者");
  const isInitialLoading = computed(() => isLoading.value && dashboard.value === null);

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
    hasApiFieldError(error.errorResponse, "FEATURE_NOT_ENTITLED", "featureCode");

  /** 高度Dashboard APIのstatusをSession、upgrade案内、業務エラーへ分離する。 */
  const handleAdvancedApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof DashboardApiError)) {
      advancedErrorMessages.value = [DISPLAY_MESSAGES.dashboard.advancedConnectionFailed];
      return;
    }
    if (error.status === 401) {
      await expireSession();
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
    advancedErrorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      DASHBOARD_ERROR_CODES,
      DISPLAY_MESSAGES.dashboard.advancedLoadFailed
    );
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
    const validationErrors = validateEarnedValueStatusDate(normalizedStatusDate);
    if (validationErrors.length > 0) {
      advancedErrorMessages.value = validationErrors;
      return;
    }
    advancedStatusDate.value = normalizedStatusDate;
    isAdvancedLoading.value = true;
    isAdvancedNotEntitled.value = false;
    advancedErrorMessages.value = [];
    try {
      advancedDashboard.value = await DashboardApi.getAdvancedDashboard(normalizedStatusDate);
    } catch (error: unknown) {
      await handleAdvancedApiError(error);
    } finally {
      isAdvancedLoading.value = false;
    }
  };

  /** Dashboard APIのstatusを、認証状態を含む画面案内へ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof DashboardApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await expireSession();
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      DASHBOARD_ERROR_CODES,
      DISPLAY_MESSAGES.dashboard.loadFailed
    );
  };

  /** DashboardのTask previewから既存Board詳細へ遷移する。 */
  const openTask = async (task: DashboardTask): Promise<void> => {
    await router.push({
      name: ROUTE_NAMES.taskBoard,
      params: { projectId: task.projectId },
      query: { taskId: String(task.taskId) },
    });
  };

  /** DashboardのProject cardから既存Boardへ遷移する。 */
  const openProject = async (project: DashboardProject): Promise<void> => {
    await router.push({
      name: ROUTE_NAMES.taskBoard,
      params: { projectId: project.projectId },
    });
  };

  /** 高度DashboardのProject summaryから既存WBS・EVM画面へ遷移する。 */
  const openAdvancedProject = async (project: AdvancedDashboardProject): Promise<void> => {
    await router.push({
      name: ROUTE_NAMES.wbs,
      params: { projectId: project.projectId },
    });
  };

  /**
   * 「再読み込み」を押したときの処理。Dashboardを取り直してから、同じボタンへフォーカスを戻す。
   * 初期表示（`loadDashboard`）ではフォーカスを動かさないよう、利用者の操作だけをこの関数で受ける。
   */
  const reloadDashboard = async (): Promise<void> => {
    await loadDashboard();
    await focusFirstEnabledElement([buildDashboardControlSelector(DASHBOARD_CONTROL.reload)]);
  };

  /** 高度Dashboardの「集計」（またはEVM基準日でEnter）の後に、EVM基準日へフォーカスを戻す。 */
  const submitAdvancedDashboard = async (): Promise<void> => {
    await loadAdvancedDashboard();
    await focusFirstEnabledElement([
      buildDashboardControlSelector(DASHBOARD_CONTROL.advancedStatusDate),
    ]);
  };

  /** 高度機能の資格不足案内から本人の料金・契約画面へ遷移する。 */
  const openBilling = async (): Promise<void> => {
    await router.push({ name: ROUTE_NAMES.billing });
  };

  /**
   * 通知を押したときの処理。Backend通知の安全なFrontend内pathがあればそこへ遷移し、
   * 管理者お知らせのように遷移先がなければ本文の全文表示を切り替える（一覧は2行に切り詰めるため）。
   *
   * @param event 押された通知
   */
  const openNotificationEvent = async (event: DashboardNotificationEvent): Promise<void> => {
    await openOrToggleNotification(event, async (navigationPath) => {
      await router.push(navigationPath);
    });
  };

  /** My Tasksの全件画面へ遷移する。 */
  const openMyTasks = async (): Promise<void> => {
    await router.push({ name: ROUTE_NAMES.myTasks });
  };

  /** 参照可能Projectの一覧画面へ遷移する。 */
  const openProjects = async (): Promise<void> => {
    await router.push({ name: ROUTE_NAMES.projectList });
  };

  /** 本人勤怠画面へ遷移する。 */
  const openAttendance = async (): Promise<void> => {
    await router.push({ name: ROUTE_NAMES.attendance });
  };

  return {
    advancedDashboard,
    advancedErrorMessages,
    advancedStatusDate,
    canExpandNotification,
    dashboard,
    displayName,
    errorMessages,
    isAdvancedLoading,
    isAdvancedNotEntitled,
    isInitialLoading,
    isLoading,
    isNotificationExpanded,
    loadAdvancedDashboard,
    loadDashboard,
    openBilling,
    openAdvancedProject,
    openAttendance,
    openMyTasks,
    openNotificationEvent,
    openProject,
    openProjects,
    openTask,
    reloadDashboard,
    submitAdvancedDashboard,
  };
};
