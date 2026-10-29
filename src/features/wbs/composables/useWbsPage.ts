import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { resolveProjectMemberDisplayName } from "@/features/project/utils/projectMember";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectDetail } from "@/features/project/types/project";
import { canManageProjectTasks, findProjectRole } from "@/features/project/utils/projectRole";
import { isActiveProject } from "@/features/project/utils/projectStatus";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useTaskEffortPlans } from "@/features/wbs/composables/useTaskEffortPlans";
import { useTaskWorkLogs } from "@/features/wbs/composables/useTaskWorkLogs";
import { useWbsBaselines } from "@/features/wbs/composables/useWbsBaselines";
import { useWbsDependencies } from "@/features/wbs/composables/useWbsDependencies";
import { useWbsEarnedValue } from "@/features/wbs/composables/useWbsEarnedValue";
import { useWbsEstimateAccuracy } from "@/features/wbs/composables/useWbsEstimateAccuracy";
import { useWbsReportExport } from "@/features/wbs/composables/useWbsReportExport";
import { useWbsTaskEditor } from "@/features/wbs/composables/useWbsTaskEditor";
import { useWbsWorkingCalendar } from "@/features/wbs/composables/useWbsWorkingCalendar";
import { useWbsWorkload } from "@/features/wbs/composables/useWbsWorkload";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  TaskDependencyListResponse,
  WbsResponse,
  WbsViewMode,
} from "@/features/wbs/types/wbs";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/**
 * route queryの値を1件の文字列へ揃える。Vue Routerは同名queryの重複時に配列を返すため、先頭だけを採用する。
 */
const firstRouteValue = (
  value: string | null | (string | null)[] | undefined
): string | null | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * route param・queryの値を正の安全な整数IDへ変換する。
 *
 * @returns 正の安全な整数ならその値、それ以外（未指定、数値でない、0以下、小数）はnull
 */
