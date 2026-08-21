import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  TaskDependency,
  TaskDependencyCreateForm,
  TaskDependencyCreateRequest,
  TaskDependencyListResponse,
  TaskDependencyRow,
  TaskDependencyTaskOption,
  WbsResponse,
  WbsTask,
  WbsTaskEditForm,
} from "@/features/wbs/types/wbs";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";

/**
 * WBS画面の読込、階層変換、Task編集、依存関係編集、競合回復、認証エラーとBoard遷移を管理する。
 * Boardと同じTaskを正本とし、Taskまたは依存関係の409競合後はBackendの最新Responseで表示を作り直す。
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
  const successMessage = ref("");
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

  /** WBS Taskと依存関係を同じ読込時点の画面スナップショットとして並行取得する。 */
  const loadPageSnapshot = async (): Promise<void> => {
    if (projectId.value === null) {
      throw new Error("Project IDが不正です。");
    }
    const [loadedWbs, loadedDependencies] = await Promise.all([
      WbsApi.getWbs(projectId.value),
      WbsApi.getTaskDependencies(projectId.value),
    ]);
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
      wbs.value = null;
      dependencyList.value = null;
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }

    isLoading.value = true;
    try {
      await loadPageSnapshot();
    } catch (error: unknown) {
      wbs.value = null;
      dependencyList.value = null;
      await handleReadApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** WBS APIのstatusを、認証状態を含む参照画面の案内へ変換する。 */
  const handleReadApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
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
    canEditWbs,
    closeDependencyEditor,
    closeTaskEditor,
    confirmDependencyDelete,
    dependencies,
    dependencyEditorErrorMessages,
    dependencyPendingDelete,
    dependencyPendingDeleteRow,
    dependencyRows,
    dependencyTaskOptions,
    editingTask,
    editorErrorMessages,
    errorMessages,
    initialize,
    isDeletingDependency,
    isDependencyEditorOpen,
    isDependencyMutating,
    isEditorOpen,
    isLoading,
    isSavingDependency,
    isSaving,
    milestoneCount,
    openBoard,
    openDependencyEditor,
    openTaskEditor,
    parentOptions,
    projectId,
    requestDependencyDelete,
    rows,
    saveDependency,
    saveWbsTask,
    successMessage,
    summaryCount,
    taskCount,
    wbs,
  };
};
