import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type {
  ProjectDetail,
  TaskBoard,
  TaskDetail,
} from "@/features/project/types/project";
import { resolveProjectMemberDisplayName } from "@/features/project/utils/projectMember";
import { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import type {
  TaskBoardApiError,
  TaskBoardPageContext,
} from "@/features/task/composables/taskBoardPageContext";
import { useTaskBoardMove } from "@/features/task/composables/useTaskBoardMove";
import { useTaskBoardPermissions } from "@/features/task/composables/useTaskBoardPermissions";
import { useTaskEditor } from "@/features/task/composables/useTaskEditor";
import {
  TASK_BOARD_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

/** Board画面で扱うProject／Task API例外か判定する。 */
const isTaskBoardApiError = (error: unknown): error is TaskBoardApiError =>
  error instanceof ProjectApiError || error instanceof ProjectTaskApiError;

/**
 * Project Board画面の状態をまとめる。Boardの読込、`?taskId=`のTaskを開く処理、APIエラーの表示と回復を持ち、
 * 次の領域別composableを組み合わせて、画面（`TaskBoardPage.vue`）へ1つの戻り値として渡す。
 *
 * - `useTaskBoardPermissions`: Project単位の操作の可否
 * - `useTaskEditor`: Task作成・編集Dialog（登録・更新・archive）
 * - `useTaskBoardMove`: Taskの移動（dragとキーボード）
 *
 * 領域別composableへは`TaskBoardPageContext`で画面共通の状態とエラー処理を渡す。
 */
export const useTaskBoardPage = () => {
  const route = useRoute();
  const { expireSession } = useSessionExpiry();

  const board = ref<TaskBoard | null>(null);
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");

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
    taskMove.discardDragSnapshot();
    taskEditor.discardTaskEditor();
  };

  /** Session失効時に古いBoardとメッセージを破棄してLoginへ戻す。 */
  const handleUnauthorized = async (): Promise<void> => {
    errorMessages.value = [];
    successMessage.value = "";
    clearBoardState();
    await expireSession();
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
    messageTarget = errorMessages
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

  const context: TaskBoardPageContext = {
    board,
    errorMessages,
    handleApiError,
    handleConfirmedBoardRefreshError,
    loadBoardData,
    project,
    projectId,
    reloadBoardAfterConflict,
    successMessage,
  };
  const permissions = useTaskBoardPermissions(project);
  const taskEditor = useTaskEditor(context, permissions);
  const taskMove = useTaskBoardMove(context, permissions);
  const { isArchiving, isSaving, openTaskEditor } = taskEditor;

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

  // 同じProjectのBoardを開いたまま`?taskId=`だけが変わる遷移（通知から同じProjectの別Taskを開く、ブラウザーの戻る等）では、
  // Vue RouterがComponentを再利用して`initialize`を呼び直さないため、ここで指定のTaskを開く。
  // Projectが変わる遷移は画面ごと作り直す（`app/router/routerViewKey.ts`）ので、ここでは扱わない。
  // - taskIdが外れた場合は何もしない。Dialogを閉じたときに`useTaskEditor`がqueryを外すため。
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

  return {
    applyProjectDetail,
    archiveTask: taskEditor.archiveTask,
    board,
    canArchiveTask: permissions.canArchiveTask,
    canArchiveTaskTemplate: permissions.canArchiveTaskTemplate,
    canCaptureProjectTemplate: permissions.canCaptureProjectTemplate,
    canCaptureTaskTemplate: taskEditor.canCaptureTaskTemplate,
    canCreateTask: permissions.canCreateTask,
    canCreateTaskRecurrence: permissions.canCreateTaskRecurrence,
    canMoveTask: permissions.canMoveTask,
    canPostTaskComment: permissions.canPostTaskComment,
    canRecordTaskWork: taskEditor.canRecordTaskWork,
    canSave: taskEditor.canSave,
    canStartTaskTimer: taskEditor.canStartTaskTimer,
    canUpdateTask: permissions.canUpdateTask,
    canUpdateTaskRecurrence: permissions.canUpdateTaskRecurrence,
    closeArchiveConfirm: taskEditor.closeArchiveConfirm,
    closeTaskEditor: taskEditor.closeTaskEditor,
    editorErrorMessages: taskEditor.editorErrorMessages,
    errorMessages,
    finishTaskDrag: taskMove.finishTaskDrag,
    form: taskEditor.form,
    handleEditorOpenChange: taskEditor.handleEditorOpenChange,
    handleTaskDrop: taskMove.handleTaskDrop,
    handleTemplateTaskCreated,
    initialize,
    isArchiveConfirmOpen: taskEditor.isArchiveConfirmOpen,
    isArchiving,
    isEditorOpen: taskEditor.isEditorOpen,
    isLoading,
    isLoadingTask: taskEditor.isLoadingTask,
    isMoving: taskMove.isMoving,
    isReadonly: taskEditor.isReadonly,
    isSaving,
    memberOptions: taskEditor.memberOptions,
    moveTaskByKeyboard: taskMove.moveTaskByKeyboard,
    openArchiveConfirm: taskEditor.openArchiveConfirm,
    openTaskCreator: taskEditor.openTaskCreator,
    openTaskEditor,
    openTaskWorkLogs: taskEditor.openTaskWorkLogs,
    priorityOptions: taskEditor.priorityOptions,
    project,
    resolveAssigneeDisplayName,
    saveTask: taskEditor.saveTask,
    startTaskDrag: taskMove.startTaskDrag,
    statusOptions: taskEditor.statusOptions,
    successMessage,
    taskTemplateAssigneeAccountId: permissions.taskTemplateAssigneeAccountId,
  };
};
