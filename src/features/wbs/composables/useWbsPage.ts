import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectDetail } from "@/features/project/types/project";
import { useWbsBaselines } from "@/features/wbs/composables/useWbsBaselines";
import { useWbsDependencies } from "@/features/wbs/composables/useWbsDependencies";
import { useWbsEarnedValue } from "@/features/wbs/composables/useWbsEarnedValue";
import { useWbsReportExport } from "@/features/wbs/composables/useWbsReportExport";
import { useWbsWorkload } from "@/features/wbs/composables/useWbsWorkload";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  TaskDependencyListResponse,
  TaskEffortPlan,
  TaskEffortPlanAssigneeOption,
  TaskEffortPlanForm,
  TaskEffortPlanListResponse,
  TaskWorkLog,
  TaskWorkLogForm,
  TaskWorkLogListResponse,
  TaskWorkLogWorkerOption,
  WorkingCalendarDateRange,
  WorkingCalendarDay,
  WorkingCalendarResponse,
  WorkingCalendarTargetOption,
  WorkingDayForm,
  WorkingDayOverride,
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
  buildTaskEffortPlanCreateRequest,
  buildTaskEffortPlanUpdateRequest,
  validateTaskEffortPlanForm,
} from "@/features/wbs/utils/taskEffortPlan";
import {
  buildTaskWorkLogCreateRequest,
  buildTaskWorkLogUpdateRequest,
  validateTaskWorkLogForm,
} from "@/features/wbs/utils/taskWorkLog";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";
import {
  buildDefaultWorkingCalendarDateRange,
  buildWorkingCalendarTargetKey,
  buildWorkingDayCreateRequest,
  buildWorkingDayUpdateRequest,
  getWorkingDayOverride,
  parseWorkingCalendarTargetKey,
  validateWorkingCalendarDateRange,
  validateWorkingDayForm,
} from "@/features/wbs/utils/workingCalendar";
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
  const editingEffortPlan = ref<TaskEffortPlan | null>(null);
  const editingTask = ref<WbsTask | null>(null);
  const editorErrorMessages = ref<string[]>([]);
  const errorMessages = ref<string[]>([]);
  const isDeletingEffortPlan = ref(false);
  const isEditorOpen = ref(false);
  const isEffortPlanDialogOpen = ref(false);
  const isLoading = ref(false);
  const isLoadingEffortPlans = ref(false);
  const isSavingEffortPlan = ref(false);
  const isSaving = ref(false);
  const editingWorkLog = ref<TaskWorkLog | null>(null);
  const isDeletingWorkLog = ref(false);
  const isLoadingWorkLogs = ref(false);
  const isSavingWorkLog = ref(false);
  const isWorkLogDialogOpen = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");
  const effortPlanEditorErrorMessages = ref<string[]>([]);
  const effortPlanList = ref<TaskEffortPlanListResponse | null>(null);
  const effortPlanPendingDelete = ref<TaskEffortPlan | null>(null);
  const effortPlanSuccessMessage = ref("");
  const effortPlanTask = ref<WbsTask | null>(null);
  const workLogEditorErrorMessages = ref<string[]>([]);
  const workLogList = ref<TaskWorkLogListResponse | null>(null);
  const workLogPendingDelete = ref<TaskWorkLog | null>(null);
  const workLogSuccessMessage = ref("");
  const workLogTask = ref<WbsTask | null>(null);
  const workingCalendar = ref<WorkingCalendarResponse | null>(null);
  const workingCalendarDateRange = ref<WorkingCalendarDateRange>(
    buildDefaultWorkingCalendarDateRange()
  );
  const workingCalendarEditorErrorMessages = ref<string[]>([]);
  const workingCalendarErrorMessages = ref<string[]>([]);
  const workingCalendarSelectedTargetKey = ref("PROJECT");
  const workingCalendarSuccessMessage = ref("");
  const workingDayEditingDay = ref<WorkingCalendarDay | null>(null);
  const workingDayPendingDelete = ref<WorkingDayOverride | null>(null);
  const isDeletingWorkingDay = ref(false);
  const isLoadingWorkingCalendar = ref(false);
  const isSavingWorkingDay = ref(false);
  const isWorkingDayEditorOpen = ref(false);
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

  const canManageAnyWorkLog = computed(() => canManageProject.value);
  const canManageAnyEffortPlan = computed(
    () => canManageAnyWorkLog.value
  );
  const workingCalendarTargetOptions = computed<
    WorkingCalendarTargetOption[]
  >(() => {
    const options: WorkingCalendarTargetOption[] = [
      { title: "Project共通", value: "PROJECT" },
    ];
    const members = (project.value?.members ?? []).filter(
      (member) =>
        canManageProject.value || member.accountId === userStore.memberId
    );
    return options.concat(
      members.map((member) => ({
        title: `個人例外: アカウントID ${member.accountId}（${member.projectRole}）`,
        value: buildWorkingCalendarTargetKey({
          kind: "MEMBER",
          accountId: member.accountId,
        }),
      }))
    );
  });
  const selectedWorkingCalendarTarget = computed(() =>
    parseWorkingCalendarTargetKey(workingCalendarSelectedTargetKey.value)
  );
  const canEditSelectedWorkingCalendarTarget = computed(() => {
    const target = selectedWorkingCalendarTarget.value;
    if (
      !canEditWbs.value ||
      project.value?.status !== "ACTIVE" ||
      target === null
    ) {
      return false;
    }
    return target.kind === "PROJECT"
      ? canManageProject.value
      : canManageProject.value || target.accountId === userStore.memberId;
  });
  const isWorkingCalendarMutating = computed(
    () => isSavingWorkingDay.value || isDeletingWorkingDay.value
  );
  const canEditSelectedEffortPlanTask = computed(
    () =>
      canEditWbs.value &&
      effortPlanTask.value !== null &&
      (canManageAnyEffortPlan.value ||
        effortPlanTask.value.assigneeAccountId === userStore.memberId)
  );
  const effortPlanAssigneeOptions = computed<TaskEffortPlanAssigneeOption[]>(
    () =>
      (project.value?.members ?? [])
        .filter(
          (member) =>
            canManageAnyEffortPlan.value ||
            member.accountId === userStore.memberId
        )
        .map((member) => ({
          title: `アカウントID: ${member.accountId}（${member.projectRole}）`,
          value: member.accountId,
        }))
  );
  const isEffortPlanMutating = computed(
    () => isSavingEffortPlan.value || isDeletingEffortPlan.value
  );
  const canEditSelectedWorkLogTask = computed(
    () =>
      canEditWbs.value &&
      workLogTask.value !== null &&
      (canManageAnyWorkLog.value ||
        workLogTask.value.assigneeAccountId === userStore.memberId)
  );
  const workLogWorkerOptions = computed<TaskWorkLogWorkerOption[]>(() =>
    (project.value?.members ?? [])
      .filter(
        (member) =>
          canManageAnyWorkLog.value || member.accountId === userStore.memberId
      )
      .map((member) => ({
        title: `アカウントID: ${member.accountId}（${member.projectRole}）`,
        value: member.accountId,
      }))
  );
  const isWorkLogMutating = computed(
    () => isSavingWorkLog.value || isDeletingWorkLog.value
  );
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
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
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
        loadWorkingCalendar(
          workingCalendarDateRange.value,
          workingCalendarSelectedTargetKey.value
        ),
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

  /** 指定期間・対象の稼働日calendarを検証・取得し、既定値を含む確定表示へ反映する。 */
  const loadWorkingCalendar = async (
    dateRange: WorkingCalendarDateRange,
    targetKey: string
  ): Promise<void> => {
    if (projectId.value === null || isLoadingWorkingCalendar.value) {
      return;
    }
    const validationMessages = validateWorkingCalendarDateRange(dateRange);
    const target = parseWorkingCalendarTargetKey(targetKey);
    if (
      target === null ||
      !workingCalendarTargetOptions.value.some(
        (option) => option.value === targetKey
      )
    ) {
      validationMessages.push("calendarの表示対象を選択してください。");
    }
    if (validationMessages.length > 0 || target === null) {
      workingCalendarErrorMessages.value = validationMessages;
      return;
    }

    isLoadingWorkingCalendar.value = true;
    workingCalendarErrorMessages.value = [];
    workingCalendarSelectedTargetKey.value = targetKey;
    workingCalendarDateRange.value = { ...dateRange };
    // 対象切替中に直前対象の例外へ更新・削除操作を行わせない。
    workingCalendar.value = null;
    try {
      workingCalendar.value = await WbsApi.getWorkingCalendar(
        projectId.value,
        dateRange.dateFrom,
        dateRange.dateTo,
        target.accountId
      );
    } catch (error: unknown) {
      await handleWorkingCalendarReadError(error);
    } finally {
      isLoadingWorkingCalendar.value = false;
    }
  };

  /** calendar参照APIのstatusを検索欄の案内またはSession動作へ変換する。 */
  const handleWorkingCalendarReadError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeWorkingDayEditorAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workingCalendar.readForbidden,
      ];
      return;
    }
    if (error.status === 404) {
      workingCalendarErrorMessages.value = [DISPLAY_MESSAGES.wbs.projectNotFound];
      return;
    }
    workingCalendarErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workingCalendar.loadFailed
    );
  };

  /** 表示中calendarの日付を選択し、現在の有効値または保存済み例外で編集Dialogを開く。 */
  const openWorkingDayEditor = (workDate: string): void => {
    workingCalendarEditorErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を更新する権限がありません。",
      ];
      return;
    }
    const day = workingCalendar.value?.days.find(
      (candidate) => candidate.workDate === workDate
    );
    if (day === undefined) {
      workingCalendarErrorMessages.value = [
        "編集対象のcalendar日付が見つかりません。",
      ];
      return;
    }
    workingDayEditingDay.value = {
      ...day,
      projectOverride:
        day.projectOverride === null ? null : { ...day.projectOverride },
      memberOverride:
        day.memberOverride === null ? null : { ...day.memberOverride },
    };
    isWorkingDayEditorOpen.value = true;
  };

  /** 保存中でなければ未確定の稼働日例外入力を破棄してDialogを閉じる。 */
  const closeWorkingDayEditor = (): void => {
    if (!isSavingWorkingDay.value) {
      closeWorkingDayEditorAfterOperation();
    }
  };

  /** 保存確定、競合、Session失効時に処理中状態に依存せず古いversionを破棄する。 */
  const closeWorkingDayEditorAfterOperation = (): void => {
    isWorkingDayEditorOpen.value = false;
    workingDayEditingDay.value = null;
    workingCalendarEditorErrorMessages.value = [];
  };

  /**
   * 稼働日例外Formを検証し、選択中のProject共通・member固有階層の登録または更新へ振り分ける。
   * Backendの変更Responseは対象日だけなので、保存後はcalendar全体と容量計算済みworkloadを再取得する。
   *
   * @param form 設定日、種別、分単位稼働可能時間を含む未検証入力
   */
  const saveWorkingDay = async (form: WorkingDayForm): Promise<void> => {
    const target = selectedWorkingCalendarTarget.value;
    const day = workingDayEditingDay.value;
    if (
      isSavingWorkingDay.value ||
      projectId.value === null ||
      target === null ||
      day === null
    ) {
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarEditorErrorMessages.value = [
        "このcalendar設定を更新する権限がありません。",
      ];
      return;
    }
    const validationMessages = validateWorkingDayForm(form);
    if (validationMessages.length > 0) {
      workingCalendarEditorErrorMessages.value = validationMessages;
      return;
    }
    const currentOverride = getWorkingDayOverride(day, target);

    isSavingWorkingDay.value = true;
    workingCalendarEditorErrorMessages.value = [];
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    try {
      if (target.kind === "PROJECT") {
        if (currentOverride === null) {
          await WbsApi.createProjectWorkingDay(
            projectId.value,
            buildWorkingDayCreateRequest(form)
          );
        } else {
          await WbsApi.updateProjectWorkingDay(
            projectId.value,
            currentOverride.workingDayId,
            buildWorkingDayUpdateRequest(form, currentOverride.version)
          );
        }
      } else if (currentOverride === null) {
        await WbsApi.createMemberWorkingDay(
          projectId.value,
          target.accountId,
          buildWorkingDayCreateRequest(form)
        );
      } else {
        await WbsApi.updateMemberWorkingDay(
          projectId.value,
          target.accountId,
          currentOverride.workingDayId,
          buildWorkingDayUpdateRequest(form, currentOverride.version)
        );
      }
      closeWorkingDayEditorAfterOperation();
      workingCalendarSuccessMessage.value =
        currentOverride === null
          ? "稼働日例外を登録しました。"
          : "稼働日例外を更新しました。";
      await reloadWorkingCalendarAndWorkload();
    } catch (error: unknown) {
      await handleWorkingDayMutationError(error);
    } finally {
      isSavingWorkingDay.value = false;
    }
  };

  /** 稼働日例外登録・更新APIのstatusを入力案内、競合再取得またはSession動作へ変換する。 */
  const handleWorkingDayMutationError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workingCalendarEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeWorkingDayEditorAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workingCalendarEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workingCalendar.updateForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      closeWorkingDayEditorAfterOperation();
      workingDayPendingDelete.value = null;
      workingCalendarErrorMessages.value = resolveWbsErrorMessages(
        error,
        error.status === 409
          ? DISPLAY_MESSAGES.wbs.workingCalendar.conflict
          : DISPLAY_MESSAGES.wbs.workingCalendar.resourceNotFound
      );
      await reloadWorkingCalendarAndWorkload();
      return;
    }
    workingCalendarEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workingCalendar.saveFailed
    );
  };

  /** 表示中の選択階層から削除対象と取得時点versionを確定して確認Dialogを開く。 */
  const requestWorkingDayDelete = (workDate: string): void => {
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    const target = selectedWorkingCalendarTarget.value;
    const day = workingCalendar.value?.days.find(
      (candidate) => candidate.workDate === workDate
    );
    const override =
      target === null || day === undefined
        ? null
        : getWorkingDayOverride(day, target);
    if (override === null) {
      workingCalendarErrorMessages.value = [
        "削除対象の稼働日例外が見つかりません。",
      ];
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を削除する権限がありません。",
      ];
      return;
    }
    workingDayPendingDelete.value = { ...override };
  };

  /** 削除中でなければ稼働日例外の確認対象を破棄する。 */
  const cancelWorkingDayDelete = (): void => {
    if (!isDeletingWorkingDay.value) {
      workingDayPendingDelete.value = null;
    }
  };

  /** 選択階層の稼働日例外を取得時点versionで削除し、calendar全体とworkloadを再取得する。 */
  const confirmWorkingDayDelete = async (): Promise<void> => {
    const target = selectedWorkingCalendarTarget.value;
    const override = workingDayPendingDelete.value;
    if (
      projectId.value === null ||
      target === null ||
      override === null ||
      isDeletingWorkingDay.value
    ) {
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を削除する権限がありません。",
      ];
      return;
    }

    isDeletingWorkingDay.value = true;
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    try {
      if (target.kind === "PROJECT") {
        await WbsApi.deleteProjectWorkingDay(
          projectId.value,
          override.workingDayId,
          override.version
        );
      } else {
        await WbsApi.deleteMemberWorkingDay(
          projectId.value,
          target.accountId,
          override.workingDayId,
          override.version
        );
      }
      workingDayPendingDelete.value = null;
      workingCalendarSuccessMessage.value = "稼働日例外を削除しました。";
      await reloadWorkingCalendarAndWorkload();
    } catch (error: unknown) {
      await handleWorkingDayDeleteError(error);
    } finally {
      isDeletingWorkingDay.value = false;
    }
  };

  /** 稼働日例外削除APIのstatusを競合再取得、認可案内またはSession動作へ変換する。 */
  const handleWorkingDayDeleteError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      workingDayPendingDelete.value = null;
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workingCalendar.deleteForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      workingDayPendingDelete.value = null;
      workingCalendarErrorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.workingCalendar.stale
      );
      await reloadWorkingCalendarAndWorkload();
      return;
    }
    workingCalendarErrorMessages.value = [
      DISPLAY_MESSAGES.wbs.workingCalendar.deleteFailed,
    ];
  };

  /** 現在の期間・対象でcalendarを再取得し、古い例外IDとversionを残さない。 */
  const reloadWorkingCalendar = async (): Promise<void> => {
    const messagesBeforeReload = [...workingCalendarErrorMessages.value];
    const target = selectedWorkingCalendarTarget.value;
    if (projectId.value === null || target === null) {
      workingCalendarErrorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.wbs.workingCalendar.reloadFailed,
      ];
      return;
    }
    try {
      workingCalendar.value = await WbsApi.getWorkingCalendar(
        projectId.value,
        workingCalendarDateRange.value.dateFrom,
        workingCalendarDateRange.value.dateTo,
        target.accountId
      );
      if (!sessionInvalidated) {
        workingCalendarErrorMessages.value = messagesBeforeReload;
      }
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // Session・permission・公開範囲の変化は、操作時点の競合理由より優先する。
        await handleWorkingCalendarReadError(refreshError);
        return;
      }
      workingCalendarErrorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.wbs.workingCalendar.reloadFailed,
      ];
    }
  };

  /**
   * calendar変更後に有効な稼働可能時間とworkload容量を同じBackend状態へ揃える。
   *
   * workloadはcalendar例外から稼働可能時間を算出するため、calendarだけを再取得すると
   * 稼働可能時間・残容量・過配賦表示が次回の手動集計まで古い値になる。
   */
  const reloadWorkingCalendarAndWorkload = async (): Promise<void> => {
    await Promise.all([
      reloadWorkingCalendar(),
      reloadTaskWorkload(),
    ]);
  };

  /** 通常Taskだけを選択し、日別予定Dialogを開いて最新の配賦状況を取得する。 */
  const openEffortPlanDialog = async (taskId: number): Promise<void> => {
    if (isLoadingEffortPlans.value || isEffortPlanMutating.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    const task = wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) {
      errorMessages.value = ["予定工数を参照するTaskが見つかりません。"];
      return;
    }
    if (task.taskType !== "TASK") {
      errorMessages.value = [
        "日別予定工数を登録できるのは通常Taskだけです。",
      ];
      return;
    }

    effortPlanTask.value = { ...task };
    effortPlanList.value = null;
    editingEffortPlan.value = null;
    effortPlanPendingDelete.value = null;
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
    isEffortPlanDialogOpen.value = true;
    await loadSelectedTaskEffortPlans();
  };

  /** 選択中Taskの日別予定一覧を取得し、Dialogの唯一の配賦スナップショットへ反映する。 */
  const loadSelectedTaskEffortPlans = async (): Promise<void> => {
    const task = effortPlanTask.value;
    if (
      task === null ||
      projectId.value === null ||
      isLoadingEffortPlans.value
    ) {
      return;
    }
    isLoadingEffortPlans.value = true;
    try {
      effortPlanList.value = await WbsApi.getTaskEffortPlans(
        projectId.value,
        task.taskId
      );
    } catch (error: unknown) {
      await handleEffortPlanReadError(error);
    } finally {
      isLoadingEffortPlans.value = false;
    }
  };

  /** 日別予定参照APIのstatusをDialog案内またはSession動作へ変換する。 */
  const handleEffortPlanReadError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeEffortPlanDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.effortPlan.readForbidden,
      ];
      return;
    }
    if (error.status === 404) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.effortPlan.readNotFound,
      ];
      return;
    }
    effortPlanEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.effortPlan.loadFailed
    );
  };

  /** 読込・保存・削除中でなければ日別予定Dialogと一時状態を破棄する。 */
  const closeEffortPlanDialog = (): void => {
    if (!isLoadingEffortPlans.value && !isEffortPlanMutating.value) {
      closeEffortPlanDialogAfterOperation();
    }
  };

  /** Session失効や確定操作後にも使用できるよう、処理中状態に依存せずDialogを閉じる。 */
  const closeEffortPlanDialogAfterOperation = (): void => {
    isEffortPlanDialogOpen.value = false;
    effortPlanTask.value = null;
    effortPlanList.value = null;
    editingEffortPlan.value = null;
    effortPlanPendingDelete.value = null;
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
  };

  /** 現在のProject roleと予定担当者IDから日別予定を変更できるか画面上で判定する。 */
  const canMutateEffortPlan = (effortPlan: TaskEffortPlan): boolean =>
    canEditSelectedEffortPlanTask.value &&
    (canManageAnyEffortPlan.value ||
      effortPlan.assigneeAccountId === userStore.memberId);

  /** 取得済み日別予定を複製し、取得時点versionを保持した編集状態へ移す。 */
  const editEffortPlan = (effortPlanId: number): void => {
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
    const effortPlan = effortPlanList.value?.effortPlans.find(
      (candidate) => candidate.effortPlanId === effortPlanId
    );
    if (effortPlan === undefined) {
      effortPlanEditorErrorMessages.value = [
        "編集対象の日別予定工数が見つかりません。",
      ];
      return;
    }
    if (!canMutateEffortPlan(effortPlan)) {
      effortPlanEditorErrorMessages.value = [
        "この日別予定工数を更新する権限がありません。",
      ];
      return;
    }
    editingEffortPlan.value = { ...effortPlan };
  };

  /** 保存中でなければ編集対象を破棄し、新規登録Formへ戻す。 */
  const cancelEffortPlanEdit = (): void => {
    if (!isSavingEffortPlan.value) {
      editingEffortPlan.value = null;
      effortPlanEditorErrorMessages.value = [];
      effortPlanSuccessMessage.value = "";
    }
  };

  /**
   * 日別予定Formを検証し、新規登録または取得時点version付き更新へ振り分ける。
   * 保存後は担当者別workloadも再取得し、予定合計と集計表示を一致させる。
   *
   * @param form 予定日、分単位工数、予定担当者を含む未検証入力
   */
  const saveEffortPlan = async (form: TaskEffortPlanForm): Promise<void> => {
    const task = effortPlanTask.value;
    if (
      isSavingEffortPlan.value ||
      task === null ||
      projectId.value === null
    ) {
      return;
    }
    if (!canEditSelectedEffortPlanTask.value) {
      effortPlanEditorErrorMessages.value = [
        "このTaskの日別予定を更新する権限がありません。",
      ];
      return;
    }
    const allowedAssigneeIds = new Set(
      effortPlanAssigneeOptions.value.map((option) => option.value)
    );
    const validationMessages = validateTaskEffortPlanForm(
      form,
      allowedAssigneeIds
    );
    if (validationMessages.length > 0) {
      effortPlanEditorErrorMessages.value = validationMessages;
      return;
    }
    const currentEffortPlan = editingEffortPlan.value;
    if (currentEffortPlan !== null && !canMutateEffortPlan(currentEffortPlan)) {
      effortPlanEditorErrorMessages.value = [
        "この日別予定工数を更新する権限がありません。",
      ];
      return;
    }

    isSavingEffortPlan.value = true;
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
    try {
      effortPlanList.value =
        currentEffortPlan === null
          ? await WbsApi.createTaskEffortPlan(
              projectId.value,
              task.taskId,
              buildTaskEffortPlanCreateRequest(form)
            )
          : await WbsApi.updateTaskEffortPlan(
              projectId.value,
              task.taskId,
              currentEffortPlan.effortPlanId,
              buildTaskEffortPlanUpdateRequest(
                form,
                currentEffortPlan.version
              )
            );
      editingEffortPlan.value = null;
      effortPlanSuccessMessage.value =
        currentEffortPlan === null
          ? "Task日別予定を登録しました。"
          : "Task日別予定を更新しました。";
      await reloadTaskWorkload();
    } catch (error: unknown) {
      await handleEffortPlanMutationError(error);
    } finally {
      isSavingEffortPlan.value = false;
    }
  };

  /** 登録・更新APIのstatusを入力案内、競合再読込またはSession動作へ変換する。 */
  const handleEffortPlanMutationError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeEffortPlanDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.effortPlan.updateForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      editingEffortPlan.value = null;
      effortPlanPendingDelete.value = null;
      effortPlanEditorErrorMessages.value = resolveWbsErrorMessages(
        error,
        error.status === 409
          ? DISPLAY_MESSAGES.wbs.effortPlan.conflict
          : DISPLAY_MESSAGES.wbs.effortPlan.resourceNotFound
      );
      await reloadEffortPlansAfterConflict();
      return;
    }
    effortPlanEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.effortPlan.saveFailed
    );
  };

  /** 競合後に日別予定とworkloadを再取得し、古いversion・配賦集計を残さない。 */
  const reloadEffortPlansAfterConflict = async (): Promise<void> => {
    try {
      await loadSelectedTaskEffortPlans();
      await reloadTaskWorkload();
    } catch (_error: unknown) {
      effortPlanEditorErrorMessages.value.push(
        DISPLAY_MESSAGES.wbs.effortPlan.reloadFailed
      );
    }
  };

  /** 取得済み一覧から削除対象とversionを確定して確認Dialogを開く。 */
  const requestEffortPlanDelete = (effortPlanId: number): void => {
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
    const effortPlan = effortPlanList.value?.effortPlans.find(
      (candidate) => candidate.effortPlanId === effortPlanId
    );
    if (effortPlan === undefined) {
      effortPlanEditorErrorMessages.value = [
        "削除対象の日別予定工数が見つかりません。",
      ];
      return;
    }
    if (!canMutateEffortPlan(effortPlan)) {
      effortPlanEditorErrorMessages.value = [
        "この日別予定工数を削除する権限がありません。",
      ];
      return;
    }
    effortPlanPendingDelete.value = { ...effortPlan };
  };

  /** 削除中でなければ日別予定の確認対象を破棄して確認Dialogを閉じる。 */
  const cancelEffortPlanDelete = (): void => {
    if (!isDeletingEffortPlan.value) {
      effortPlanPendingDelete.value = null;
    }
  };

  /** 一覧取得時点versionで日別予定を削除し、204確定後だけ配賦一覧とworkloadを更新する。 */
  const confirmEffortPlanDelete = async (): Promise<void> => {
    const task = effortPlanTask.value;
    const effortPlan = effortPlanPendingDelete.value;
    if (
      task === null ||
      effortPlan === null ||
      projectId.value === null ||
      isDeletingEffortPlan.value
    ) {
      return;
    }
    if (!canMutateEffortPlan(effortPlan)) {
      effortPlanEditorErrorMessages.value = [
        "この日別予定工数を削除する権限がありません。",
      ];
      return;
    }

    isDeletingEffortPlan.value = true;
    effortPlanEditorErrorMessages.value = [];
    effortPlanSuccessMessage.value = "";
    try {
      await WbsApi.deleteTaskEffortPlan(
        projectId.value,
        task.taskId,
        effortPlan.effortPlanId,
        effortPlan.version
      );
      if (effortPlanList.value !== null) {
        const remainingEffortPlans = effortPlanList.value.effortPlans.filter(
          (candidate) => candidate.effortPlanId !== effortPlan.effortPlanId
        );
        const totalDailyPlannedEffortMinutes = remainingEffortPlans.reduce(
          (total, candidate) => total + candidate.plannedEffortMinutes,
          0
        );
        effortPlanList.value = {
          ...effortPlanList.value,
          totalDailyPlannedEffortMinutes,
          unallocatedEffortMinutes:
            effortPlanList.value.taskPlannedEffortMinutes -
            totalDailyPlannedEffortMinutes,
          effortPlans: remainingEffortPlans,
        };
      }
      editingEffortPlan.value =
        editingEffortPlan.value?.effortPlanId === effortPlan.effortPlanId
          ? null
          : editingEffortPlan.value;
      effortPlanPendingDelete.value = null;
      effortPlanSuccessMessage.value = "Task日別予定を削除しました。";
      await reloadTaskWorkload();
    } catch (error: unknown) {
      await handleEffortPlanDeleteError(error);
    } finally {
      isDeletingEffortPlan.value = false;
    }
  };

  /** 日別予定削除APIのstatusを競合再読込、認可案内またはSession動作へ変換する。 */
  const handleEffortPlanDeleteError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeEffortPlanDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      effortPlanEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.effortPlan.deleteForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      editingEffortPlan.value = null;
      effortPlanPendingDelete.value = null;
      effortPlanEditorErrorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.effortPlan.stale
      );
      await reloadEffortPlansAfterConflict();
      return;
    }
    effortPlanEditorErrorMessages.value = [
      DISPLAY_MESSAGES.wbs.effortPlan.deleteFailed,
    ];
  };

  /** 通常Taskだけを選択し、日別実績Dialogを開いて最新一覧を取得する。 */
  const openWorkLogDialog = async (taskId: number): Promise<void> => {
    if (isLoadingWorkLogs.value || isWorkLogMutating.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    const task = wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) {
      errorMessages.value = ["実績工数を参照するTaskが見つかりません。"];
      return;
    }
    if (task.taskType !== "TASK") {
      errorMessages.value = [
        "日別実績工数を登録できるのは通常Taskだけです。",
      ];
      return;
    }

    workLogTask.value = { ...task };
    workLogList.value = null;
    editingWorkLog.value = null;
    workLogPendingDelete.value = null;
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
    isWorkLogDialogOpen.value = true;
    await loadSelectedTaskWorkLogs();
  };

  /** 選択中Taskの日別実績一覧を取得し、Dialogの唯一の一覧スナップショットへ反映する。 */
  const loadSelectedTaskWorkLogs = async (): Promise<void> => {
    const task = workLogTask.value;
    if (
      task === null ||
      projectId.value === null ||
      isLoadingWorkLogs.value
    ) {
      return;
    }
    isLoadingWorkLogs.value = true;
    try {
      workLogList.value = await WbsApi.getTaskWorkLogs(
        projectId.value,
        task.taskId
      );
    } catch (error: unknown) {
      await handleWorkLogReadError(error);
    } finally {
      isLoadingWorkLogs.value = false;
    }
  };

  /** 日別実績参照APIのstatusをDialog案内またはSession動作へ変換する。 */
  const handleWorkLogReadError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeWorkLogDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workLog.readForbidden,
      ];
      return;
    }
    if (error.status === 404) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workLog.readNotFound,
      ];
      return;
    }
    workLogEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workLog.loadFailed
    );
  };

  /** 読込・保存・削除中でなければ日別実績Dialogと一時状態を破棄する。 */
  const closeWorkLogDialog = (): void => {
    if (!isLoadingWorkLogs.value && !isWorkLogMutating.value) {
      closeWorkLogDialogAfterOperation();
    }
  };

  /** Session失効や確定操作後にも使用できるよう、処理中状態に依存せずDialogを閉じる。 */
  const closeWorkLogDialogAfterOperation = (): void => {
    isWorkLogDialogOpen.value = false;
    workLogTask.value = null;
    workLogList.value = null;
    editingWorkLog.value = null;
    workLogPendingDelete.value = null;
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
  };

  /** 現在のProject roleと作業者IDから日別実績を変更できるか画面上で判定する。 */
  const canMutateWorkLog = (workLog: TaskWorkLog): boolean =>
    canEditSelectedWorkLogTask.value &&
    (canManageAnyWorkLog.value ||
      workLog.workerAccountId === userStore.memberId);

  /** 取得済み日別実績を複製し、取得時点versionを保持した編集状態へ移す。 */
  const editWorkLog = (workLogId: number): void => {
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
    const workLog = workLogList.value?.workLogs.find(
      (candidate) => candidate.workLogId === workLogId
    );
    if (workLog === undefined) {
      workLogEditorErrorMessages.value = [
        "編集対象の日別実績工数が見つかりません。",
      ];
      return;
    }
    if (!canMutateWorkLog(workLog)) {
      workLogEditorErrorMessages.value = [
        "この日別実績工数を更新する権限がありません。",
      ];
      return;
    }
    editingWorkLog.value = { ...workLog };
  };

  /** 保存中でなければ編集対象を破棄し、新規登録Formへ戻す。 */
  const cancelWorkLogEdit = (): void => {
    if (!isSavingWorkLog.value) {
      editingWorkLog.value = null;
      workLogEditorErrorMessages.value = [];
      workLogSuccessMessage.value = "";
    }
  };

  /**
   * 日別実績Formを検証し、新規登録または取得時点version付き更新へ振り分ける。
   * 409競合時は古い編集状態を破棄し、選択中Taskの最新一覧を再取得する。
   *
   * @param form 業務日、分単位工数、作業者を含む未検証入力
   */
  const saveWorkLog = async (form: TaskWorkLogForm): Promise<void> => {
    const task = workLogTask.value;
    if (
      isSavingWorkLog.value ||
      task === null ||
      projectId.value === null
    ) {
      return;
    }
    if (!canEditSelectedWorkLogTask.value) {
      workLogEditorErrorMessages.value = [
        "このTaskの日別実績を更新する権限がありません。",
      ];
      return;
    }
    const allowedWorkerIds = new Set(
      workLogWorkerOptions.value.map((option) => option.value)
    );
    const validationMessages = validateTaskWorkLogForm(
      form,
      allowedWorkerIds
    );
    if (validationMessages.length > 0) {
      workLogEditorErrorMessages.value = validationMessages;
      return;
    }
    const currentWorkLog = editingWorkLog.value;
    if (currentWorkLog !== null && !canMutateWorkLog(currentWorkLog)) {
      workLogEditorErrorMessages.value = [
        "この日別実績工数を更新する権限がありません。",
      ];
      return;
    }

    isSavingWorkLog.value = true;
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
    try {
      workLogList.value =
        currentWorkLog === null
          ? await WbsApi.createTaskWorkLog(
              projectId.value,
              task.taskId,
              buildTaskWorkLogCreateRequest(form)
            )
          : await WbsApi.updateTaskWorkLog(
              projectId.value,
              task.taskId,
              currentWorkLog.workLogId,
              buildTaskWorkLogUpdateRequest(form, currentWorkLog.version)
            );
      editingWorkLog.value = null;
      workLogSuccessMessage.value =
        currentWorkLog === null
          ? "Task日別実績を登録しました。"
          : "Task日別実績を更新しました。";
      await reloadTaskWorkload();
    } catch (error: unknown) {
      await handleWorkLogMutationError(error);
    } finally {
      isSavingWorkLog.value = false;
    }
  };

  /** 登録・更新APIのstatusを入力案内、競合再読込またはSession動作へ変換する。 */
  const handleWorkLogMutationError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeWorkLogDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workLog.updateForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      editingWorkLog.value = null;
      workLogPendingDelete.value = null;
      workLogEditorErrorMessages.value = resolveWbsErrorMessages(
        error,
        error.status === 409
          ? DISPLAY_MESSAGES.wbs.workLog.conflict
          : DISPLAY_MESSAGES.wbs.workLog.resourceNotFound
      );
      await reloadWorkLogsAfterConflict();
      return;
    }
    workLogEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workLog.saveFailed
    );
  };

  /** 更新競合後に最新日別実績とworkloadを取得し、古いversion・集計を残さない。 */
  const reloadWorkLogsAfterConflict = async (): Promise<void> => {
    const task = workLogTask.value;
    if (task === null || projectId.value === null) {
      return;
    }
    try {
      workLogList.value = await WbsApi.getTaskWorkLogs(
        projectId.value,
        task.taskId
      );
      await reloadTaskWorkload();
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // 再取得時点の認証・認可・公開範囲を操作時点の競合理由より優先する。
        await handleWorkLogReadError(refreshError);
        return;
      }
      workLogEditorErrorMessages.value.push(
        DISPLAY_MESSAGES.wbs.workLog.reloadFailed
      );
    }
  };

  /** 取得済み一覧から削除対象とversionを確定して確認Dialogを開く。 */
  const requestWorkLogDelete = (workLogId: number): void => {
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
    const workLog = workLogList.value?.workLogs.find(
      (candidate) => candidate.workLogId === workLogId
    );
    if (workLog === undefined) {
      workLogEditorErrorMessages.value = [
        "削除対象の日別実績工数が見つかりません。",
      ];
      return;
    }
    if (!canMutateWorkLog(workLog)) {
      workLogEditorErrorMessages.value = [
        "この日別実績工数を削除する権限がありません。",
      ];
      return;
    }
    workLogPendingDelete.value = { ...workLog };
  };

  /** 削除中でなければ確認対象を破棄して確認Dialogを閉じる。 */
  const cancelWorkLogDelete = (): void => {
    if (!isDeletingWorkLog.value) {
      workLogPendingDelete.value = null;
    }
  };

  /** 一覧取得時点versionで日別実績を削除し、204確定後だけ合計と一覧を更新する。 */
  const confirmWorkLogDelete = async (): Promise<void> => {
    const task = workLogTask.value;
    const workLog = workLogPendingDelete.value;
    if (
      task === null ||
      workLog === null ||
      projectId.value === null ||
      isDeletingWorkLog.value
    ) {
      return;
    }
    if (!canMutateWorkLog(workLog)) {
      workLogEditorErrorMessages.value = [
        "この日別実績工数を削除する権限がありません。",
      ];
      return;
    }

    isDeletingWorkLog.value = true;
    workLogEditorErrorMessages.value = [];
    workLogSuccessMessage.value = "";
    try {
      await WbsApi.deleteTaskWorkLog(
        projectId.value,
        task.taskId,
        workLog.workLogId,
        workLog.version
      );
      if (workLogList.value !== null) {
        const remainingWorkLogs = workLogList.value.workLogs.filter(
          (candidate) => candidate.workLogId !== workLog.workLogId
        );
        workLogList.value = {
          ...workLogList.value,
          totalActualEffortMinutes: remainingWorkLogs.reduce(
            (total, candidate) => total + candidate.actualEffortMinutes,
            0
          ),
          workLogs: remainingWorkLogs,
        };
      }
      editingWorkLog.value =
        editingWorkLog.value?.workLogId === workLog.workLogId
          ? null
          : editingWorkLog.value;
      workLogPendingDelete.value = null;
      workLogSuccessMessage.value = "Task日別実績を削除しました。";
      await reloadTaskWorkload();
    } catch (error: unknown) {
      await handleWorkLogDeleteError(error);
    } finally {
      isDeletingWorkLog.value = false;
    }
  };

  /** 日別実績削除APIのstatusを競合再読込、認可案内またはSession動作へ変換する。 */
  const handleWorkLogDeleteError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      closeWorkLogDialogAfterOperation();
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workLog.deleteForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      editingWorkLog.value = null;
      workLogPendingDelete.value = null;
      workLogEditorErrorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.workLog.stale
      );
      await reloadWorkLogsAfterConflict();
      return;
    }
    workLogEditorErrorMessages.value = [
      DISPLAY_MESSAGES.wbs.workLog.deleteFailed,
    ];
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


  /** 日別予定の削除確認dialogが閉じられた場合だけ確認対象を破棄する。 */
  const handleEffortPlanDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelEffortPlanDelete();
    }
  };

  /** 日別実績の削除確認dialogが閉じられた場合だけ確認対象を破棄する。 */
  const handleWorkLogDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelWorkLogDelete();
    }
  };

  /** 稼働日例外の削除確認dialogが閉じられた場合だけ確認対象を破棄する。 */
  const handleWorkingDayDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelWorkingDayDelete();
    }
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
