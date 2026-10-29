import { computed, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type {
  ProjectDetail,
  TaskBoard,
  TaskCard,
  TaskCreateRequest,
  TaskDetail,
  TaskPriority,
  TaskType,
  TaskUpdateRequest,
} from "@/features/project/types/project";
import ProjectTaskApi, {
  ProjectTaskApiError,
} from "@/features/task/api/projectTaskApi";
import {
  TASK_BOARD_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { focusFirstEnabledElement } from "@/shared/utils/focus";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";
import {
  buildProjectMemberOptions,
  resolveProjectMemberDisplayName,
} from "@/features/project/utils/projectMember";
import {
  buildTaskStatusIdOptions,
  TASK_PRIORITY_OPTIONS,
  type TaskSelectOption,
} from "@/features/task/utils/taskFormOptions";

interface TaskForm {
  taskId: number | null;
  taskStatusId: number | null;
  title: string;
  detail: string;
  dateFrom: string;
  dateTo: string;
  assigneeAccountId: number | null;
  priority: TaskPriority;
  version: number | null;
}

interface TaskDragChangeDetail {
  element: TaskCard;
  newIndex: number;
}

interface TaskDragChangeEvent {
  added?: TaskDragChangeDetail;
  moved?: TaskDragChangeDetail;
  removed?: TaskDragChangeDetail;
}

type TaskBoardApiError = ProjectApiError | ProjectTaskApiError;

/** Board画面で扱うProject／Task API例外か判定する。 */
const isTaskBoardApiError = (error: unknown): error is TaskBoardApiError =>
  error instanceof ProjectApiError || error instanceof ProjectTaskApiError;

/** キーボードから指定できるTaskの移動方向。 */
export type TaskMoveDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

/** 編集前の値を共有しない、新しいTaskフォームを作る。 */
const createEmptyTaskForm = (): TaskForm => ({
  taskId: null,
  taskStatusId: null,
  title: "",
  detail: "",
  dateFrom: "",
  dateTo: "",
  assigneeAccountId: null,
  priority: 2,
  version: null,
});

/** ドラッグ失敗時に復元できるよう、Boardと列・Task配列を複製する。 */
const cloneTaskBoard = (source: TaskBoard): TaskBoard => ({
  ...source,
  columns: source.columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => ({ ...task })),
  })),
});

