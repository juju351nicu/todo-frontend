import { computed, ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import { buildProjectMemberOptions } from "@/features/project/utils/projectMember";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  TaskEffortPlan,
  TaskEffortPlanAssigneeOption,
  TaskEffortPlanForm,
  TaskEffortPlanListResponse,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  resolveWbsStandardErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildTaskEffortPlanCreateRequest,
  buildTaskEffortPlanUpdateRequest,
  validateTaskEffortPlanForm,
} from "@/features/wbs/utils/taskEffortPlan";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useTaskEffortPlans`が画面の他領域へ委ねる操作。 */
export interface UseTaskEffortPlansOptions {
  /** 日別予定の変更・競合後に、担当者別workloadを現在の集計期間で再取得する。 */
  readonly reloadWorkload: () => Promise<void>;
}

/**
 * WBS画面で通常Taskの日別予定工数（Taskの予定工数を日付・担当者へ配賦したもの）のDialogを管理する。
 *
 * - 呼び出すAPI: `WbsApi.getTaskEffortPlans`、`createTaskEffortPlan`／`updateTaskEffortPlan`（登録・更新後の一覧Responseで差し替え）、
 *   `deleteTaskEffortPlan`（取得時点version付き、204確定後に一覧と配賦集計をFrontendで更新）。
 * - 対象は通常Task（`taskType === "TASK"`）だけ。SummaryとMilestoneでは画面上部へ理由を表示してDialogを開かない。
 * - 変更権限: TASK_UPDATEを持ち、Project管理権限（SYSTEM_ADMIN・OWNER・MANAGER）があれば全予定、
 *   それ以外は本人担当Taskの本人の予定だけ。最終判定はBackendが行う。
 * - 変更後と404・409の後は`reloadWorkload`でworkloadも再取得する。
 * - 401では`context.handleUnauthorized`へ委ね、Dialogは統括の`useWbsPage`が`discardEffortPlanDialog`で閉じる。
 *
 * @param context Project ID、WBS Task、Project member、権限、画面上部message、Session失効処理を提供する画面共通context
 * @param options 変更後のworkload再取得
 */
export const useTaskEffortPlans = (
  context: WbsPageContext,
  options: UseTaskEffortPlansOptions
) => {
  const userStore = useUserStore();

  /** 更新Formへ読み込んだ日別予定と取得時点version。新規登録Formの場合はnull。 */
  const editingEffortPlan = ref<TaskEffortPlan | null>(null);
  const isDeletingEffortPlan = ref(false);
  const isEffortPlanDialogOpen = ref(false);
  const isLoadingEffortPlans = ref(false);
  const isSavingEffortPlan = ref(false);
  const effortPlanEditorErrorMessages = ref<string[]>([]);
  /** Dialogに表示する日別予定一覧と配賦集計。Dialogを開いた直後と取得失敗時はnull。 */
  const effortPlanList = ref<TaskEffortPlanListResponse | null>(null);
  /** 削除確認中の日別予定と取得時点version。確認Dialogの開閉もこの値の有無で決まる。 */
  const effortPlanPendingDelete = ref<TaskEffortPlan | null>(null);
  const effortPlanSuccessMessage = ref("");
  /** Dialogを開いたTaskの複製。Dialogを閉じている間はnull。 */
  const effortPlanTask = ref<WbsTask | null>(null);

  /** 他memberの予定も変更できるか。Project管理権限と同じ条件。 */
  const canManageAnyEffortPlan = computed(() => context.canManageProject.value);
  /** 選択中Taskへ日別予定を登録できるか。Project管理権限がなければ本人担当Taskだけ。 */
  const canEditSelectedEffortPlanTask = computed(
    () =>
      context.canEditWbs.value &&
      effortPlanTask.value !== null &&
      (canManageAnyEffortPlan.value ||
        effortPlanTask.value.assigneeAccountId === userStore.accountId)
  );
  /**
   * 予定担当者の候補。Project管理権限がなければ本人だけ。
   * Backendは停止中アカウントを予定担当者に指定できない（400）ため、ACTIVEな参加者だけを表示名付きで出す。
   */
  const effortPlanAssigneeOptions = computed<TaskEffortPlanAssigneeOption[]>(
    () =>
      buildProjectMemberOptions(
        (context.project.value?.members ?? []).filter(
          (member) =>
            canManageAnyEffortPlan.value ||
            member.accountId === userStore.accountId
        )
      )
  );
  const isEffortPlanMutating = computed(
    () => isSavingEffortPlan.value || isDeletingEffortPlan.value
  );

  /**
   * 通常Taskだけを選択し、日別予定Dialogを開いて最新の配賦状況を取得する。
   * 読込・保存・削除中の再実行は無視する。
   *
   * @param taskId 階層表で選択したTask ID
   */
  const openEffortPlanDialog = async (taskId: number): Promise<void> => {
    if (isLoadingEffortPlans.value || isEffortPlanMutating.value) {
      return;
    }
    context.errorMessages.value = [];
    context.successMessage.value = "";
    const task = context.wbs.value?.tasks.find(
      (candidate) => candidate.taskId === taskId
    );
    if (task === undefined) {
      context.errorMessages.value = ["予定工数を参照するTaskが見つかりません。"];
      return;
    }
    if (task.taskType !== "TASK") {
      context.errorMessages.value = [
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
    const projectId = context.projectId.value;
    if (task === null || projectId === null || isLoadingEffortPlans.value) {
      return;
    }
    isLoadingEffortPlans.value = true;
    try {
      effortPlanList.value = await WbsApi.getTaskEffortPlans(
        projectId,
        task.taskId
      );
    } catch (error: unknown) {
      await handleEffortPlanReadError(error);
    } finally {
      isLoadingEffortPlans.value = false;
    }
  };

  /** 日別予定参照APIの失敗をDialogの案内またはSession失効処理へ変換する。 */
  const handleEffortPlanReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.effortPlan.readForbidden,
      notFound: DISPLAY_MESSAGES.wbs.effortPlan.readNotFound,
      failed: DISPLAY_MESSAGES.wbs.effortPlan.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    effortPlanEditorErrorMessages.value = result.messages;
  };

  /** 読込・保存・削除中でなければ日別予定Dialogと一時状態を破棄する。 */
  const closeEffortPlanDialog = (): void => {
    if (!isLoadingEffortPlans.value && !isEffortPlanMutating.value) {
      closeEffortPlanDialogAfterOperation();
    }
  };

  /**
   * Session失効や確定操作後にも使用できるよう、処理中状態に依存せずDialogを閉じる。
   * Session失効時は統括の`useWbsPage`が`discardEffortPlanDialog`として呼ぶ。
   */
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
      effortPlan.assigneeAccountId === userStore.accountId);

  /**
   * 取得済み日別予定を複製し、取得時点versionを保持した編集状態へ移す。
   *
   * @param effortPlanId Dialogの一覧で選択した日別予定ID
   */
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
    const projectId = context.projectId.value;
    if (isSavingEffortPlan.value || task === null || projectId === null) {
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
              projectId,
              task.taskId,
              buildTaskEffortPlanCreateRequest(form)
            )
          : await WbsApi.updateTaskEffortPlan(
              projectId,
              task.taskId,
              currentEffortPlan.effortPlanId,
              buildTaskEffortPlanUpdateRequest(form, currentEffortPlan.version)
            );
      editingEffortPlan.value = null;
      effortPlanSuccessMessage.value =
        currentEffortPlan === null
          ? "Task日別予定を登録しました。"
          : "Task日別予定を更新しました。";
      await options.reloadWorkload();
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
      await context.handleUnauthorized();
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

  /**
   * 競合後に日別予定とworkloadを再取得し、古いversion・配賦集計を残さない。
   * 一覧の再取得に失敗した場合は、表示中の競合理由を残して再読込案内を追加し、workloadは再取得しない。
   */
  const reloadEffortPlansAfterConflict = async (): Promise<void> => {
    const task = effortPlanTask.value;
    const projectId = context.projectId.value;
    if (task === null || projectId === null) {
      return;
    }
    // 例外を内部で案内へ変換するloadSelectedTaskEffortPlansは使わない。競合理由を上書きせず、
    // 401等の後にworkloadを再取得しないよう、再取得の失敗をここで判定する。
    try {
      effortPlanList.value = await WbsApi.getTaskEffortPlans(
        projectId,
        task.taskId
      );
      await options.reloadWorkload();
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // 再取得時点の認証・認可・公開範囲を操作時点の競合理由より優先する。
        await handleEffortPlanReadError(refreshError);
        return;
      }
      effortPlanEditorErrorMessages.value.push(
        DISPLAY_MESSAGES.wbs.effortPlan.reloadFailed
      );
    }
  };

  /**
   * 取得済み一覧から削除対象とversionを確定して確認Dialogを開く。
   *
   * @param effortPlanId Dialogの一覧で選択した日別予定ID
   */
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
    const projectId = context.projectId.value;
    if (
      task === null ||
      effortPlan === null ||
      projectId === null ||
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
        projectId,
        task.taskId,
        effortPlan.effortPlanId,
        effortPlan.version
      );
      // 削除APIは204で一覧を返さないため、配賦合計と未配賦工数を残りの予定から算出し直す。
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
      await options.reloadWorkload();
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
      await context.handleUnauthorized();
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

  /**
   * 日別予定の削除確認dialogが閉じられた場合だけ確認対象を破棄する。
   *
   * @param open dialogの新しい開閉状態
   */
  const handleEffortPlanDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelEffortPlanDelete();
    }
  };

  return {
    canEditSelectedEffortPlanTask,
    canManageAnyEffortPlan,
    cancelEffortPlanDelete,
    cancelEffortPlanEdit,
    closeEffortPlanDialog,
    discardEffortPlanDialog: closeEffortPlanDialogAfterOperation,
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
  };
};
