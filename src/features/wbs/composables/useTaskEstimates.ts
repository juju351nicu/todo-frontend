import { computed, ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import { ProjectApiError } from "@/features/project/api/projectApi";
import { isActiveProject } from "@/features/project/utils/projectStatus";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  HumanEstimateForm,
  TaskEstimateDecisionForm,
  TaskEstimateListResponse,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  resolveWbsStandardErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildHumanEstimateCreateRequest,
  buildTaskEstimateDecisionCreateRequest,
  validateHumanEstimateForm,
  validateTaskEstimateDecisionForm,
} from "@/features/wbs/utils/taskEstimate";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useTaskEstimates`が競合回復を画面全体へ委ねる操作。 */
export interface UseTaskEstimatesOptions {
  /** Project・WBS Task・依存関係・baselineを同じスナップショットとして取り直す。 */
  readonly reloadPageSnapshot: () => Promise<void>;
  /** 競合回復中の参照失敗を、Session動作または画面上部の案内へ変換する。 */
  readonly handleReadApiError: (error: unknown) => Promise<void>;
}

/**
 * WBS画面で通常TaskのHuman／AI Estimate履歴とHuman Estimate追加Dialogを管理する。
 *
 * - Dialogを開いたときだけ履歴を取得し、初期WBS読込へTask件数分のRequestを追加しない。
 * - Human Estimateは単一点または3点で追記し、正式予定工数と既存revisionは変更しない。
 * - TASK_UPDATEと既存Task担当者境界を画面でも案内するが、最終認可とTask versionはBackendを正本とする。
 * - 404／409ではProject・WBSを再取得し、最新Task versionと見積もり履歴へ置き換える。
 * - 401では`context.handleUnauthorized`へ委ね、統括composableがDialogとSessionを破棄する。
 *
 * @param context Project、WBS Task、権限、画面message、Session失効処理を提供する共通context
 * @param options 競合時の画面スナップショット再取得と参照エラー処理
 */
export const useTaskEstimates = (context: WbsPageContext, options: UseTaskEstimatesOptions) => {
  const userStore = useUserStore();

  const estimateEditorErrorMessages = ref<string[]>([]);
  const estimateSuccessMessage = ref("");
  const estimateTask = ref<WbsTask | null>(null);
  const estimateList = ref<TaskEstimateListResponse | null>(null);
  const isEstimateDialogOpen = ref(false);
  const isLoadingEstimates = ref(false);
  const isSavingEstimate = ref(false);
  const isDecidingEstimate = ref(false);
  /** 競合再取得後もWBSに存在するactive Taskか。archive後の履歴参照ではfalse。 */
  const isSelectedTaskAvailableForCreate = ref(false);

  /**
   * Backendが同じ読込で確定したTask version・正式予定工数と見積もり履歴を一緒に反映する。
   * 初期WBS取得後にTaskが更新されても、古いversionをHuman Estimate登録へ再送しない。
   */
  const applyEstimateList = (response: TaskEstimateListResponse): void => {
    estimateList.value = response;
    if (estimateTask.value?.taskId === response.taskId) {
      estimateTask.value = {
        ...estimateTask.value,
        plannedEffortMinutes: response.finalPlannedEffortMinutes,
        version: response.taskVersion,
      };
    }
    if (context.wbs.value?.tasks.some((task) => task.taskId === response.taskId)) {
      context.wbs.value = {
        ...context.wbs.value,
        tasks: context.wbs.value.tasks.map((task) =>
          task.taskId === response.taskId
            ? {
                ...task,
                plannedEffortMinutes: response.finalPlannedEffortMinutes,
                version: response.taskVersion,
              }
            : task
        ),
      };
    }
  };

  /**
   * 選択中TaskへHuman Estimateを追加できるか。
   * Project管理者以外のMEMBERは、自身が担当する通常Taskだけを変更できる。
   */
  const canCreateHumanEstimate = computed(
    () =>
      context.canEditWbs.value &&
      isActiveProject(context.project.value) &&
      isSelectedTaskAvailableForCreate.value &&
      estimateTask.value !== null &&
      (context.canManageProject.value ||
        estimateTask.value.assigneeAccountId === userStore.accountId)
  );

  /** Human Estimate追加と同じTask更新境界で、選択中revisionの採否を確定できるか。 */
  const canDecideEstimate = computed(() => canCreateHumanEstimate.value);

  /** 通常Taskを選択し、変更不能な見積もり履歴を取得してDialogを開く。 */
  const openEstimateDialog = async (taskId: number): Promise<void> => {
    if (isLoadingEstimates.value || isSavingEstimate.value || isDecidingEstimate.value) {
      return;
    }
    context.errorMessages.value = [];
    context.successMessage.value = "";
    const task = context.wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (task === undefined) {
      context.errorMessages.value = ["見積もりを参照するTaskが見つかりません。"];
      return;
    }
    if (task.taskType !== "TASK") {
      context.errorMessages.value = ["Human Estimateを登録できるのは通常Taskだけです。"];
      return;
    }

    estimateTask.value = { ...task };
    estimateList.value = null;
    estimateEditorErrorMessages.value = [];
    estimateSuccessMessage.value = "";
    isSelectedTaskAvailableForCreate.value = true;
    isEstimateDialogOpen.value = true;
    await loadSelectedTaskEstimates();
  };

  /** 選択中Taskの見積もり履歴を取得し、revision昇順のDialogスナップショットへ反映する。 */
  const loadSelectedTaskEstimates = async (): Promise<void> => {
    const task = estimateTask.value;
    const projectId = context.projectId.value;
    if (task === null || projectId === null || isLoadingEstimates.value) {
      return;
    }
    isLoadingEstimates.value = true;
    try {
      applyEstimateList(await WbsApi.getTaskEstimates(projectId, task.taskId));
    } catch (error: unknown) {
      await handleEstimateReadError(error);
    } finally {
      isLoadingEstimates.value = false;
    }
  };

  /** 見積もり履歴参照APIの失敗をDialogの案内またはSession失効処理へ変換する。 */
  const handleEstimateReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.taskEstimate.readForbidden,
      notFound: DISPLAY_MESSAGES.wbs.taskEstimate.readNotFound,
      failed: DISPLAY_MESSAGES.wbs.taskEstimate.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    estimateEditorErrorMessages.value = result.messages;
  };

  /** 読込・保存中でなければDialogと選択Task・履歴を破棄する。 */
  const closeEstimateDialog = (): void => {
    if (!isLoadingEstimates.value && !isSavingEstimate.value && !isDecidingEstimate.value) {
      discardEstimateDialog();
    }
  };

  /** Session失効時にも処理中状態に依存せずDialogの取得時点Task versionを破棄する。 */
  const discardEstimateDialog = (): void => {
    isEstimateDialogOpen.value = false;
    estimateTask.value = null;
    estimateList.value = null;
    estimateEditorErrorMessages.value = [];
    estimateSuccessMessage.value = "";
    isSelectedTaskAvailableForCreate.value = false;
  };

  /**
   * Human Estimate Formを検証し、Dialogを開いたTask version付きで新revisionを保存する。
   *
   * @param form 支援方法と単一点または3点の分単位見積もり
   */
  const saveHumanEstimate = async (form: HumanEstimateForm): Promise<void> => {
    const task = estimateTask.value;
    const projectId = context.projectId.value;
    if (task === null || projectId === null || isSavingEstimate.value || isDecidingEstimate.value) {
      return;
    }
    if (!canCreateHumanEstimate.value) {
      estimateEditorErrorMessages.value = [DISPLAY_MESSAGES.wbs.taskEstimate.updateForbidden];
      return;
    }
    const validationMessages = validateHumanEstimateForm(form);
    if (validationMessages.length > 0) {
      estimateEditorErrorMessages.value = validationMessages;
      return;
    }

    isSavingEstimate.value = true;
    estimateEditorErrorMessages.value = [];
    estimateSuccessMessage.value = "";
    try {
      applyEstimateList(
        await WbsApi.createHumanEstimate(
          projectId,
          task.taskId,
          buildHumanEstimateCreateRequest(form, task.version)
        )
      );
      estimateSuccessMessage.value = "Human Estimateを保存しました。";
    } catch (error: unknown) {
      await handleEstimateMutationError(error);
    } finally {
      isSavingEstimate.value = false;
    }
  };

  /**
   * 見積もり採否Formを検証し、Dialogの最新Task version付きで採否とFinal Plan反映を確定する。
   *
   * @param form 採否対象revision、採否code、必要な場合の調整後正式予定工数
   */
  const saveTaskEstimateDecision = async (form: TaskEstimateDecisionForm): Promise<void> => {
    const task = estimateTask.value;
    const projectId = context.projectId.value;
    if (task === null || projectId === null || isSavingEstimate.value || isDecidingEstimate.value) {
      return;
    }
    if (!canDecideEstimate.value) {
      estimateEditorErrorMessages.value = [DISPLAY_MESSAGES.wbs.taskEstimate.updateForbidden];
      return;
    }
    const selectedEstimate = estimateList.value?.estimates.find(
      (estimate) => estimate.taskEstimateSnapshotId === form.taskEstimateSnapshotId
    );
    const validationMessages = validateTaskEstimateDecisionForm(form, selectedEstimate);
    if (validationMessages.length > 0 || form.taskEstimateSnapshotId === null) {
      estimateEditorErrorMessages.value = validationMessages;
      return;
    }

    isDecidingEstimate.value = true;
    estimateEditorErrorMessages.value = [];
    estimateSuccessMessage.value = "";
    try {
      applyEstimateList(
        await WbsApi.createTaskEstimateDecision(
          projectId,
          task.taskId,
          form.taskEstimateSnapshotId,
          buildTaskEstimateDecisionCreateRequest(form, task.version)
        )
      );
      estimateSuccessMessage.value =
        form.decisionCode === "REJECTED"
          ? "見積もりを却下し、採否履歴へ保存しました。"
          : "見積もりをFinal Planへ反映し、採否履歴へ保存しました。";
    } catch (error: unknown) {
      await handleEstimateMutationError(error);
    } finally {
      isDecidingEstimate.value = false;
    }
  };

  /** Human Estimate登録APIのstatusを入力案内、競合再取得またはSession動作へ変換する。 */
  const handleEstimateMutationError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      estimateEditorErrorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      estimateEditorErrorMessages.value = [DISPLAY_MESSAGES.wbs.taskEstimate.updateForbidden];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      estimateEditorErrorMessages.value = resolveWbsErrorMessages(
        error,
        error.status === 409
          ? DISPLAY_MESSAGES.wbs.taskEstimate.conflict
          : DISPLAY_MESSAGES.wbs.taskEstimate.resourceNotFound
      );
      await reloadTaskAndEstimatesAfterConflict();
      return;
    }
    estimateEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.taskEstimate.saveFailed
    );
  };

  /**
   * 競合後にProject・WBSと見積もり履歴を再取得し、古いTask versionを再送しない。
   * TaskがarchiveされてWBSから消えた場合も、選択時のTask情報で既存履歴だけは参照可能にする。
   */
  const reloadTaskAndEstimatesAfterConflict = async (): Promise<void> => {
    const selectedTask = estimateTask.value;
    const projectId = context.projectId.value;
    if (selectedTask === null || projectId === null) {
      return;
    }
    try {
      await options.reloadPageSnapshot();
      const latestTask = context.wbs.value?.tasks.find(
        (candidate) => candidate.taskId === selectedTask.taskId
      );
      isSelectedTaskAvailableForCreate.value = latestTask !== undefined;
      if (latestTask !== undefined) {
        estimateTask.value = { ...latestTask };
      }
      applyEstimateList(await WbsApi.getTaskEstimates(projectId, selectedTask.taskId));
    } catch (refreshError: unknown) {
      if (
        (refreshError instanceof WbsApiError || refreshError instanceof ProjectApiError) &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        await options.handleReadApiError(refreshError);
        return;
      }
      estimateEditorErrorMessages.value.push(DISPLAY_MESSAGES.wbs.taskEstimate.reloadFailed);
    }
  };

  return {
    canCreateHumanEstimate,
    canDecideEstimate,
    closeEstimateDialog,
    discardEstimateDialog,
    estimateEditorErrorMessages,
    estimateList,
    estimateSuccessMessage,
    estimateTask,
    isEstimateDialogOpen,
    isLoadingEstimates,
    isDecidingEstimate,
    isSavingEstimate,
    openEstimateDialog,
    saveHumanEstimate,
    saveTaskEstimateDecision,
  };
};
