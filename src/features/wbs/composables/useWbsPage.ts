import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectDetail } from "@/features/project/types/project";
import { useTaskEffortPlans } from "@/features/wbs/composables/useTaskEffortPlans";
import { useTaskWorkLogs } from "@/features/wbs/composables/useTaskWorkLogs";
import { useWbsBaselines } from "@/features/wbs/composables/useWbsBaselines";
import { useWbsDependencies } from "@/features/wbs/composables/useWbsDependencies";
import { useWbsEarnedValue } from "@/features/wbs/composables/useWbsEarnedValue";
import { useWbsWorkingCalendar } from "@/features/wbs/composables/useWbsWorkingCalendar";
import { useWbsReportExport } from "@/features/wbs/composables/useWbsReportExport";
import { useWbsWorkload } from "@/features/wbs/composables/useWbsWorkload";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  TaskDependencyListResponse,
  WbsResponse,
  WbsTask,
  WbsTaskEditForm,
  WbsViewMode,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/**
 * WBS画面の読込、階層変換、Task・依存関係・日別予定実績・稼働日例外編集、workload、競合回復、認証エラーとBoard遷移を管理する。
 * Boardと同じTaskを正本とし、更新競合後はBackendの最新Responseで表示を作り直す。
 */
export const useWbsPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  /** WBSの表示形式。Gantt libraryは表示切替時に初めて読み込むため、既定は階層表。 */
  const activeView = ref<WbsViewMode>("table");
  const dependencyList = ref<TaskDependencyListResponse | null>(null);
  const editingTask = ref<WbsTask | null>(null);
  const editorErrorMessages = ref<string[]>([]);
  const errorMessages = ref<string[]>([]);
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");
  const wbs = ref<WbsResponse | null>(null);
  let sessionInvalidated = false;

  /** Session失効時に別cardや閉じる直前のDialogへ古いAPIエラーを残さない。 */
  const clearWbsApiErrorMessages = (): void => {
    dependencyEditorErrorMessages.value = [];
    earnedValueErrorMessages.value = [];
    baselineEditorErrorMessages.value = [];
    baselineErrorMessages.value = [];
    reportExportErrorMessages.value = [];
    editorErrorMessages.value = [];
    errorMessages.value = [];
    effortPlanEditorErrorMessages.value = [];
    workLogEditorErrorMessages.value = [];
    workloadErrorMessages.value = [];
    workingCalendarEditorErrorMessages.value = [];
    workingCalendarErrorMessages.value = [];
  };

  /** 401受信を記録し、並行中の再取得が古い競合案内を復元できない状態でLoginへ戻す。 */
  const handleUnauthorized = async (): Promise<void> => {
    sessionInvalidated = true;
    clearWbsApiErrorMessages();
    userStore.clearSession();
    await router.push({ name: "Login" });
  };

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const requestedWorkLogTaskId = computed(() => {
    const panel = Array.isArray(route.query.panel)
      ? route.query.panel[0]
      : route.query.panel;
    const value = Array.isArray(route.query.taskId)
      ? route.query.taskId[0]
      : route.query.taskId;
    const parsed = Number(value);
    return panel === "work-logs" && Number.isSafeInteger(parsed) && parsed > 0
      ? parsed
      : null;
  });
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
  const currentProjectRole = computed(
    () =>
      project.value?.members.find(
        (member) => member.accountId === userStore.memberId
      )?.projectRole ?? null
  );
  const canManageProject = computed(
    () =>
      userStore.hasRole("SYSTEM_ADMIN") ||
      currentProjectRole.value === "OWNER" ||
      currentProjectRole.value === "MANAGER"
  );

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
  const {
    isLoadingWorkload,
    loadTaskWorkload,
    reloadTaskWorkload,
    workload,
    workloadDateRange,
    workloadErrorMessages,
  } = useWbsWorkload(context, {
    closeDialogsOnUnauthorized: () => {
      closeEffortPlanDialogAfterOperation();
      closeWorkLogDialogAfterOperation();
    },
  });
  const {
    clearEarnedValue,
    earnedValue,
    earnedValueErrorMessages,
    earnedValueStatusDate,
    isLoadingEarnedValue,
    loadEarnedValueMetrics,
  } = useWbsEarnedValue(context);
  const {
    clearReportExportMessages,
    downloadWbsReport,
    exportingReportType,
    reportExportErrorMessages,
    reportExportSuccessMessage,
  } = useWbsReportExport(context, earnedValueStatusDate);
  const {
    cancelDependencyDelete,
    closeDependencyEditor,
    confirmDependencyDelete,
    dependencies,
    dependencyEditorErrorMessages,
    dependencyPendingDelete,
    dependencyPendingDeleteRow,
    dependencyRows,
    dependencyTaskOptions,
    handleDependencyDeleteDialogVisibility,
    isDeletingDependency,
    isDependencyEditorOpen,
    isDependencyMutating,
    isSavingDependency,
    openDependencyEditor,
    requestDependencyDelete,
    saveDependency,
  } = useWbsDependencies(context, {
    dependencyList,
    // 下で宣言する関数を呼出し時に解決するため、参照を直接渡さず関数で包む。
    reloadPageSnapshot: () => loadPageSnapshot(),
    handleReadApiError: (error) => handleReadApiError(error),
  });
  const {
    activateWbsBaseline,
    activatingBaselineId,
    activeBaseline,
    activeBaselineDetail,
    baselineChangedRows,
    baselineComparisonRows,
    baselineEditorErrorMessages,
    baselineErrorMessages,
    baselineList,
    baselineSuccessMessage,
    canManageBaselines,
    clearBaselineMessages,
    clearBaselines,
    closeBaselineCreateDialog,
    isBaselineCreateDialogOpen,
    isBaselineMutating,
    isCreatingBaseline,
    loadWbsBaselines,
    openBaselineCreateDialog,
    saveWbsBaseline,
  } = useWbsBaselines(context, { onActiveBaselineChanged: clearEarnedValue });
  const {
    canEditSelectedWorkingCalendarTarget,
    cancelWorkingDayDelete,
    clearWorkingCalendarMessages,
    closeWorkingDayEditor,
    confirmWorkingDayDelete,
    handleWorkingDayDeleteDialogVisibility,
    isDeletingWorkingDay,
    isLoadingWorkingCalendar,
    isSavingWorkingDay,
    isWorkingCalendarMutating,
    isWorkingDayEditorOpen,
    loadCurrentWorkingCalendar,
    loadWorkingCalendar,
    openWorkingDayEditor,
    requestWorkingDayDelete,
    saveWorkingDay,
    selectedWorkingCalendarTarget,
    workingCalendar,
    workingCalendarDateRange,
    workingCalendarEditorErrorMessages,
    workingCalendarErrorMessages,
    workingCalendarSelectedTargetKey,
    workingCalendarSuccessMessage,
    workingCalendarTargetOptions,
    workingDayEditingDay,
    workingDayPendingDelete,
  } = useWbsWorkingCalendar(context, { reloadWorkload: reloadTaskWorkload });
  const {
    canEditSelectedEffortPlanTask,
    canManageAnyEffortPlan,
    cancelEffortPlanDelete,
    cancelEffortPlanEdit,
    closeEffortPlanDialog,
    closeEffortPlanDialogAfterOperation,
    confirmEffortPlanDelete,
    editEffortPlan,
    editingEffortPlan,
    effortPlanAssigneeOptions,
    effortPlanEditorErrorMessages,
    effortPlanList,
    effortPlanPendingDelete,
    effortPlanSuccessMessage,
    effortPlanTask,
    handleEffortPlanDeleteDialogVisibility,
    isDeletingEffortPlan,
    isEffortPlanDialogOpen,
    isEffortPlanMutating,
    isLoadingEffortPlans,
    isSavingEffortPlan,
    openEffortPlanDialog,
    requestEffortPlanDelete,
    saveEffortPlan,
  } = useTaskEffortPlans(context, { reloadWorkload: reloadTaskWorkload });
  const {
    canEditSelectedWorkLogTask,
    canManageAnyWorkLog,
    cancelWorkLogDelete,
    cancelWorkLogEdit,
    closeWorkLogDialog,
    closeWorkLogDialogAfterOperation,
    confirmWorkLogDelete,
    editWorkLog,
    editingWorkLog,
    handleWorkLogDeleteDialogVisibility,
    isDeletingWorkLog,
    isLoadingWorkLogs,
    isSavingWorkLog,
    isWorkLogDialogOpen,
    openWorkLogDialog,
    requestWorkLogDelete,
    saveWorkLog,
    workLogEditorErrorMessages,
    workLogList,
    workLogPendingDelete,
    workLogSuccessMessage,
    workLogTask,
    workLogWorkerOptions,
  } = useTaskWorkLogs(context, { reloadWorkload: reloadTaskWorkload });

  const parentOptions = computed(() =>
    editingTask.value === null
      ? []
      : buildWbsParentOptions(
          wbs.value?.tasks ?? [],
          editingTask.value.taskId
        )
  );

  /** WBS API Responseを唯一の画面スナップショットとして差し替える。 */
  const loadWbs = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    wbs.value = await WbsApi.getWbs(projectId.value);
  };

  /** Project member、WBS Task、依存関係、baseline一覧を同じ画面スナップショットとして取得する。 */
  const loadPageSnapshot = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    const [loadedProject, loadedWbs, loadedDependencies] = await Promise.all([
      ProjectApi.getProject(projectId.value),
      WbsApi.getWbs(projectId.value),
      WbsApi.getTaskDependencies(projectId.value),
      loadWbsBaselines(),
    ]);
    project.value = loadedProject;
    wbs.value = loadedWbs;
    dependencyList.value = loadedDependencies;
  };

  /** Project IDを検証し、WBSをBackendの最新Responseへ置き換える。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    errorMessages.value = [];
    clearEarnedValue();
    successMessage.value = "";
    workloadErrorMessages.value = [];
    clearWorkingCalendarMessages();
    clearBaselineMessages();
    clearReportExportMessages();
    if (projectId.value === null) {
      project.value = null;
      wbs.value = null;
      dependencyList.value = null;
      workload.value = null;
      workingCalendar.value = null;
      clearBaselines();
      earnedValue.value = null;
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      await loadPageSnapshot();
      await Promise.all([
        reloadTaskWorkload(),
        loadCurrentWorkingCalendar(),
      ]);
      if (requestedWorkLogTaskId.value !== null) {
        await openWorkLogDialog(requestedWorkLogTaskId.value);
      }
    } catch (error: unknown) {
      project.value = null;
      wbs.value = null;
      dependencyList.value = null;
      workload.value = null;
      workingCalendar.value = null;
      clearBaselines();
      earnedValue.value = null;
      await handleReadApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS APIのstatusを、認証状態を含む参照画面の案内へ変換する。 */
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

  /** TASK_UPDATEを持つ利用者だけに、取得済みTaskの編集Dialogを開く。 */
  const openTaskEditor = (taskId: number): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canEditWbs.value) {
      errorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const task = wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) {
      errorMessages.value = ["編集対象のTaskが見つかりません。"];
      return;
    }
    editingTask.value = { ...task };
    editorErrorMessages.value = [];
    isEditorOpen.value = true;
  };

  /** 保存中でない場合だけ未確定のWBS入力を破棄してDialogを閉じる。 */
  const closeTaskEditor = (): void => {
    if (!isSaving.value) {
      closeTaskEditorAfterSaving();
    }
  };

  /** 更新成功・競合・Session失効時に、保存中でも古いversionを破棄する。 */
  const closeTaskEditorAfterSaving = (): void => {
    isEditorOpen.value = false;
    editingTask.value = null;
    editorErrorMessages.value = [];
  };

  /**
   * 検証済みフォームをWBS更新APIへ送り、成功時はResponse全体で画面を更新する。
   * 409競合では古いDialogを閉じ、最新WBSを再取得して再編集を促す。
   *
   * @param form WBS Task編集Dialogの入力値と取得時点version
   */
  const saveWbsTask = async (form: WbsTaskEditForm): Promise<void> => {
    const currentTask = editingTask.value;
    if (
      isSaving.value ||
      currentTask === null ||
      projectId.value === null
    ) {
      return;
    }
    if (!canEditWbs.value) {
      editorErrorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const validationMessages = validateWbsTaskEditForm(form);
    if (validationMessages.length > 0) {
      editorErrorMessages.value = validationMessages;
      return;
    }

    isSaving.value = true;
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    try {
      wbs.value = await WbsApi.updateWbsTask(
        projectId.value,
        currentTask.taskId,
        buildWbsTaskUpdateRequest(form)
      );
      closeTaskEditorAfterSaving();
      successMessage.value = "WBS Taskを更新しました。";
    } catch (error: unknown) {
      if (error instanceof WbsApiError && error.status === 409) {
        closeTaskEditorAfterSaving();
        errorMessages.value = resolveWbsErrorMessages(
          error,
          DISPLAY_MESSAGES.wbs.conflict
        );
        await reloadWbsAfterConflict();
      } else {
        await handleUpdateApiError(error);
      }
    } finally {
      isSaving.value = false;
    }
  };

  /** 409競合後に最新WBSを取得し、古い親関係とversionを画面へ残さない。 */
  const reloadWbsAfterConflict = async (): Promise<void> => {
    try {
      await loadWbs();
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        await handleReadApiError(refreshError);
        return;
      }
      errorMessages.value.push(DISPLAY_MESSAGES.wbs.reloadFailed);
    }
  };

  /** WBS更新APIのstatusと項目エラーを、DialogまたはSession動作へ変換する。 */
  const handleUpdateApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      closeTaskEditorAfterSaving();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.wbs.updateForbidden];
      return;
    }
    if (error.status === 404) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.wbs.taskNotFound];
      return;
    }
    editorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.updateFailed
    );
  };

  /** 現在のProject IDを保持したままTask Boardへ遷移する。 */
  const openBoard = async (): Promise<void> => {
    if (projectId.value === null) {
      return;
    }
    await router.push({
      name: "TaskBoard",
      params: { projectId: projectId.value },
    });
  };


  return {
    activeView,
    handleDependencyDeleteDialogVisibility,
    handleEffortPlanDeleteDialogVisibility,
    handleWorkLogDeleteDialogVisibility,
    handleWorkingDayDeleteDialogVisibility,
    activateWbsBaseline,
    activeBaseline,
    activeBaselineDetail,
    activatingBaselineId,
    baselineChangedRows,
    baselineComparisonRows,
    baselineEditorErrorMessages,
    baselineErrorMessages,
    baselineList,
    baselineSuccessMessage,
    cancelDependencyDelete,
    cancelEffortPlanDelete,
    cancelEffortPlanEdit,
    cancelWorkLogDelete,
    cancelWorkLogEdit,
    cancelWorkingDayDelete,
    canEditWbs,
    canEditSelectedEffortPlanTask,
    canEditSelectedWorkLogTask,
    canManageAnyEffortPlan,
    canManageAnyWorkLog,
    canManageBaselines,
    canEditSelectedWorkingCalendarTarget,
    closeDependencyEditor,
    closeBaselineCreateDialog,
    closeEffortPlanDialog,
    closeTaskEditor,
    closeWorkLogDialog,
    closeWorkingDayEditor,
    confirmDependencyDelete,
    confirmEffortPlanDelete,
    confirmWorkLogDelete,
    confirmWorkingDayDelete,
    currentAccountId: computed(() => userStore.memberId),
    dependencies,
    dependencyEditorErrorMessages,
    dependencyPendingDelete,
    dependencyPendingDeleteRow,
    dependencyRows,
    dependencyTaskOptions,
    downloadWbsReport,
    earnedValue,
    earnedValueErrorMessages,
    earnedValueStatusDate,
    editingEffortPlan,
    editingTask,
    editingWorkLog,
    editEffortPlan,
    effortPlanAssigneeOptions,
    effortPlanEditorErrorMessages,
    effortPlanList,
    effortPlanPendingDelete,
    effortPlanSuccessMessage,
    effortPlanTask,
    editorErrorMessages,
    errorMessages,
    exportingReportType,
    initialize,
    isDeletingDependency,
    isDeletingEffortPlan,
    isDeletingWorkLog,
    isDeletingWorkingDay,
    isBaselineCreateDialogOpen,
    isBaselineMutating,
    isCreatingBaseline,
    isDependencyEditorOpen,
    isDependencyMutating,
    isEditorOpen,
    isEffortPlanDialogOpen,
    isEffortPlanMutating,
    isLoading,
    isLoadingEarnedValue,
    isLoadingEffortPlans,
    isLoadingWorkload,
    isLoadingWorkingCalendar,
    isSavingDependency,
    isSavingEffortPlan,
    isSaving,
    isSavingWorkLog,
    isSavingWorkingDay,
    isLoadingWorkLogs,
    isWorkLogDialogOpen,
    isWorkingCalendarMutating,
    isWorkingDayEditorOpen,
    milestoneCount,
    openBaselineCreateDialog,
    openBoard,
    openDependencyEditor,
    openEffortPlanDialog,
    openTaskEditor,
    openWorkLogDialog,
    openWorkingDayEditor,
    parentOptions,
    projectId,
    requestDependencyDelete,
    requestEffortPlanDelete,
    requestWorkLogDelete,
    requestWorkingDayDelete,
    reportExportErrorMessages,
    reportExportSuccessMessage,
    rows,
    saveDependency,
    saveWbsBaseline,
    saveEffortPlan,
    saveWbsTask,
    saveWorkLog,
    saveWorkingDay,
    successMessage,
    summaryCount,
    taskCount,
    wbs,
    workLogEditorErrorMessages,
    workLogList,
    workLogPendingDelete,
    workLogSuccessMessage,
    workLogTask,
    workLogWorkerOptions,
    workload,
    workloadDateRange,
    workloadErrorMessages,
    loadTaskWorkload,
    loadEarnedValueMetrics,
    editWorkLog,
    loadWorkingCalendar,
    selectedWorkingCalendarTarget,
    workingCalendar,
    workingCalendarDateRange,
    workingCalendarEditorErrorMessages,
    workingCalendarErrorMessages,
    workingCalendarSelectedTargetKey,
    workingCalendarSuccessMessage,
    workingCalendarTargetOptions,
    workingDayEditingDay,
    workingDayPendingDelete,
  };
};