/** Project Boardの読込、Task詳細Dialog、登録・更新と競合回復を管理する。 */
export const useTaskBoardPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const board = ref<TaskBoard | null>(null);
  const errorMessages = ref<string[]>([]);
  /**
   * Task作成・編集Dialog内に表示する、入力チェックと保存・archiveの失敗理由。
   * Dialogを開いている間は画面上部の`errorMessages`がDialogの裏に隠れて見えないため、Dialogの操作結果はここへ出す。
   * 409競合（Dialogを閉じて最新Boardを取り直す）だけは画面上部へ出す。
   */
  const editorErrorMessages = ref<string[]>([]);
  const dragSnapshot = ref<TaskBoard | null>(null);
  const form = ref<TaskForm>(createEmptyTaskForm());
  /**
   * 編集Dialogで開いたTaskの、取得時点の担当者アカウントID。
   * 担当者欄はフォーム上で変えられるため、MEMBERが更新できるか（現在の担当者が本人か）はこちらで判定する。
   */
  const editingTaskAssigneeAccountId = ref<number | null>(null);
  /** 開いているTaskのWBS上の種別。新規作成中はnull。 */
  const editingTaskType = ref<TaskType | null>(null);
  const isArchiveConfirmOpen = ref(false);
  const isArchiving = ref(false);
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isLoadingTask = ref(false);
  const isMoving = ref(false);
  const isSaving = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");
  /** Task詳細の読込の順番。続けて別のTaskを開いたとき、先に開いたTaskの詳細で表示を上書きしないために使う。 */
  const taskDetailRequests = createLatestRequestTracker();

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });

  const requestedTaskId = computed(() => {
    const value = Array.isArray(route.query.taskId)
      ? route.query.taskId[0]
      : route.query.taskId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });

  const isProjectActive = computed(() => project.value?.status === "ACTIVE");
  const canCreateTask = computed(
    () => userStore.hasPermission("TASK_CREATE") && isProjectActive.value
  );
  const canUpdateTask = computed(
    () => userStore.hasPermission("TASK_UPDATE") && isProjectActive.value
  );
  /**
   * 本人のTask Templateをarchiveできるか。Templateは本人専用で、BackendはTASK_READで保存・archiveを許す
   * （改善提案 2-8。以前はarchiveにTASK_UPDATEが要り、参照のみの利用者は作ったTemplateを消せなかった）。
   * TemplateはProjectに属さないため、Projectの状態は問わない。
   */
  const canArchiveTaskTemplate = computed(() => userStore.hasPermission("TASK_READ"));
  const currentProjectRole = computed(
    () =>
      project.value?.members.find(
        (member) => member.accountId === userStore.memberId
      )?.projectRole ?? null
  );
  const canManageProjectTasks = computed(
    () =>
      userStore.hasRole("SYSTEM_ADMIN") ||
      currentProjectRole.value === "OWNER" ||
      currentProjectRole.value === "MANAGER"
  );
  const isCurrentUserProjectMember = computed(() =>
    (project.value?.members ?? []).some(
      (member) => member.accountId === userStore.memberId
    )
  );
  /**
   * このProjectで変更操作（コメント投稿・Template保存等）へ進めるか。READ_ONLY_ADMINは参加していないProjectも
   * 参照できるが変更できない（改善提案 2-12。Backendの`ProjectAuthorizationLogic#canOperateProject`）。
   */
  const canOperateProject = computed(
    () => userStore.hasRole("SYSTEM_ADMIN") || isCurrentUserProjectMember.value
  );
  /**
   * Task Dialogのコメント欄で投稿できるか。Backendは`TASK_READ`とProjectへの参加（SYSTEM_ADMINは不要）で投稿を許可し、
   * 担当者・`TASK_UPDATE`は問わない（`todo-backend`の`docs/task-comment-design.md`「1.3 規則」）。
   * archive済みProjectではBackendが409で拒否するため、利用中のProjectに限る。
   */
  const canPostTaskComment = computed(
    () =>
      userStore.hasPermission("TASK_READ") &&
      isProjectActive.value &&
      canOperateProject.value
  );
  const canCreateTaskRecurrence = computed(
    () =>
      canCreateTask.value &&
      canManageProjectTasks.value
  );
  const canCaptureProjectTemplate = computed(
    () =>
      userStore.hasPermission("PROJECT_CREATE") &&
      isProjectActive.value &&
      (userStore.hasRole("SYSTEM_ADMIN") ||
        currentProjectRole.value === "OWNER")
  );
  const canUpdateTaskRecurrence = computed(
    () =>
      canUpdateTask.value &&
      canManageProjectTasks.value
  );
  const canMoveTask = computed(
    () =>
      userStore.hasPermission("TASK_MOVE") &&
      isProjectActive.value &&
      canManageProjectTasks.value
  );
  const canArchiveTask = computed(
    () =>
      userStore.hasPermission("TASK_ARCHIVE") &&
      isProjectActive.value &&
      canManageProjectTasks.value
  );
  const isEditing = computed(() => form.value.taskId !== null);
  /**
   * 開いたTaskを更新できるか。OWNER・MANAGER・SYSTEM_ADMINはProject内の全Task、
   * MEMBERは現在の担当者が本人のTaskだけ（Backendの`TaskResourceAuthorizationLogic#checkCanUpdate`と同じ規則）。
   * チェックリストの操作も同じ規則（`checkCanManageChecklist`）。
   */
  const canUpdateEditingTask = computed(
    () =>
      canUpdateTask.value &&
      (canManageProjectTasks.value ||
        editingTaskAssigneeAccountId.value === userStore.memberId)
  );
  const isReadonly = computed(
    () => isEditing.value && !canUpdateEditingTask.value
  );
  /**
   * 開いているTaskが通常Task（`TASK`）か。実績工数（Timer・日別実績）とTask Templateへの保存は通常Taskだけが対象で、
   * SUMMARY・MILESTONEではBackendが400で拒否するため、入口自体を出さない
   * （`todo-backend`の`docs/time-tracking-design.md` §4.3、`TaskTemplateLogic#calculateDueOffsetDays`）。
   */
  const isEditingRegularTask = computed(
    () => isEditing.value && editingTaskType.value === "TASK"
  );
  /** 開いているTaskへ実績工数（Timer・日別実績）を計上できるか。 */
  const canRecordTaskWork = computed(() => isEditingRegularTask.value);
  /**
   * 開いているTaskを「Templateとして保存」できるか。保存自体は`TASK_READ`で許可される（Backendの`TaskTemplateController`）が、
   * 保存元Projectへの参加が要る（READ_ONLY_ADMINは未参加Projectから保存できない。改善提案 2-12）。
   */
  const canCaptureTaskTemplate = computed(
    () => isEditingRegularTask.value && canOperateProject.value
  );
  /**
   * Task Templateを適用するときに担当者を限定するaccount ID。限定しない場合はnull。
   * MEMBERは自分を担当者にするTaskだけを作成できる（Backendの`TaskResourceAuthorizationLogic#checkCanCreate`）ため、
   * 既定担当が他人のTemplateをそのまま適用すると403になる。MEMBERには自分だけを候補にし、初期値も自分にする。
   */
  const taskTemplateAssigneeAccountId = computed<number | null>(() =>
    canManageProjectTasks.value ? null : userStore.memberId
  );
  const canStartTaskTimer = computed(
    () =>
      canRecordTaskWork.value &&
      form.value.taskId !== null &&
      canUpdateTask.value &&
      isCurrentUserProjectMember.value &&
      (canManageProjectTasks.value ||
        form.value.assigneeAccountId === userStore.memberId)
  );
  const canSave = computed(
    () =>
      !isSaving.value &&
      !isArchiving.value &&
      !isReadonly.value &&
      (isEditing.value ? canUpdateEditingTask.value : canCreateTask.value)
  );

  const statusOptions = computed<TaskSelectOption<number>[]>(() =>
    buildTaskStatusIdOptions(project.value?.taskStatuses ?? [])
  );

  const memberOptions = computed<TaskSelectOption<number>[]>(() => {
    const canAssignAnyMember =
      isReadonly.value ||
      userStore.hasRole("SYSTEM_ADMIN") ||
      currentProjectRole.value === "OWNER" ||
      currentProjectRole.value === "MANAGER";
    // Board Taskは停止中アカウントを担当者のまま保存できる。既存Taskの担当者が選択肢から消えないよう、
    // 停止中の参加者も「（MEMBER・無効）」のように状態付きで候補へ残す。
    return buildProjectMemberOptions(
      (project.value?.members ?? []).filter(
        (member) => canAssignAnyMember || member.accountId === userStore.memberId
      ),
      { includeInactive: true }
    );
  });

  const priorityOptions = TASK_PRIORITY_OPTIONS;

  /**
   * Task cardの担当者バッジに出す参加者名を返す。Projectから外れたアカウントは`ID: {accountId}`で示す。
   *
   * @param accountId Taskの担当者アカウントID
   * @returns 参加者の表示名
   */
  const resolveAssigneeDisplayName = (accountId: number): string =>
    resolveProjectMemberDisplayName(project.value?.members ?? [], accountId);

  /** Project管理APIの確定ResponseをBoard見出し・認可・担当者候補へ反映する。 */
  const applyProjectDetail = (updatedProject: ProjectDetail): void => {
    project.value = updatedProject;
    if (board.value !== null) {
      board.value = {
        ...board.value,
        projectName: updatedProject.name,
      };
    }
  };

  /** Project詳細とBoardを同じ画面スナップショットとして取得する。 */
  const loadBoardData = async (): Promise<void> => {
    if (projectId.value === null) {
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }
    const [projectValue, boardValue] = await Promise.all([
      ProjectApi.getProject(projectId.value),
      ProjectApi.getTaskBoard(projectId.value),
    ]);
    project.value = projectValue;
    board.value = boardValue;
  };

  /** 画面初期表示に必要なProject詳細とBoardを取得する。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await loadBoardData();
      if (requestedTaskId.value !== null) {
        await openTaskEditor(requestedTaskId.value);
      }
    } catch (error: unknown) {
      await handleBoardReadError(error, DISPLAY_MESSAGES.task.board.loadFailed);
    } finally {
      isLoading.value = false;
    }
  };

  /** 選択列を初期値にしてTask新規登録Dialogを開く。 */
  const openTaskCreator = (taskStatusId?: number): void => {
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    if (!canCreateTask.value) {
      errorMessages.value = ["Taskを登録するpermissionがありません。"];
      return;
    }
    const today = getBusinessToday();
    form.value = {
      ...createEmptyTaskForm(),
      taskStatusId:
        taskStatusId ?? project.value?.taskStatuses[0]?.taskStatusId ?? null,
      assigneeAccountId:
        memberOptions.value.find((option) => option.value === userStore.memberId)
          ?.value ?? memberOptions.value[0]?.value ?? null,
      dateFrom: today,
      dateTo: today,
    };
    isEditorOpen.value = true;
  };

  /**
   * 最新versionを取得してTask参照・編集Dialogを開く。
   * 読込中に別のTaskを開いた場合は、後で開いたTaskだけを表示する（先に開いたTaskのResponseと失敗は捨てる）。
   *
   * @param taskId 開くTaskのID
   */
  const openTaskEditor = async (taskId: number): Promise<void> => {
    if (projectId.value === null) {
      return;
    }
    const isLatestRequest = taskDetailRequests.begin();
    isLoadingTask.value = true;
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    try {
      const task = await ProjectTaskApi.getTask(projectId.value, taskId);
      if (!isLatestRequest()) {
        return;
      }
      form.value = buildTaskForm(task);
      editingTaskAssigneeAccountId.value = task.assigneeAccountId;
      editingTaskType.value = task.taskType;
      isEditorOpen.value = true;
    } catch (error: unknown) {
      if (!isLatestRequest()) {
        return;
      }
      await handleApiError(
        error,
        DISPLAY_MESSAGES.task.board.detailLoadFailed,
        DISPLAY_MESSAGES.task.board.readForbidden
      );
    } finally {
      if (isLatestRequest()) {
        isLoadingTask.value = false;
      }
    }
  };

  // 同じProjectのBoardを開いたまま`?taskId=`だけが変わる遷移（通知から同じProjectの別Taskを開く、ブラウザーの戻る等）では、
  // Vue RouterがComponentを再利用して`initialize`を呼び直さないため、ここで指定のTaskを開く。
  // Projectが変わる遷移は画面ごと作り直す（`app/router/routerViewKey.ts`）ので、ここでは扱わない。
  // - taskIdが外れた場合は何もしない。Dialogを閉じたときに画面自身がqueryを外す（`removeRequestedTaskIdQuery`）ため。
  // - 初期表示の読込中は、読込の最後に`initialize`が今のqueryのTaskを開くので、ここでは開かない。
  // - 保存・archive中は開かない。完了時の後始末でDialogを閉じるため、開いたTaskがすぐ消えてしまう。
  watch(requestedTaskId, (taskId) => {
    if (taskId === null || isLoading.value || isSaving.value || isArchiving.value) {
      return;
    }
    void openTaskEditor(taskId);
  });

  /** Template適用後のBoardを再取得し、生成されたTask詳細を開く。 */
  const handleTemplateTaskCreated = async (task: TaskDetail): Promise<void> => {
    successMessage.value = "TemplateからTaskを登録しました。";
    try {
      await loadBoardData();
      await openTaskEditor(task.taskId);
    } catch (error: unknown) {
      await handleApiError(
        error,
        "Taskは登録されましたが、最新のProject Boardを取得できませんでした。"
      );
    }
  };

  /** APIのTask詳細を、Dialogが独立して編集できるフォームへ変換する。 */
  const buildTaskForm = (task: TaskDetail): TaskForm => ({
    taskId: task.taskId,
    taskStatusId: task.taskStatusId,
    title: task.title,
    detail: task.detail,
    dateFrom: task.dateFrom,
    dateTo: task.dateTo,
    assigneeAccountId: task.assigneeAccountId,
    priority: task.priority,
    version: task.version,
  });

  /** 保存中でない場合に入力値を破棄してTask Dialogを閉じる。 */
  const closeTaskEditor = (): void => {
    if (isSaving.value || isArchiving.value) {
      return;
    }
    isArchiveConfirmOpen.value = false;
    closeTaskEditorAfterSaving();
  };

  /**
   * Task Dialogの開閉の変更（UModalの`update:open`）を受ける。×・Esc・Dialogの外のクリックで閉じた場合も
   * 「キャンセル」と同じく`closeTaskEditor`を通し、入力を捨てて`?taskId=`を外す。開くのは`openTaskEditor`等だけ。
   *
   * @param open UModalが求める開閉の状態
   */
  const handleEditorOpenChange = (open: boolean): void => {
    if (!open) {
      closeTaskEditor();
    }
  };

  /** 保存成功・競合時に、保存中でもTask Dialogの状態を破棄し、URLの`?taskId=`を外す。 */
  const closeTaskEditorAfterSaving = (): void => {
    discardTaskEditor();
    void removeRequestedTaskIdQuery();
  };

  /**
   * Task Dialogの状態（入力・エラー・archive確認）を破棄する。URLは変えない。
   * Session切れで画面を片付けるときはLoginへ遷移するため、URLの書き換えでその遷移を妨げないようこちらを使う。
   */
  const discardTaskEditor = (): void => {
    isArchiveConfirmOpen.value = false;
    isEditorOpen.value = false;
    form.value = createEmptyTaskForm();
    editorErrorMessages.value = [];
  };

  /**
   * Task Dialogを閉じたときに、URLから`?taskId=`を外す。
   * 残したままだと、同じTaskの通知をもう一度押しても同じURLへの遷移になってDialogが開かず、
   * 再読込やブラウザーの戻る操作では閉じたDialogが再び開くため。履歴を増やさないよう`replace`し、ほかのqueryは残す。
   */
  const removeRequestedTaskIdQuery = async (): Promise<void> => {
    if (route.query.taskId === undefined) {
      return;
    }
    const { taskId: _taskId, ...remainingQuery } = route.query;
    await router.replace({ query: remainingQuery });
  };

  /** Taskフォームの必須項目と日付順序をBackend送信前に検証する。 */
  const validateForm = (): boolean => {
    const messages: string[] = [];
    if (form.value.title.trim().length === 0) {
      messages.push("タイトルを入力してください。");
    }
    if (form.value.detail.trim().length === 0) {
      messages.push("詳細を入力してください。");
    }
    if (!form.value.dateFrom || !form.value.dateTo) {
      messages.push("開始日と終了日を入力してください。");
    } else if (form.value.dateFrom > form.value.dateTo) {
      messages.push("終了日は開始日以降にしてください。");
    }
    if (form.value.assigneeAccountId === null) {
      messages.push("担当者を選択してください。");
    }
    if (!isEditing.value && form.value.taskStatusId === null) {
      messages.push("登録先の列を選択してください。");
    }
    editorErrorMessages.value = messages;
    return messages.length === 0;
  };

  /** 新規登録用Requestを、検証済みフォームから組み立てる。 */
  const buildTaskCreateRequest = (): TaskCreateRequest => ({
    title: form.value.title.trim(),
    detail: form.value.detail.trim(),
    dateFrom: form.value.dateFrom,
    dateTo: form.value.dateTo,
    assigneeAccountId: form.value.assigneeAccountId as number,
    taskStatusId: form.value.taskStatusId as number,
    priority: form.value.priority,
  });

  /** 更新用Requestを、検証済みフォームと詳細取得時点のversionから組み立てる。 */
  const buildTaskUpdateRequest = (): TaskUpdateRequest => ({
    title: form.value.title.trim(),
    detail: form.value.detail.trim(),
    dateFrom: form.value.dateFrom,
    dateTo: form.value.dateTo,
    assigneeAccountId: form.value.assigneeAccountId as number,
    priority: form.value.priority,
    version: form.value.version as number,
  });

  /** Taskを登録または更新し、成功後にBackend確定済みBoardを再取得する。 */
  const saveTask = async (): Promise<void> => {
    if (isSaving.value || !canSave.value || !validateForm() || projectId.value === null) {
      return;
    }
    const taskId = form.value.taskId;
    isSaving.value = true;
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    try {
      if (taskId === null) {
        await ProjectTaskApi.createTask(
          projectId.value,
          buildTaskCreateRequest()
        );
      } else {
        await ProjectTaskApi.updateTask(
          projectId.value,
          taskId,
          buildTaskUpdateRequest()
        );
      }
    } catch (error: unknown) {
      try {
        await handleApiError(
          error,
          DISPLAY_MESSAGES.task.board.saveFailed,
          DISPLAY_MESSAGES.task.board.operationForbidden,
          resolveEditorMessageTarget(error)
        );
        if (error instanceof ProjectTaskApiError && error.status === 409) {
          closeTaskEditorAfterSaving();
          await reloadBoardAfterConflict();
        }
      } finally {
        isSaving.value = false;
      }
      return;
    }

    closeTaskEditorAfterSaving();
    successMessage.value =
      taskId === null ? "Taskを登録しました。" : "Taskを更新しました。";
    try {
      await loadBoardData();
    } catch (error: unknown) {
      // Task更新は確定済みのため、再取得失敗を保存失敗として誤表示しない。
      await handleConfirmedBoardRefreshError(
        error,
        DISPLAY_MESSAGES.task.board.savedRefreshFailed
      );
    } finally {
      isSaving.value = false;
    }
  };

  /** version取得済みの既存Taskだけを対象にarchive確認Dialogを開く。 */
  const openArchiveConfirm = (): void => {
    if (
      !canArchiveTask.value ||
      form.value.taskId === null ||
      form.value.version === null
    ) {
      editorErrorMessages.value = ["Taskをアーカイブするpermissionがありません。"];
      return;
    }
    errorMessages.value = [];
    editorErrorMessages.value = [];
    successMessage.value = "";
    isArchiveConfirmOpen.value = true;
  };

  /** archive実行中でない場合に確認Dialogだけを閉じる。 */
  const closeArchiveConfirm = (): void => {
    if (!isArchiving.value) {
      isArchiveConfirmOpen.value = false;
    }
  };

  /**
   * Taskをversion条件付きでarchiveし、成功後のBoardをBackendから再取得する。
   * 409競合では古いTask Dialogを閉じ、最新Boardを表示して再操作を促す。
   */
  const archiveTask = async (): Promise<void> => {
    const taskId = form.value.taskId;
    const version = form.value.version;
    if (
      isArchiving.value ||
      !canArchiveTask.value ||
      taskId === null ||
      version === null ||
      projectId.value === null
    ) {
      return;
    }

    isArchiving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await ProjectTaskApi.archiveTask(projectId.value, taskId, version);
    } catch (error: unknown) {
      isArchiveConfirmOpen.value = false;
      try {
        await handleApiError(
          error,
          DISPLAY_MESSAGES.task.board.archiveFailed,
          DISPLAY_MESSAGES.task.board.operationForbidden,
          resolveEditorMessageTarget(error)
        );
        if (error instanceof ProjectTaskApiError && error.status === 409) {
          closeTaskEditorAfterSaving();
          await reloadBoardAfterConflict();
        }
      } finally {
        isArchiving.value = false;
      }
      return;
    }

    isArchiveConfirmOpen.value = false;
    closeTaskEditorAfterSaving();
    successMessage.value = "Taskをアーカイブしました。";
    try {
      await loadBoardData();
    } catch (error: unknown) {
      // archive自体は確定済みのため、再実行を促さずBoard再読込だけを案内する。
      await handleConfirmedBoardRefreshError(
        error,
        DISPLAY_MESSAGES.task.board.archivedRefreshFailed
      );
    } finally {
      isArchiving.value = false;
    }
  };

  /** ドラッグ前のBoardを退避し、API失敗時に表示順を戻せるようにする。 */
  const startTaskDrag = (): void => {
    if (!canMoveTask.value || isMoving.value || board.value === null) {
      return;
    }
    dragSnapshot.value = cloneTaskBoard(board.value);
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 移動が発生しなかったドラッグ操作では不要になった退避状態を破棄する。 */
  const finishTaskDrag = (): void => {
    if (!isMoving.value) {
      dragSnapshot.value = null;
    }
  };

  /** 指定されたBoardを複製して復元し、失敗した楽観表示を残さない。 */
  const restoreBoardSnapshot = (snapshot: TaskBoard | null): void => {
    if (snapshot !== null) {
      board.value = cloneTaskBoard(snapshot);
    }
  };

  /**
   * dragとkeyboardで共通のTask移動APIを実行し、失敗時の復元と競合回復を行う。
   *
   * @param movedTask 移動対象Task
   * @param destinationStatusId 移動先列ID
   * @param previousTask 移動後に直前となるTask
   * @param nextTask 移動後に直後となるTask
   * @param snapshot API失敗時に復元する移動前Board
   */
  const executeTaskMove = async (
    movedTask: TaskCard,
    destinationStatusId: number,
    previousTask: TaskCard | null,
    nextTask: TaskCard | null,
    snapshot: TaskBoard | null
  ): Promise<void> => {
    if (
      !canMoveTask.value ||
      isMoving.value ||
      projectId.value === null ||
      board.value === null
    ) {
      restoreBoardSnapshot(snapshot);
      return;
    }

    isMoving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      board.value = await ProjectTaskApi.moveTask(
        projectId.value,
        movedTask.taskId,
        {
          destinationStatusId,
          previousTaskId: previousTask?.taskId ?? null,
          nextTaskId: nextTask?.taskId ?? null,
          version: movedTask.version,
        }
      );
      successMessage.value = "Taskを移動しました。";
    } catch (error: unknown) {
      restoreBoardSnapshot(snapshot);
      await handleApiError(error, DISPLAY_MESSAGES.task.board.moveFailed);
      if (error instanceof ProjectTaskApiError && error.status === 409) {
        await reloadBoardAfterConflict();
      }
    } finally {
      isMoving.value = false;
      dragSnapshot.value = null;
    }
  };

  /**
   * vuedraggableが反映した移動順から前後Taskを解決し、専用APIで位置を確定する。
   * source列のremoved eventは無視し、destination列のaddedまたは同一列のmovedだけを送信する。
   */
  const handleTaskDrop = async (
    event: TaskDragChangeEvent,
    destinationStatusId: number
  ): Promise<void> => {
    const change = event.added ?? event.moved;
    if (change === undefined) {
      return;
    }
    if (
      !canMoveTask.value ||
      isMoving.value ||
      projectId.value === null ||
      board.value === null
    ) {
      restoreBoardSnapshot(dragSnapshot.value);
      return;
    }
    const destinationColumn = board.value.columns.find(
      (column) => column.taskStatusId === destinationStatusId
    );
    const movedTaskIndex = destinationColumn?.tasks.findIndex(
      (task) => task.taskId === change.element.taskId
    );
    if (
      destinationColumn === undefined ||
      movedTaskIndex === undefined ||
      movedTaskIndex < 0
    ) {
      restoreBoardSnapshot(dragSnapshot.value);
      errorMessages.value = ["Taskの移動先を特定できませんでした。"];
      return;
    }

    const previousTask = destinationColumn.tasks[movedTaskIndex - 1] ?? null;
    const nextTask = destinationColumn.tasks[movedTaskIndex + 1] ?? null;
    await executeTaskMove(
      change.element,
      destinationStatusId,
      previousTask,
      nextTask,
      dragSnapshot.value
    );
  };

  /**
   * 方向キーから移動先と前後Taskを解決し、dragと同じ移動処理を実行する。
   * 上下は同じ列で1件移動し、左右は隣接列の末尾へ移動する。
   *
   * @param taskId 移動対象Task ID
   * @param direction 移動方向
   */
  const moveTaskByKeyboard = async (
    taskId: number,
    direction: TaskMoveDirection
  ): Promise<void> => {
    if (!canMoveTask.value || isMoving.value || board.value === null) {
      return;
    }

    const sourceColumnIndex = board.value.columns.findIndex((column) =>
      column.tasks.some((task) => task.taskId === taskId)
    );
    const sourceColumn = board.value.columns[sourceColumnIndex];
    const sourceTaskIndex = sourceColumn?.tasks.findIndex(
      (task) => task.taskId === taskId
    );
    if (
      sourceColumn === undefined ||
      sourceTaskIndex === undefined ||
      sourceTaskIndex < 0
    ) {
      errorMessages.value = ["Taskの現在位置を特定できませんでした。"];
      return;
    }

    const movedTask = sourceColumn.tasks[sourceTaskIndex];
    const isVertical = direction === "UP" || direction === "DOWN";
    const destinationColumnIndex = isVertical
      ? sourceColumnIndex
      : sourceColumnIndex + (direction === "LEFT" ? -1 : 1);
    const destinationColumn = board.value.columns[destinationColumnIndex];
    if (movedTask === undefined || destinationColumn === undefined) {
      return;
    }

    const destinationTasks = [...destinationColumn.tasks];
    let destinationTaskIndex: number;
    if (isVertical) {
      destinationTaskIndex =
        sourceTaskIndex + (direction === "UP" ? -1 : 1);
      if (
        destinationTaskIndex < 0 ||
        destinationTaskIndex >= sourceColumn.tasks.length
      ) {
        return;
      }
      destinationTasks.splice(sourceTaskIndex, 1);
      destinationTasks.splice(destinationTaskIndex, 0, movedTask);
    } else {
      destinationTaskIndex = destinationTasks.length;
      destinationTasks.push(movedTask);
    }

    const snapshot = cloneTaskBoard(board.value);
    await executeTaskMove(
      movedTask,
      destinationColumn.taskStatusId,
      destinationTasks[destinationTaskIndex - 1] ?? null,
      destinationTasks[destinationTaskIndex + 1] ?? null,
      snapshot
    );
    await restoreMoveHandleFocus(taskId);
  };

  /**
   * キーボード移動の後（失敗して元へ戻した場合も含む）、移動したTaskの移動アイコンへフォーカスを戻す。
   * 移動中はアイコンをdisabledにするためフォーカスが外れ、続けて方向キーで動かせなくなるため。
   * 移動したTaskはBoardの再描画で別の要素になるので、`data-task-move-handle`属性で探し直す。
   *
   * @param taskId 移動したTask ID
   */
  const restoreMoveHandleFocus = (taskId: number): Promise<void> =>
    focusFirstEnabledElement([`[data-task-move-handle="${taskId}"]`]);

  /**
   * 競合後に最新Boardを取得し、回復時点の認証・認可・公開範囲を優先する。
   * 409のmessage（「再読み込みしてください」等）の後ろに、画面側で再取得を済ませたことを添える。
   * 利用者が手動で再読込しなくてよいと分かるようにするため。
   */
  const reloadBoardAfterConflict = async (): Promise<void> => {
    const messagesBeforeReload = [...errorMessages.value];
    try {
      await loadBoardData();
      errorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.task.board.conflictReloaded,
      ];
    } catch (error: unknown) {
      if (
        isTaskBoardApiError(error) &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(error.status)
      ) {
        await handleBoardReadError(
          error,
          DISPLAY_MESSAGES.task.board.reloadFailed
        );
        return;
      }
      errorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.task.board.reloadFailed,
      ];
    }
  };

  /** 認証・公開範囲を失った画面から古いBoard、Dialog、楽観表示を破棄する。 */
  const clearBoardState = (): void => {
    board.value = null;
    project.value = null;
    dragSnapshot.value = null;
    discardTaskEditor();
  };

  /** Session失効時に古いBoardとメッセージを破棄してLoginへ戻す。 */
  const handleUnauthorized = async (): Promise<void> => {
    errorMessages.value = [];
    successMessage.value = "";
    clearBoardState();
    userStore.clearSession();
    await router.push({ name: "Login" });
  };

  /** Board再取得で参照不可になった場合に、古い画面状態を残さずreadエラーへ変換する。 */
  const handleBoardReadError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (
      isTaskBoardApiError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      clearBoardState();
    }
    await handleApiError(
      error,
      fallbackMessage,
      DISPLAY_MESSAGES.task.board.readForbidden
    );
  };

  /** 確定済みTask操作後のBoard再取得失敗を、操作失敗と区別して表示する。 */
  const handleConfirmedBoardRefreshError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (
      isTaskBoardApiError(error) &&
      TASK_RECOVERY_PRIORITY_STATUSES.has(error.status)
    ) {
      await handleBoardReadError(error, fallbackMessage);
      return;
    }
    errorMessages.value = [fallbackMessage];
  };

  /**
   * Task作成・編集Dialogの保存・archiveで起きたAPIエラーの表示先を決める。
   * 409競合はDialogを閉じて最新Boardを取り直すため画面上部へ、それ以外はDialogを開いたまま中へ出す。
   *
   * @param error 保存・archiveで発生したエラー
   * @returns メッセージを書き込むRef
   */
  const resolveEditorMessageTarget = (error: unknown): Ref<string[]> =>
    error instanceof ProjectTaskApiError && error.status === 409
      ? errorMessages
      : editorErrorMessages;

  /**
   * Project・Task APIのstatusと項目エラーを画面動作へ変換する。
   *
   * @param error APIの失敗
   * @param fallbackMessage 契約済みcodeがない場合のmessage
   * @param forbiddenMessage 403のmessage
   * @param messageTarget messageの表示先。既定は画面上部、Dialogの操作では`editorErrorMessages`
   */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string,
    forbiddenMessage: string = DISPLAY_MESSAGES.task.board.operationForbidden,
    messageTarget: Ref<string[]> = errorMessages
  ): Promise<void> => {
    if (!isTaskBoardApiError(error)) {
      messageTarget.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      messageTarget.value = [forbiddenMessage];
      return;
    }
    if (error.status === 404) {
      messageTarget.value = [DISPLAY_MESSAGES.task.board.resourceNotFound];
      return;
    }
    messageTarget.value = resolveApiErrorMessages(
      error.errorResponse,
      TASK_BOARD_ERROR_CODES,
      fallbackMessage
    );
  };

  /** 選択中Taskを保ったままWBSへ遷移し、既存の日別実績入力Dialogを開く。 */
  const openTaskWorkLogs = async (): Promise<void> => {
    if (projectId.value === null || form.value.taskId === null) {
      return;
    }
    await router.push({
      name: "Wbs",
      params: { projectId: projectId.value },
      query: { taskId: String(form.value.taskId), panel: "work-logs" },
    });
  };

  return {
    applyProjectDetail,
    board,
    archiveTask,
    canArchiveTask,
    canCaptureProjectTemplate,
    canCreateTask,
    canCreateTaskRecurrence,
    canMoveTask,
    canSave,
    canStartTaskTimer,
    canCaptureTaskTemplate,
    canPostTaskComment,
    canRecordTaskWork,
    canUpdateTask,
    canArchiveTaskTemplate,
    canUpdateTaskRecurrence,
    closeArchiveConfirm,
    closeTaskEditor,
    taskTemplateAssigneeAccountId,
    editorErrorMessages,
    errorMessages,
    form,
    finishTaskDrag,
    handleEditorOpenChange,
    handleTaskDrop,
    handleTemplateTaskCreated,
    initialize,
    isArchiveConfirmOpen,
    isArchiving,
    isEditorOpen,
    isLoading,
    isLoadingTask,
    isMoving,
    isReadonly,
    isSaving,
    memberOptions,
    moveTaskByKeyboard,
    openArchiveConfirm,
    openTaskCreator,
    openTaskEditor,
    openTaskWorkLogs,
    priorityOptions,
    project,
    resolveAssigneeDisplayName,
    saveTask,
    statusOptions,
    startTaskDrag,
    successMessage,
  };
};
