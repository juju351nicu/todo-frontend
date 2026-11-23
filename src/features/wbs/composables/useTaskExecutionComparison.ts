import { computed, onScopeDispose, ref } from "vue";
import { useUserStore } from "@/features/auth/stores/user";
import { isActiveProject } from "@/features/project/utils/projectStatus";
import {
  getExecutionComparison,
  recordExecutionSetting,
} from "@/features/wbs/api/taskExecutionApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { ExecutionComparison, ExecutionSettingForm } from "@/features/wbs/types/taskExecution";
import type { WbsTask } from "@/features/wbs/types/wbs";
import { buildExecutionSettingRequest } from "@/features/wbs/utils/taskExecution";
import { isValidIsoLocalDate } from "@/features/wbs/utils/effort";
import { resolveWbsStandardErrorMessages } from "@/features/wbs/utils/apiErrors";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";

/** 本人Taskの期間比較と申告保存を担当し、対象切替・close後の古い応答を反映しない。 */
export const useTaskExecutionComparison = (context: WbsPageContext) => {
  const userStore = useUserStore();
  const executionTask = ref<WbsTask | null>(null);
  const isExecutionComparisonOpen = ref(false);
  const executionComparison = ref<ExecutionComparison | null>(null);
  const executionDateFrom = ref(getBusinessToday().slice(0, 8) + "01");
  const executionDateTo = ref(getBusinessToday());
  const isLoadingExecutionComparison = ref(false);
  const isSavingExecutionSetting = ref(false);
  const executionErrorMessages = ref<string[]>([]);
  const executionSuccessMessage = ref("");
  const tracker = createLatestRequestTracker();
  let generation = 0;
  const canRecordExecutionSetting = computed(
    () =>
      context.canEditWbs.value &&
      isActiveProject(context.project.value) &&
      !!executionTask.value &&
      (context.canManageProject.value ||
        executionTask.value.assigneeAccountId === userStore.accountId)
  );
  /** 認証境界・破棄時は保存中でもすべての状態と古い応答を無効にする。 */
  const discardExecutionComparison = (): void => {
    generation += 1;
    tracker.begin();
    isExecutionComparisonOpen.value = false;
    executionTask.value = null;
    executionComparison.value = null;
    isLoadingExecutionComparison.value = false;
    isSavingExecutionSetting.value = false;
    executionErrorMessages.value = [];
    executionSuccessMessage.value = "";
  };
  /** status・Backendの許可済みcodeだけから案内し、401は既存のSession失効処理へ委ねる。 */
  const handleError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: "比較または設定の記録権限がありません。",
      notFound: "Taskまたは本人の対象Timerが見つかりません。",
      conflict: "設定または計測が記録済みです。再読込して確認してください。",
      failed: "設定別実績を処理できませんでした。期間と入力を確認してください。",
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    executionErrorMessages.value = result.messages;
  };
  /** 最新の通常Task・期間だけを読み込み、過去の応答とclose後の完了を捨てる。 */
  const loadExecutionComparison = async (): Promise<void> => {
    const projectId = context.projectId.value;
    const task = executionTask.value;
    if (
      !isExecutionComparisonOpen.value ||
      projectId === null ||
      task === null ||
      isSavingExecutionSetting.value
    )
      return;
    const current = tracker.begin();
    executionComparison.value = null;
    isLoadingExecutionComparison.value = false;
    if (
      !isValidIsoLocalDate(executionDateFrom.value) ||
      !isValidIsoLocalDate(executionDateTo.value) ||
      executionDateFrom.value > executionDateTo.value
    ) {
      executionErrorMessages.value = ["開始日と終了日を正しく指定してください。"];
      return;
    }
    isLoadingExecutionComparison.value = true;
    executionErrorMessages.value = [];
    try {
      const response = await getExecutionComparison(
        projectId,
        task.taskId,
        executionDateFrom.value,
        executionDateTo.value
      );
      if (current()) executionComparison.value = response;
    } catch (error: unknown) {
      if (current()) await handleError(error);
    } finally {
      if (current()) isLoadingExecutionComparison.value = false;
    }
  };
  /** 通常Taskだけを開く。初期表示・他のTaskには比較APIを送らない。 */
  const openExecutionComparison = async (taskId: number): Promise<void> => {
    if (isSavingExecutionSetting.value) return;
    const task = context.wbs.value?.tasks.find((candidate) => candidate.taskId === taskId);
    if (!task || task.taskType !== "TASK" || context.projectId.value === null) return;
    generation += 1;
    executionTask.value = task;
    isExecutionComparisonOpen.value = true;
    executionComparison.value = null;
    executionSuccessMessage.value = "";
    await loadExecutionComparison();
  };
  /** 保存中のcloseを抑止し、それ以外は古い読込を無効にする。 */
  const closeExecutionComparison = (): void => {
    if (!isSavingExecutionSetting.value) discardExecutionComparison();
  };
  /** 本人停止Sessionへの二重送信を防ぎ、保存後は正本を再取得する。自動再送はしない。 */
  const saveExecutionSetting = async (form: ExecutionSettingForm): Promise<void> => {
    const projectId = context.projectId.value;
    const task = executionTask.value;
    if (
      isSavingExecutionSetting.value ||
      isLoadingExecutionComparison.value ||
      !canRecordExecutionSetting.value ||
      projectId === null ||
      !task
    )
      return;
    const request = buildExecutionSettingRequest(form);
    const session = executionComparison.value?.sessions.find(
      (candidate) => candidate.timerSessionId === request?.timerSessionId
    );
    if (!request || !session || session.settings !== null) {
      executionErrorMessages.value = ["未記録の本人Timerと支援mode・入力上限を確認してください。"];
      return;
    }
    const currentGeneration = generation;
    tracker.begin();
    isSavingExecutionSetting.value = true;
    executionErrorMessages.value = [];
    executionSuccessMessage.value = "";
    try {
      await recordExecutionSetting(projectId, task.taskId, request);
      if (generation === currentGeneration)
        executionSuccessMessage.value = "申告した実行設定を記録しました。";
    } catch (error: unknown) {
      if (generation === currentGeneration) await handleError(error);
    } finally {
      if (generation === currentGeneration) isSavingExecutionSetting.value = false;
    }
    if (generation === currentGeneration) {
      const saveErrors = [...executionErrorMessages.value];
      await loadExecutionComparison();
      if (
        generation === currentGeneration &&
        saveErrors.length &&
        !executionErrorMessages.value.length
      ) {
        executionErrorMessages.value = saveErrors;
      }
    }
  };
  onScopeDispose(discardExecutionComparison, true);
  return {
    executionTask,
    isExecutionComparisonOpen,
    executionComparison,
    executionDateFrom,
    executionDateTo,
    isLoadingExecutionComparison,
    isSavingExecutionSetting,
    executionErrorMessages,
    executionSuccessMessage,
    canRecordExecutionSetting,
    openExecutionComparison,
    closeExecutionComparison,
    discardExecutionComparison,
    loadExecutionComparison,
    saveExecutionSetting,
  };
};