const parsePositiveId = (
  value: string | null | (string | null)[] | undefined
): number | null => {
  const parsed = Number(firstRouteValue(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * WBS画面全体の状態と操作をまとめる統括composable。`WbsPage.vue`から1回だけ呼ぶ。
 *
 * 担当すること:
 * - route paramのProject ID検証、Project・WBS Task・依存関係・baselineの画面スナップショット取得（`initialize`）。
 *   取得順序は「スナップショット → workload・calendar・見積もり精度（並列） → Board導線の日別実績Dialog」で、
 *   いずれかが例外になった場合は全領域の表示データを破棄して画面上部へ理由を表示する。
 * - 階層表の行・種別件数、TASK_UPDATE permissionとProject管理権限の判定、Boardへの遷移。
 * - 401時の全領域のDialogの片付け・エラー消去・Session破棄・Login遷移（`WbsPageContext.handleUnauthorized`）。
 *
 * 領域ごとの状態と操作は次のcomposableへ委ね、それぞれの戻り値を同じ名前のまま返す:
 * `useWbsTaskEditor`（Task編集）、`useWbsDependencies`（依存関係）、`useWbsWorkload`（担当者別workload）、
 * `useWbsWorkingCalendar`（稼働日calendar）、`useTaskEffortPlans`（日別予定）、`useTaskWorkLogs`（日別実績）、
 * `useWbsBaselines`（baseline）、`useWbsEarnedValue`（EVM）、`useWbsReportExport`（Excel帳票）、
 * `useWbsEstimateAccuracy`（完了Taskの予定工数と実績の見積もり精度）。
 * 領域をまたぐ再取得・Dialogのcloseは、各composableのoptionsのcallbackでここから配線する。
 *
 * Boardと同じTaskを正本とし、更新競合後はBackendの最新Responseで表示を作り直す。
 */
export const useWbsPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  /** WBSの表示形式。Gantt libraryは表示切替時に初めて読み込むため、既定は階層表。 */
  const activeView = ref<WbsViewMode>("table");
  /** 依存関係一覧の正本。Project・WBS Taskと同じスナップショットとして取得する。 */
  const dependencyList = ref<TaskDependencyListResponse | null>(null);
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");
  const wbs = ref<WbsResponse | null>(null);
  /** この画面で401を受信済みか。並行中の再取得が完了しても古い競合案内を復元しないために使う。 */
  let sessionInvalidated = false;

  const projectId = computed(() => parsePositiveId(route.params.projectId));
  /** Boardの「日別実績」導線（`?panel=work-logs&taskId=…`）で初期表示後に開くTask ID。導線外ではnull。 */
  const requestedWorkLogTaskId = computed(() =>
    firstRouteValue(route.query.panel) === "work-logs"
      ? parsePositiveId(route.query.taskId)
      : null
  );
  const rows = computed(() => buildWbsTreeRows(wbs.value?.tasks ?? []));
  const taskCount = computed(
    () => rows.value.filter((row) => row.taskType === "TASK").length
  );
  const summaryCount = computed(
    () => rows.value.filter((row) => row.taskType === "SUMMARY").length
  );
  const milestoneCount = computed(
    () => rows.value.filter((row) => row.taskType === "MILESTONE").length
  );
  const canEditWbs = computed(() => userStore.hasPermission("TASK_UPDATE"));
  const currentProjectRole = computed(() =>
    findProjectRole(project.value, userStore.memberId)
  );
  /** WBSの管理操作（baseline等）へ進めるか。SYSTEM_ADMIN、またはProjectのOWNER・MANAGER。 */
  const canManageProject = computed(() =>
    canManageProjectTasks(userStore.hasRole("SYSTEM_ADMIN"), currentProjectRole.value)
  );

  /**
   * 401受信を記録し、全領域のDialogを閉じてからLoginへ戻す。
   * 記録した後は、並行中の再取得が古い競合案内を復元できない（`isSessionInvalidated`）。
   */
  const handleUnauthorized = async (): Promise<void> => {
    // 並列の再取得（例: 稼働日例外の保存後のcalendarとworkload）が両方401になっても、
    // Session破棄とLogin遷移は最初の1回だけ行う。
    if (sessionInvalidated) {
      return;
    }
    sessionInvalidated = true;
    discardAllDialogs();
    clearWbsApiErrorMessages();
    await expireSession();
  };

  const context: WbsPageContext = {
    projectId,
    project,
    wbs,
    rows,
    canEditWbs,
    canManageProject,
    errorMessages,
    successMessage,
    handleUnauthorized,
    isSessionInvalidated: () => sessionInvalidated,
  };

  // 領域間のcallbackは、後で生成するcomposableや下で宣言する関数を呼出し時に解決するため、
  // 参照を直接渡さず関数で包む（生成時点では未初期化のため）。
  const taskEditor = useWbsTaskEditor(context, {
    reloadWbs: () => loadWbs(),
    handleReadApiError: (error) => handleReadApiError(error),
  });
  const dependencyState = useWbsDependencies(context, {
    dependencyList,
    reloadPageSnapshot: () => loadPageSnapshot(),
    handleReadApiError: (error) => handleReadApiError(error),
  });
  const workloadState = useWbsWorkload(context);
  const workingCalendarState = useWbsWorkingCalendar(context, {
    reloadWorkload: () => workloadState.reloadTaskWorkload(),
  });
  const effortPlanState = useTaskEffortPlans(context, {
    reloadWorkload: () => workloadState.reloadTaskWorkload(),
  });
  const workLogState = useTaskWorkLogs(context, {
    reloadWorkload: () => workloadState.reloadTaskWorkload(),
    onDialogClosed: () => void removeWorkLogPanelQuery(),
  });
  const earnedValueState = useWbsEarnedValue(context);
  const reportExportState = useWbsReportExport(
    context,
    earnedValueState.earnedValueStatusDate
  );
  const baselineState = useWbsBaselines(context, {
    onActiveBaselineChanged: () => earnedValueState.clearEarnedValue(),
  });
  const estimateAccuracyState = useWbsEstimateAccuracy(context);

  /**
   * Session失効時に、401を受けた領域に限らず全領域のDialogと削除確認を閉じる。
   * Login遷移前の画面に、取得時点versionを持つ編集中の入力や削除対象を残さない。
   */
  const discardAllDialogs = (): void => {
    taskEditor.discardTaskEditor();
    dependencyState.discardDependencyDialogs();
    workingCalendarState.discardWorkingDayDialogs();
    effortPlanState.discardEffortPlanDialog();
    workLogState.discardWorkLogDialog();
    baselineState.discardBaselineDialogs();
  };

  /** Session失効時に別cardや閉じる直前のDialogへ古いAPIエラーを残さない。 */
  const clearWbsApiErrorMessages = (): void => {
    errorMessages.value = [];
    taskEditor.editorErrorMessages.value = [];
    dependencyState.dependencyEditorErrorMessages.value = [];
    dependencyState.dependencyErrorMessages.value = [];
    workloadState.workloadErrorMessages.value = [];
    workingCalendarState.workingCalendarEditorErrorMessages.value = [];
    workingCalendarState.workingCalendarErrorMessages.value = [];
    effortPlanState.effortPlanEditorErrorMessages.value = [];
    workLogState.workLogEditorErrorMessages.value = [];
    earnedValueState.earnedValueErrorMessages.value = [];
    reportExportState.reportExportErrorMessages.value = [];
    baselineState.baselineEditorErrorMessages.value = [];
    baselineState.baselineErrorMessages.value = [];
    estimateAccuracyState.estimateAccuracyErrorMessages.value = [];
  };

  /** 画面全体の取得失敗時やProject ID不正時に、別Projectや権限喪失前のデータを表示し続けない。 */
  const clearPageData = (): void => {
    project.value = null;
    wbs.value = null;
    dependencyList.value = null;
    workloadState.workload.value = null;
    workingCalendarState.workingCalendar.value = null;
    baselineState.clearBaselines();
    earnedValueState.earnedValue.value = null;
    estimateAccuracyState.estimateAccuracy.value = null;
  };

  /**
   * WBS API Responseで画面のTask一覧だけを差し替える。
   *
   * @throws Error Project IDが不正な場合
   * @throws WbsApiError 取得に失敗した場合
   */
  const loadWbs = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    wbs.value = await WbsApi.getWbs(projectId.value);
  };

  /**
   * Project member、WBS Task、依存関係、baseline一覧を同じ画面スナップショットとして取得する。
   * Project・WBS・依存関係は全取得の成功後にまとめて差し替え、一部だけ新しい状態を表示しない。
   *
   * @throws Error Project IDが不正な場合
   * @throws WbsApiError | ProjectApiError いずれかの取得に失敗した場合
   */
  const loadPageSnapshot = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    const [loadedProject, loadedWbs, loadedDependencies] = await Promise.all([
      ProjectApi.getProject(projectId.value),
      WbsApi.getWbs(projectId.value),
      WbsApi.getTaskDependencies(projectId.value),
      baselineState.loadWbsBaselines(),
    ]);
    project.value = loadedProject;
    wbs.value = loadedWbs;
    dependencyList.value = loadedDependencies;
  };

  /**
   * Project IDを検証し、画面全体をBackendの最新Responseへ置き換える。初期表示と「再読込」から呼ぶ。
   * 読込中の再実行は無視する。前回の操作結果messageとEVMは破棄し、各入力欄の期間・基準日・表示対象は残す。
   */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    earnedValueState.clearEarnedValue();
    workloadState.workloadErrorMessages.value = [];
    estimateAccuracyState.estimateAccuracyErrorMessages.value = [];
    dependencyState.clearDependencyMessages();
    workingCalendarState.clearWorkingCalendarMessages();
    baselineState.clearBaselineMessages();
    reportExportState.clearReportExportMessages();
    if (projectId.value === null) {
      clearPageData();
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      // calendarの表示対象候補はProject memberから作るため、workloadとcalendarはスナップショットの取得後に読み込む。
      // 見積もり精度も、Projectの参照可否をスナップショットで確定してから取得する。
      await loadPageSnapshot();
      await Promise.all([
        workloadState.reloadTaskWorkload(),
        workingCalendarState.loadCurrentWorkingCalendar(),
        estimateAccuracyState.loadEstimateAccuracy(),
      ]);
      if (requestedWorkLogTaskId.value !== null) {
        await workLogState.openWorkLogDialog(requestedWorkLogTaskId.value);
      }
    } catch (error: unknown) {
      clearPageData();
      await handleReadApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS・Project参照APIのstatusを、認証状態を含む画面上部の案内へ変換する。 */
  const handleReadApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError) && !(error instanceof ProjectApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [DISPLAY_MESSAGES.wbs.readForbidden];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [DISPLAY_MESSAGES.wbs.projectNotFound];
      return;
    }
    errorMessages.value = [DISPLAY_MESSAGES.wbs.readFailed];
  };

  /**
   * Boardの導線で付いた`panel=work-logs`と`taskId`をURLから外す。
   * 残したままだと、再読込やブラウザの戻る操作で閉じた日別実績Dialogが再び開くため。
   * 履歴を増やさないよう`replace`し、他のqueryは保持する。
   */
  const removeWorkLogPanelQuery = async (): Promise<void> => {
    if (firstRouteValue(route.query.panel) !== "work-logs") {
      return;
    }
    const { panel: _panel, taskId: _taskId, ...remainingQuery } = route.query;
    await router.replace({ query: remainingQuery });
  };

  /**
   * WBS表の担当者列に出す参加者名を返す。Projectから外れたアカウント（過去の担当者）は`ID: {accountId}`で示す。
   *
   * @param accountId Taskの担当者アカウントID
   * @returns 参加者の表示名
   */
  const resolveAssigneeDisplayName = (accountId: number): string =>
    resolveProjectMemberDisplayName(project.value?.members ?? [], accountId);

  /** 現在のProject IDを保持したままTask Boardへ遷移する。Project IDが不正なら遷移しない。 */
  const openBoard = async (): Promise<void> => {
    if (projectId.value === null) {
      return;
    }
    await router.push({
      name: ROUTE_NAMES.taskBoard,
      params: { projectId: projectId.value },
    });
  };

  return {
    ...taskEditor,
    ...dependencyState,
    ...workloadState,
    ...workingCalendarState,
    ...effortPlanState,
    ...workLogState,
    ...earnedValueState,
    ...reportExportState,
    ...baselineState,
    ...estimateAccuracyState,
    activeView,
    canEditWbs,
    currentAccountId: computed(() => userStore.memberId),
    /** Projectが利用中（ACTIVE）か。archive済み・未取得はfalse。 */
    isProjectActive: computed(() => isActiveProject(project.value)),
    errorMessages,
    initialize,
    isLoading,
    milestoneCount,
    openBoard,
    projectId,
    resolveAssigneeDisplayName,
    rows,
    successMessage,
    summaryCount,
    taskCount,
    wbs,
  };
};
