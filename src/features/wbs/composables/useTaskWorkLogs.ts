import { computed, ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  TaskWorkLog,
  TaskWorkLogForm,
  TaskWorkLogListResponse,
  TaskWorkLogWorkerOption,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  resolveWbsStandardErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildTaskWorkLogCreateRequest,
  buildTaskWorkLogUpdateRequest,
  validateTaskWorkLogForm,
} from "@/features/wbs/utils/taskWorkLog";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useTaskWorkLogs`が画面の他領域へ委ねる操作。 */
export interface UseTaskWorkLogsOptions {
  /** 日別実績の変更・競合後に、担当者別workloadを現在の集計期間で再取得する。 */
  readonly reloadWorkload: () => Promise<void>;
  /**
   * 利用者がDialogを閉じた後に呼ぶ。Boardの導線で付いたURLのqueryを外し、再読込で再び開かないようにするために使う。
   * Session失効による破棄（`discardWorkLogDialog`）では呼ばない。
   */
  readonly onDialogClosed?: () => void;
}

/**
 * WBS画面で通常Taskの日別実績工数（業務日・作業者ごとの実績）のDialogを管理する。
 *
 * - 呼び出すAPI: `WbsApi.getTaskWorkLogs`、`createTaskWorkLog`／`updateTaskWorkLog`（登録・更新後の一覧Responseで差し替え）、
 *   `deleteTaskWorkLog`（取得時点version付き、204確定後に一覧と実績合計をFrontendで更新）。
 * - 対象は通常Task（`taskType === "TASK"`）だけ。SummaryとMilestoneでは画面上部へ理由を表示してDialogを開かない。
 * - 変更権限: TASK_UPDATEを持ち、Project管理権限（SYSTEM_ADMIN・OWNER・MANAGER）があれば全実績、
 *   それ以外は本人担当Taskの本人の実績だけ。最終判定はBackendが行う。
 * - Boardの「日別実績」導線（URLの`panel=work-logs&taskId=…`）では、`useWbsPage`が初期表示後にこのDialogを開き、
 *   利用者が閉じたら`onDialogClosed`でqueryを外す。
 * - 変更後と404・409の後は`reloadWorkload`でworkloadも再取得する。
 * - 401では`context.handleUnauthorized`へ委ね、Dialogは統括の`useWbsPage`が`discardWorkLogDialog`で閉じる。
 *
 * @param context Project ID、WBS Task、Project member、権限、画面上部message、Session失効処理を提供する画面共通context
 * @param options 変更後のworkload再取得と、Dialogを閉じた後の通知
 */
export const useTaskWorkLogs = (
  context: WbsPageContext,
  options: UseTaskWorkLogsOptions
) => {
  const userStore = useUserStore();

  /** 更新Formへ読み込んだ日別実績と取得時点version。新規登録Formの場合はnull。 */
  const editingWorkLog = ref<TaskWorkLog | null>(null);
  const isDeletingWorkLog = ref(false);
  const isLoadingWorkLogs = ref(false);
  const isSavingWorkLog = ref(false);
  const isWorkLogDialogOpen = ref(false);
  const workLogEditorErrorMessages = ref<string[]>([]);
  /** Dialogに表示する日別実績一覧と実績合計。Dialogを開いた直後と取得失敗時はnull。 */
  const workLogList = ref<TaskWorkLogListResponse | null>(null);
  /** 削除確認中の日別実績と取得時点version。確認Dialogの開閉もこの値の有無で決まる。 */
  const workLogPendingDelete = ref<TaskWorkLog | null>(null);
  const workLogSuccessMessage = ref("");
  /** Dialogを開いたTaskの複製。Dialogを閉じている間はnull。 */
  const workLogTask = ref<WbsTask | null>(null);

  /** 他memberの実績も変更できるか。Project管理権限と同じ条件。 */
  const canManageAnyWorkLog = computed(() => context.canManageProject.value);
  /** 選択中Taskへ日別実績を登録できるか。Project管理権限がなければ本人担当Taskだけ。 */
  const canEditSelectedWorkLogTask = computed(
    () =>
      context.canEditWbs.value &&
      workLogTask.value !== null &&
      (canManageAnyWorkLog.value ||
        workLogTask.value.assigneeAccountId === userStore.memberId)
  );
  /** 作業者の候補。Project管理権限がなければ本人だけ。 */
  const workLogWorkerOptions = computed<TaskWorkLogWorkerOption[]>(() =>
    (context.project.value?.members ?? [])
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

  /**
   * 通常Taskだけを選択し、日別実績Dialogを開いて最新一覧を取得する。
   * 読込・保存・削除中の再実行は無視する。
   *
   * @param taskId 階層表またはBoard導線で指定されたTask ID
   */
  const openWorkLogDialog = async (taskId: number): Promise<void> => {
    if (isLoadingWorkLogs.value || isWorkLogMutating.value) {
      return;
    }
    context.errorMessages.value = [];
    context.successMessage.value = "";
    const task = context.wbs.value?.tasks.find(
      (candidate) => candidate.taskId === taskId
    );
    if (task === undefined) {
      context.errorMessages.value = ["実績工数を参照するTaskが見つかりません。"];
      return;
    }
    if (task.taskType !== "TASK") {
      context.errorMessages.value = [
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
    const projectId = context.projectId.value;
    if (task === null || projectId === null || isLoadingWorkLogs.value) {
      return;
    }
    isLoadingWorkLogs.value = true;
    try {
      workLogList.value = await WbsApi.getTaskWorkLogs(projectId, task.taskId);
    } catch (error: unknown) {
      await handleWorkLogReadError(error);
    } finally {
      isLoadingWorkLogs.value = false;
    }
  };

  /** 日別実績参照APIの失敗をDialogの案内またはSession失効処理へ変換する。 */
  const handleWorkLogReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.workLog.readForbidden,
      notFound: DISPLAY_MESSAGES.wbs.workLog.readNotFound,
      failed: DISPLAY_MESSAGES.wbs.workLog.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    workLogEditorErrorMessages.value = result.messages;
  };

  /** 読込・保存・削除中でなければ日別実績Dialogと一時状態を破棄し、閉じたことを統括composableへ知らせる。 */
  const closeWorkLogDialog = (): void => {
    if (!isLoadingWorkLogs.value && !isWorkLogMutating.value) {
      closeWorkLogDialogAfterOperation();
      options.onDialogClosed?.();
    }
  };

  /**
   * Session失効や確定操作後にも使用できるよう、処理中状態に依存せずDialogを閉じる。
   * Session失効時は統括の`useWbsPage`が`discardWorkLogDialog`として呼ぶ。
   */
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

  /**
   * 取得済み日別実績を複製し、取得時点versionを保持した編集状態へ移す。
   *
   * @param workLogId Dialogの一覧で選択した日別実績ID
   */
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
    const projectId = context.projectId.value;
    if (isSavingWorkLog.value || task === null || projectId === null) {
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
    const validationMessages = validateTaskWorkLogForm(form, allowedWorkerIds);
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
              projectId,
              task.taskId,
              buildTaskWorkLogCreateRequest(form)
            )
          : await WbsApi.updateTaskWorkLog(
              projectId,
              task.taskId,
              currentWorkLog.workLogId,
              buildTaskWorkLogUpdateRequest(form, currentWorkLog.version)
            );
      editingWorkLog.value = null;
      workLogSuccessMessage.value =
        currentWorkLog === null
          ? "Task日別実績を登録しました。"
          : "Task日別実績を更新しました。";
      await options.reloadWorkload();
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
      await context.handleUnauthorized();
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
    const projectId = context.projectId.value;
    if (task === null || projectId === null) {
      return;
    }
    try {
      workLogList.value = await WbsApi.getTaskWorkLogs(projectId, task.taskId);
      await options.reloadWorkload();
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

  /**
   * 取得済み一覧から削除対象とversionを確定して確認Dialogを開く。
   *
   * @param workLogId Dialogの一覧で選択した日別実績ID
   */
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
    const projectId = context.projectId.value;
    if (
      task === null ||
      workLog === null ||
      projectId === null ||
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
        projectId,
        task.taskId,
        workLog.workLogId,
        workLog.version
      );
      // 削除APIは204で一覧を返さないため、実績合計を残りの実績から算出し直す。
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
      await options.reloadWorkload();
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
      await context.handleUnauthorized();
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
   * 日別実績の削除確認dialogが閉じられた場合だけ確認対象を破棄する。
   *
   * @param open dialogの新しい開閉状態
   */
  const handleWorkLogDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelWorkLogDelete();
    }
  };

  return {
    canEditSelectedWorkLogTask,
    canManageAnyWorkLog,
    cancelWorkLogDelete,
    cancelWorkLogEdit,
    closeWorkLogDialog,
    discardWorkLogDialog: closeWorkLogDialogAfterOperation,
    confirmWorkLogDelete,
    editWorkLog,
    editingWorkLog,
    handleWorkLogDeleteDialogVisibility,
    isDeletingWorkLog,
    isLoadingWorkLogs,
    isSavingWorkLog,
    isWorkLogDialogOpen,
    isWorkLogMutating,
    openWorkLogDialog,
    requestWorkLogDelete,
    saveWorkLog,
    workLogEditorErrorMessages,
    workLogList,
    workLogPendingDelete,
    workLogSuccessMessage,
    workLogTask,
    workLogWorkerOptions,
  };
};
