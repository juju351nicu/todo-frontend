import { computed, ref, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useUserStore } from "@/features/auth/stores/user";
import type {
  TaskCreateRequest,
  TaskDetail,
  TaskPriority,
  TaskType,
  TaskUpdateRequest,
} from "@/features/project/types/project";
import { buildProjectMemberOptions } from "@/features/project/utils/projectMember";
import ProjectTaskApi, { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import type { TaskBoardPageContext } from "@/features/task/composables/taskBoardPageContext";
import type { TaskBoardPermissions } from "@/features/task/composables/useTaskBoardPermissions";
import {
  buildTaskStatusIdOptions,
  TASK_PRIORITY_OPTIONS,
  type TaskSelectOption,
} from "@/features/task/utils/taskFormOptions";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";

/** Task作成・編集Dialogの入力値。`taskId`がnullなら新規登録。 */
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

/**
 * Board画面のTask作成・編集Dialog（詳細の読込、入力チェック、登録・更新、archive、WBSの日別実績への遷移）を扱う。
 *
 * - Dialogを開いている間の失敗は、Dialogの裏に隠れる画面上部ではなく`editorErrorMessages`へ出す。
 *   409競合だけは、Dialogを閉じて最新Boardを取り直すため画面上部へ出す。
 * - Dialogを閉じたら、URLの`?taskId=`を外す（通知から同じTaskを開き直せるようにするため）。
 * - 開いたTaskごとに変わる可否（担当者本人か、通常Taskか）はここで求める。Project単位の可否は`permissions`から受ける。
 *
 * @param context Board画面の共通の状態と操作
 * @param permissions Project単位の操作の可否
 */
export const useTaskEditor = (context: TaskBoardPageContext, permissions: TaskBoardPermissions) => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();
  const { errorMessages, project, projectId, successMessage } = context;
  const {
    canArchiveTask,
    canCreateTask,
    canManageTasks,
    canOperateProject,
    canUpdateTask,
    isCurrentUserProjectMember,
  } = permissions;

  /**
   * Task作成・編集Dialog内に表示する、入力チェックと保存・archiveの失敗理由。
   * Dialogを開いている間は画面上部の`errorMessages`がDialogの裏に隠れて見えないため、Dialogの操作結果はここへ出す。
   * 409競合（Dialogを閉じて最新Boardを取り直す）だけは画面上部へ出す。
   */
  const editorErrorMessages = ref<string[]>([]);
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
  const isLoadingTask = ref(false);
  const isSaving = ref(false);
  /** Task詳細の読込の順番。続けて別のTaskを開いたとき、先に開いたTaskの詳細で表示を上書きしないために使う。 */
  const taskDetailRequests = createLatestRequestTracker();

  const isEditing = computed(() => form.value.taskId !== null);
  /**
   * 開いたTaskを更新できるか。OWNER・MANAGER・SYSTEM_ADMINはProject内の全Task、
   * MEMBERは現在の担当者が本人のTaskだけ（Backendの`TaskResourceAuthorizationLogic#checkCanUpdate`と同じ規則）。
   * チェックリストの操作も同じ規則（`checkCanManageChecklist`）。
   */
  const canUpdateEditingTask = computed(
    () =>
      canUpdateTask.value &&
      (canManageTasks.value || editingTaskAssigneeAccountId.value === userStore.accountId)
  );
  const isReadonly = computed(() => isEditing.value && !canUpdateEditingTask.value);
  /**
   * 開いているTaskが通常Task（`TASK`）か。実績工数（Timer・日別実績）とTask Templateへの保存は通常Taskだけが対象で、
   * SUMMARY・MILESTONEではBackendが400で拒否するため、入口自体を出さない
   * （`todo-backend`の`docs/time-tracking-design.md`、`TaskTemplateLogic#calculateDueOffsetDays`）。
   */
  const isEditingRegularTask = computed(() => isEditing.value && editingTaskType.value === "TASK");
  /** 開いているTaskへ実績工数（Timer・日別実績）を計上できるか。 */
  const canRecordTaskWork = computed(() => isEditingRegularTask.value);
  /**
   * 開いているTaskを「Templateとして保存」できるか。保存自体は`TASK_READ`で許可される（Backendの`TaskTemplateController`）が、
   * 保存元Projectへの参加が要る（READ_ONLY_ADMINは未参加Projectから保存できない）。
   */
  const canCaptureTaskTemplate = computed(
    () => isEditingRegularTask.value && canOperateProject.value
  );
  /** 開いているTaskのTimerを開始できるか。Projectの参加者で、Taskを管理できるか担当者本人の場合に限る。 */
  const canStartTaskTimer = computed(
    () =>
      canRecordTaskWork.value &&
      form.value.taskId !== null &&
      canUpdateTask.value &&
      isCurrentUserProjectMember.value &&
      (canManageTasks.value || form.value.assigneeAccountId === userStore.accountId)
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
    const canAssignAnyMember = isReadonly.value || canManageTasks.value;
    // Board Taskは停止中アカウントを担当者のまま保存できる。既存Taskの担当者が選択肢から消えないよう、
    // 停止中の参加者も「（MEMBER・無効）」のように状態付きで候補へ残す。
    return buildProjectMemberOptions(
      (project.value?.members ?? []).filter(
        (member) => canAssignAnyMember || member.accountId === userStore.accountId
      ),
      { includeInactive: true }
    );
  });

  const priorityOptions = TASK_PRIORITY_OPTIONS;

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
      taskStatusId: taskStatusId ?? project.value?.taskStatuses[0]?.taskStatusId ?? null,
      assigneeAccountId:
        memberOptions.value.find((option) => option.value === userStore.accountId)?.value ??
        memberOptions.value[0]?.value ??
        null,
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
      await context.handleApiError(
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
   * Dialogの保存・archiveの失敗を表示し、409競合ならDialogを閉じて最新Boardを取り直す。
   *
   * @param error 保存・archiveで発生したエラー
   * @param fallbackMessage 契約済みcodeがない場合のmessage
   */
  const handleEditorOperationError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    await context.handleApiError(
      error,
      fallbackMessage,
      DISPLAY_MESSAGES.task.board.operationForbidden,
      resolveEditorMessageTarget(error)
    );
    if (error instanceof ProjectTaskApiError && error.status === 409) {
      closeTaskEditorAfterSaving();
      await context.reloadBoardAfterConflict();
    }
  };

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
        await ProjectTaskApi.createTask(projectId.value, buildTaskCreateRequest());
      } else {
        await ProjectTaskApi.updateTask(projectId.value, taskId, buildTaskUpdateRequest());
      }
    } catch (error: unknown) {
      try {
        await handleEditorOperationError(error, DISPLAY_MESSAGES.task.board.saveFailed);
      } finally {
        isSaving.value = false;
      }
      return;
    }

    closeTaskEditorAfterSaving();
    successMessage.value = taskId === null ? "Taskを登録しました。" : "Taskを更新しました。";
    try {
      await context.loadBoardData();
    } catch (error: unknown) {
      // Task更新は確定済みのため、再取得失敗を保存失敗として誤表示しない。
      await context.handleConfirmedBoardRefreshError(
        error,
        DISPLAY_MESSAGES.task.board.savedRefreshFailed
      );
    } finally {
      isSaving.value = false;
    }
  };

  /** version取得済みの既存Taskだけを対象にarchive確認Dialogを開く。 */
  const openArchiveConfirm = (): void => {
    if (!canArchiveTask.value || form.value.taskId === null || form.value.version === null) {
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
        await handleEditorOperationError(error, DISPLAY_MESSAGES.task.board.archiveFailed);
      } finally {
        isArchiving.value = false;
      }
      return;
    }

    isArchiveConfirmOpen.value = false;
    closeTaskEditorAfterSaving();
    successMessage.value = "Taskをアーカイブしました。";
    try {
      await context.loadBoardData();
    } catch (error: unknown) {
      // archive自体は確定済みのため、再実行を促さずBoard再読込だけを案内する。
      await context.handleConfirmedBoardRefreshError(
        error,
        DISPLAY_MESSAGES.task.board.archivedRefreshFailed
      );
    } finally {
      isArchiving.value = false;
    }
  };

  /** 選択中Taskを保ったままWBSへ遷移し、既存の日別実績入力Dialogを開く。 */
  const openTaskWorkLogs = async (): Promise<void> => {
    if (projectId.value === null || form.value.taskId === null) {
      return;
    }
    await router.push({
      name: ROUTE_NAMES.wbs,
      params: { projectId: projectId.value },
      query: { taskId: String(form.value.taskId), panel: "work-logs" },
    });
  };

  return {
    archiveTask,
    canCaptureTaskTemplate,
    canRecordTaskWork,
    canSave,
    canStartTaskTimer,
    closeArchiveConfirm,
    closeTaskEditor,
    discardTaskEditor,
    editorErrorMessages,
    form,
    handleEditorOpenChange,
    isArchiveConfirmOpen,
    isArchiving,
    isEditorOpen,
    isLoadingTask,
    isReadonly,
    isSaving,
    memberOptions,
    openArchiveConfirm,
    openTaskCreator,
    openTaskEditor,
    openTaskWorkLogs,
    priorityOptions,
    saveTask,
    statusOptions,
  };
};
