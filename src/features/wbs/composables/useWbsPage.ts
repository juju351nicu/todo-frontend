import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectDetail } from "@/features/project/types/project";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  TaskDependency,
  TaskDependencyCreateForm,
  TaskDependencyCreateRequest,
  TaskDependencyListResponse,
  TaskDependencyRow,
  TaskDependencyTaskOption,
  TaskWorkLog,
  TaskWorkLogForm,
  TaskWorkLogListResponse,
  TaskWorkLogWorkerOption,
  WbsResponse,
  WbsTask,
  WbsTaskEditForm,
} from "@/features/wbs/types/wbs";
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

/**
 * WBS画面の読込、階層変換、Task・依存関係・日別実績編集、競合回復、認証エラーとBoard遷移を管理する。
 * Boardと同じTaskを正本とし、更新競合後はBackendの最新Responseで表示を作り直す。
 */
export const useWbsPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const dependencyEditorErrorMessages = ref<string[]>([]);
  const dependencyList = ref<TaskDependencyListResponse | null>(null);
  const dependencyPendingDelete = ref<TaskDependency | null>(null);
  const editingTask = ref<WbsTask | null>(null);
  const editorErrorMessages = ref<string[]>([]);
  const errorMessages = ref<string[]>([]);
  const isDeletingDependency = ref(false);
  const isDependencyEditorOpen = ref(false);
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isSavingDependency = ref(false);
  const isSaving = ref(false);
  const editingWorkLog = ref<TaskWorkLog | null>(null);
  const isDeletingWorkLog = ref(false);
  const isLoadingWorkLogs = ref(false);
  const isSavingWorkLog = ref(false);
  const isWorkLogDialogOpen = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");
  const workLogEditorErrorMessages = ref<string[]>([]);
  const workLogList = ref<TaskWorkLogListResponse | null>(null);
  const workLogPendingDelete = ref<TaskWorkLog | null>(null);
  const workLogSuccessMessage = ref("");
  const workLogTask = ref<WbsTask | null>(null);
  const wbs = ref<WbsResponse | null>(null);

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const rows = computed(() => buildWbsTreeRows(wbs.value?.tasks ?? []));
  const dependencies = computed(() => dependencyList.value?.dependencies ?? []);
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
  const canManageAnyWorkLog = computed(
    () =>
      userStore.hasRole("SYSTEM_ADMIN") ||
      currentProjectRole.value === "OWNER" ||
      currentProjectRole.value === "MANAGER"
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
  const dependencyTaskOptions = computed<TaskDependencyTaskOption[]>(() =>
    rows.value.map((task) => ({
      title: buildDependencyTaskLabel(task),
      value: task.taskId,
    }))
  );
  const dependencyRows = computed<TaskDependencyRow[]>(() => {
    const labelByTaskId = new Map(
      dependencyTaskOptions.value.map((option) => [option.value, option.title])
    );
    return dependencies.value.map((dependency) => ({
      ...dependency,
      predecessorLabel:
        labelByTaskId.get(dependency.predecessorTaskId) ??
        `Task ID: ${dependency.predecessorTaskId}（表示対象外）`,
      successorLabel:
        labelByTaskId.get(dependency.successorTaskId) ??
        `Task ID: ${dependency.successorTaskId}（表示対象外）`,
    }));
  });
  const dependencyPendingDeleteRow = computed(() => {
    const pendingId = dependencyPendingDelete.value?.dependencyId;
    return pendingId === undefined
      ? null
      : dependencyRows.value.find((row) => row.dependencyId === pendingId) ??
          null;
  });
  const isDependencyMutating = computed(
    () => isSavingDependency.value || isDeletingDependency.value
  );
  const parentOptions = computed(() =>
    editingTask.value === null
      ? []
      : buildWbsParentOptions(
          wbs.value?.tasks ?? [],
          editingTask.value.taskId
        )
  );

  /** WBSコードがある場合だけ依存関係selectと一覧のTask名へ前置する。 */
  function buildDependencyTaskLabel(task: WbsTask): string {
    return task.wbsCode === null || task.wbsCode.trim() === ""
      ? task.title
      : `${task.wbsCode} ${task.title}`;
  }

  /** WBS API Responseを唯一の画面スナップショットとして差し替える。 */
  const loadWbs = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    wbs.value = await WbsApi.getWbs(projectId.value);
  };

  /** Project member、WBS Task、依存関係を同じ読込時点の画面スナップショットとして並行取得する。 */
  const loadPageSnapshot = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    const [loadedProject, loadedWbs, loadedDependencies] = await Promise.all([
      ProjectApi.getProject(projectId.value),
      WbsApi.getWbs(projectId.value),
      WbsApi.getTaskDependencies(projectId.value),
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
    successMessage.value = "";
    if (projectId.value === null) {
      project.value = null;
      wbs.value = null;
      dependencyList.value = null;
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      await loadPageSnapshot();
    } catch (error: unknown) {
      project.value = null;
      wbs.value = null;
      dependencyList.value = null;
      await handleReadApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS APIのstatusを、認証状態を含む参照画面の案内へ変換する。 */
  const handleReadApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError) && !(error instanceof ProjectApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["WBSを参照するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [
        "Projectが見つからないか、このProjectへ参加していません。",
      ];
      return;
    }
    errorMessages.value = ["WBSを取得できませんでした。"];
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

  /** TASK_UPDATEを持ち、依存関係の両端候補が2件以上ある場合だけ追加Dialogを開く。 */
  const openDependencyEditor = (): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canEditWbs.value) {
      errorMessages.value = ["Task依存関係を更新するpermissionがありません。"];
      return;
    }
    if (dependencyTaskOptions.value.length < 2) {
      errorMessages.value = ["依存関係を追加するにはTaskが2件以上必要です。"];
      return;
    }
    dependencyEditorErrorMessages.value = [];
    isDependencyEditorOpen.value = true;
  };

  /** 依存関係の保存中でなければ未確定入力を破棄して追加Dialogを閉じる。 */
  const closeDependencyEditor = (): void => {
    if (!isSavingDependency.value) {
      closeDependencyEditorAfterSaving();
    }
  };

  /** 作成成功・競合・Session失効時に保存中でも古い入力を破棄する。 */
  const closeDependencyEditorAfterSaving = (): void => {
    isDependencyEditorOpen.value = false;
    dependencyEditorErrorMessages.value = [];
  };

  /**
   * 依存関係追加Formを検証し、Backendへ送信できるRequestへ変換する。
   * graph全体の循環、Project状態、最新Task状態はBackendを最終判定とする。
   *
   * @param form Dialogから受け取った未検証入力
   * @returns 正常時はRequest、入力不正時は利用者向けmessage一覧
   */
  const buildDependencyCreateRequest = (
    form: TaskDependencyCreateForm
  ):
    | { request: TaskDependencyCreateRequest; messages: [] }
    | { request: null; messages: string[] } => {
    const messages: string[] = [];
    const predecessorTaskId = form.predecessorTaskId;
    const successorTaskId = form.successorTaskId;
    const lagMinutes = form.lagMinutes;
    const availableTaskIds = new Set(
      dependencyTaskOptions.value.map((option) => option.value)
    );

    if (
      predecessorTaskId === null ||
      !Number.isSafeInteger(predecessorTaskId) ||
      predecessorTaskId <= 0 ||
      !availableTaskIds.has(predecessorTaskId)
    ) {
      messages.push("先行Taskを選択してください。");
    }
    if (
      successorTaskId === null ||
      !Number.isSafeInteger(successorTaskId) ||
      successorTaskId <= 0 ||
      !availableTaskIds.has(successorTaskId)
    ) {
      messages.push("後続Taskを選択してください。");
    }
    if (
      predecessorTaskId !== null &&
      successorTaskId !== null &&
      predecessorTaskId === successorTaskId
    ) {
      messages.push("先行Taskと後続Taskには別のTaskを選択してください。");
    }
    if (
      lagMinutes === null ||
      !Number.isSafeInteger(lagMinutes) ||
      lagMinutes < 0
    ) {
      messages.push("待ち時間は0以上の整数で入力してください。");
    }
    if (
      predecessorTaskId !== null &&
      successorTaskId !== null &&
      dependencies.value.some(
        (dependency) =>
          dependency.predecessorTaskId === predecessorTaskId &&
          dependency.successorTaskId === successorTaskId
      )
    ) {
      messages.push("同じ向きのTask依存関係はすでに登録されています。");
    }
    if (
      messages.length > 0 ||
      predecessorTaskId === null ||
      successorTaskId === null ||
      lagMinutes === null
    ) {
      return { request: null, messages };
    }
    return {
      request: {
        predecessorTaskId,
        successorTaskId,
        dependencyType: "FINISH_TO_START",
        lagMinutes,
      },
      messages: [],
    };
  };

  /**
   * 検証済みFinish-to-Start依存関係を追加し、成功時はBackendの一覧Responseで差し替える。
   * 409競合ではDialogを閉じ、WBS Taskと依存関係の両方を再取得する。
   *
   * @param form 先行Task、後続Task、分単位待ち時間
   */
  const saveDependency = async (
    form: TaskDependencyCreateForm
  ): Promise<void> => {
    if (isSavingDependency.value || projectId.value === null) {
      return;
    }
    if (!canEditWbs.value) {
      dependencyEditorErrorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }
    const built = buildDependencyCreateRequest(form);
    if (built.request === null) {
      dependencyEditorErrorMessages.value = built.messages;
      return;
    }

    isSavingDependency.value = true;
    dependencyEditorErrorMessages.value = [];
    errorMessages.value = [];
    successMessage.value = "";
    try {
      dependencyList.value = await WbsApi.createTaskDependency(
        projectId.value,
        built.request
      );
      closeDependencyEditorAfterSaving();
      successMessage.value = "Task依存関係を追加しました。";
    } catch (error: unknown) {
      await handleDependencyCreateError(error);
    } finally {
      isSavingDependency.value = false;
    }
  };

  /** Task依存関係作成APIのstatusをDialog、競合再読込またはSession動作へ変換する。 */
  const handleDependencyCreateError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      dependencyEditorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeDependencyEditorAfterSaving();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      dependencyEditorErrorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }
    if (error.status === 404) {
      dependencyEditorErrorMessages.value = [
        "対象のProjectまたはTaskが見つかりません。",
      ];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    if (error.status === 409) {
      closeDependencyEditorAfterSaving();
      errorMessages.value =
        fieldMessages.length > 0
          ? fieldMessages
          : ["Task依存関係が他の操作と競合しました。最新情報を確認してください。"];
      await reloadPageAfterDependencyConflict();
      return;
    }
    dependencyEditorErrorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["Task依存関係を追加できませんでした。"];
  };

  /** 削除対象とversionを現在の一覧から確定して確認Dialogを開く。 */
  const requestDependencyDelete = (dependencyId: number): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canEditWbs.value) {
      errorMessages.value = ["Task依存関係を更新するpermissionがありません。"];
      return;
    }
    const dependency = dependencies.value.find(
      (candidate) => candidate.dependencyId === dependencyId
    );
    if (dependency === undefined) {
      errorMessages.value = ["削除対象のTask依存関係が見つかりません。"];
      return;
    }
    dependencyPendingDelete.value = { ...dependency };
  };

  /** 削除中でなければ確認対象を破棄して削除Dialogを閉じる。 */
  const cancelDependencyDelete = (): void => {
    if (!isDeletingDependency.value) {
      dependencyPendingDelete.value = null;
    }
  };

  /** 一覧取得時点versionで依存関係を削除し、204確定後に画面一覧から除外する。 */
  const confirmDependencyDelete = async (): Promise<void> => {
    const dependency = dependencyPendingDelete.value;
    if (
      dependency === null ||
      projectId.value === null ||
      isDeletingDependency.value
    ) {
      return;
    }
    if (!canEditWbs.value) {
      errorMessages.value = ["Task依存関係を更新するpermissionがありません。"];
      return;
    }

    isDeletingDependency.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await WbsApi.deleteTaskDependency(
        projectId.value,
        dependency.dependencyId,
        dependency.version
      );
      if (dependencyList.value !== null) {
        dependencyList.value = {
          ...dependencyList.value,
          dependencies: dependencyList.value.dependencies.filter(
            (candidate) => candidate.dependencyId !== dependency.dependencyId
          ),
        };
      }
      dependencyPendingDelete.value = null;
      successMessage.value = "Task依存関係を削除しました。";
    } catch (error: unknown) {
      await handleDependencyDeleteError(error);
    } finally {
      isDeletingDependency.value = false;
    }
  };

  /** Task依存関係削除APIのstatusを競合再読込、認可案内またはSession動作へ変換する。 */
  const handleDependencyDeleteError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      dependencyPendingDelete.value = null;
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["Task依存関係を更新するpermissionがありません。"];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    if (error.status === 404 || error.status === 409) {
      dependencyPendingDelete.value = null;
      errorMessages.value =
        fieldMessages.length > 0
          ? fieldMessages
          : ["Task依存関係が更新または削除されています。最新情報を確認してください。"];
      await reloadPageAfterDependencyConflict();
      return;
    }
    errorMessages.value = ["Task依存関係を削除できませんでした。"];
  };

  /** 依存関係競合後にWBS Taskと依存関係を再取得し、古い端点とversionを残さない。 */
  const reloadPageAfterDependencyConflict = async (): Promise<void> => {
    try {
      await loadPageSnapshot();
    } catch (_error: unknown) {
      errorMessages.value.push(
        "最新のWBSとTask依存関係を再取得できませんでした。再読込してください。"
      );
    }
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
      workLogEditorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeWorkLogDialogAfterOperation();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        "Task日別実績を参照するpermissionがありません。",
      ];
      return;
    }
    if (error.status === 404) {
      workLogEditorErrorMessages.value = [
        "対象のProjectまたは通常Taskが見つかりません。",
      ];
      return;
    }
    workLogEditorErrorMessages.value = [
      "Task日別実績を取得できませんでした。",
    ];
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
    } catch (error: unknown) {
      await handleWorkLogMutationError(error);
    } finally {
      isSavingWorkLog.value = false;
    }
  };

  /** 登録・更新APIのstatusを入力案内、競合再読込またはSession動作へ変換する。 */
  const handleWorkLogMutationError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workLogEditorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeWorkLogDialogAfterOperation();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        "Task日別実績を更新する権限がありません。",
      ];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    if (error.status === 404 || error.status === 409) {
      editingWorkLog.value = null;
      workLogPendingDelete.value = null;
      workLogEditorErrorMessages.value =
        fieldMessages.length > 0
          ? fieldMessages
          : [
              error.status === 409
                ? "日別実績が他の操作と競合しました。最新情報を確認してください。"
                : "対象のProject、Taskまたは日別実績が見つかりません。",
            ];
      await reloadWorkLogsAfterConflict();
      return;
    }
    workLogEditorErrorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["Task日別実績を保存できませんでした。"];
  };

  /** 更新競合後に選択中Taskの最新日別実績を取得し、古いversionを残さない。 */
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
    } catch (_error: unknown) {
      workLogEditorErrorMessages.value.push(
        "最新の日別実績を再取得できませんでした。Dialogを閉じて再読込してください。"
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
    } catch (error: unknown) {
      await handleWorkLogDeleteError(error);
    } finally {
      isDeletingWorkLog.value = false;
    }
  };

  /** 日別実績削除APIのstatusを競合再読込、認可案内またはSession動作へ変換する。 */
  const handleWorkLogDeleteError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workLogEditorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeWorkLogDialogAfterOperation();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      workLogEditorErrorMessages.value = [
        "Task日別実績を削除する権限がありません。",
      ];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    if (error.status === 404 || error.status === 409) {
      editingWorkLog.value = null;
      workLogPendingDelete.value = null;
      workLogEditorErrorMessages.value =
        fieldMessages.length > 0
          ? fieldMessages
          : ["日別実績が更新または削除されています。最新情報を確認してください。"];
      await reloadWorkLogsAfterConflict();
      return;
    }
    workLogEditorErrorMessages.value = [
      "Task日別実績を削除できませんでした。",
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
        const conflictMessages = getFieldErrorMessages(error);
        closeTaskEditorAfterSaving();
        errorMessages.value =
          conflictMessages.length > 0
            ? conflictMessages
            : ["WBSが他の操作で更新されました。最新情報を確認してください。"];
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
    } catch (_error: unknown) {
      errorMessages.value.push("最新のWBSを再取得できませんでした。再読込してください。");
    }
  };

  /** Backend項目エラーから空文字を除いた利用者向けメッセージを取り出す。 */
  const getFieldErrorMessages = (error: WbsApiError): string[] =>
    (error.errorResponse?.fieldErrors ?? [])
      .map((fieldError) => fieldError.message)
      .filter((message) => message.trim().length > 0);

  /** WBS更新APIのstatusと項目エラーを、DialogまたはSession動作へ変換する。 */
  const handleUpdateApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      editorErrorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      closeTaskEditorAfterSaving();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      editorErrorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      editorErrorMessages.value = ["対象のProjectまたはTaskが見つかりません。"];
      return;
    }
    const fieldMessages = getFieldErrorMessages(error);
    editorErrorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["WBS Taskを更新できませんでした。"];
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
    cancelDependencyDelete,
    cancelWorkLogDelete,
    cancelWorkLogEdit,
    canEditWbs,
    canEditSelectedWorkLogTask,
    canManageAnyWorkLog,
    closeDependencyEditor,
    closeTaskEditor,
    closeWorkLogDialog,
    confirmDependencyDelete,
    confirmWorkLogDelete,
    currentAccountId: computed(() => userStore.memberId),
    dependencies,
    dependencyEditorErrorMessages,
    dependencyPendingDelete,
    dependencyPendingDeleteRow,
    dependencyRows,
    dependencyTaskOptions,
    editingTask,
    editingWorkLog,
    editorErrorMessages,
    errorMessages,
    initialize,
    isDeletingDependency,
    isDeletingWorkLog,
    isDependencyEditorOpen,
    isDependencyMutating,
    isEditorOpen,
    isLoading,
    isSavingDependency,
    isSaving,
    isSavingWorkLog,
    isLoadingWorkLogs,
    isWorkLogDialogOpen,
    milestoneCount,
    openBoard,
    openDependencyEditor,
    openTaskEditor,
    openWorkLogDialog,
    parentOptions,
    projectId,
    requestDependencyDelete,
    requestWorkLogDelete,
    rows,
    saveDependency,
    saveWbsTask,
    saveWorkLog,
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
    editWorkLog,
  };
};
