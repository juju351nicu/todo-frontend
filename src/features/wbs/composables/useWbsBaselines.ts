import { computed, ref } from "vue";
import type { Ref } from "vue";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  WbsBaselineComparisonRow,
  WbsBaselineCreateForm,
  WbsBaselineDetailResponse,
  WbsBaselineListResponse,
  WbsBaselineSummary,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildWbsBaselineComparisonRows,
  buildWbsBaselineCreateRequest,
  validateWbsBaselineCreateForm,
} from "@/features/wbs/utils/wbsBaseline";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useWbsBaselines`が画面の他領域へ委ねる操作。 */
export interface UseWbsBaselinesOptions {
  /**
   * baselineの作成・有効化が確定し、active baseline（EVMの基準計画）が変わったときに呼ぶ。
   * 変更前の基準で集計したEVMを破棄するために使う。
   */
  readonly onActiveBaselineChanged: () => void;
}

/**
 * WBS画面のbaseline（保存済み計画）の一覧・比較・作成・有効化を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getWbsBaselines`／`getWbsBaseline`（一覧とactive baseline詳細）、
 *   `createWbsBaseline`（現在計画の保存）、`activateWbsBaseline`（取得時点version付きの切替）。
 * - 作成・有効化はProjectがACTIVEで、TASK_UPDATEとProject管理権限（SYSTEM_ADMIN・OWNER・MANAGER）がある場合だけ許可する。
 * - 409競合では理由を表示し、一覧とactive baseline詳細をBackendの最新状態へ取り直す。
 * - 401では`context.handleUnauthorized`へ委ね、作成Dialogは統括の`useWbsPage`が`discardBaselineDialogs`で閉じる。
 *
 * @param context Project ID、WBS Task、権限、Session失効処理を提供する画面共通context
 * @param options active baseline変更をEVMへ伝えるcallback
 */
export const useWbsBaselines = (
  context: WbsPageContext,
  options: UseWbsBaselinesOptions
) => {
  /** 最後に取得したbaseline一覧。未取得・初期表示の取得失敗時はnull。 */
  const baselineList = ref<WbsBaselineListResponse | null>(null);
  /** 現在計画と比較するactive baselineの詳細。active baselineがない場合はnull。 */
  const activeBaselineDetail = ref<WbsBaselineDetailResponse | null>(null);
  /** 有効化APIを実行中のbaseline ID。実行中でなければnull。 */
  const activatingBaselineId = ref<number | null>(null);
  const baselineEditorErrorMessages = ref<string[]>([]);
  const baselineErrorMessages = ref<string[]>([]);
  const baselineSuccessMessage = ref("");
  const isBaselineCreateDialogOpen = ref(false);
  const isCreatingBaseline = ref(false);

  const canManageBaselines = computed(
    () =>
      context.canEditWbs.value &&
      context.project.value?.status === "ACTIVE" &&
      context.canManageProject.value
  );
  const activeBaseline = computed(
    () => baselineList.value?.baselines.find((baseline) => baseline.active) ?? null
  );
  const isBaselineMutating = computed(
    () => isCreatingBaseline.value || activatingBaselineId.value !== null
  );
  /** 現在のWBS Taskとactive baselineを突き合わせた全Taskの比較行。 */
  const baselineComparisonRows = computed<WbsBaselineComparisonRow[]>(() =>
    buildWbsBaselineComparisonRows(
      context.wbs.value?.tasks ?? [],
      activeBaselineDetail.value?.tasks ?? []
    )
  );
  /** 比較行のうち、追加・削除・変更があった行だけ。baseline cardへ表示する。 */
  const baselineChangedRows = computed(() =>
    baselineComparisonRows.value.filter((row) => row.status !== "UNCHANGED")
  );

  /**
   * baseline一覧を取得し、比較に必要なactive baselineの詳細だけを追加取得する。
   *
   * @throws Error Project IDが不正な場合
   * @throws WbsApiError 一覧または詳細の取得に失敗した場合。呼出側が画面全体またはbaseline cardの案内へ変換する
   */
  const loadWbsBaselines = async (): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null) {
      throw new Error("Project IDが不正です。");
    }
    const loadedList = await WbsApi.getWbsBaselines(projectId);
    baselineList.value = loadedList;
    const loadedActiveBaseline = loadedList.baselines.find(
      (baseline) => baseline.active
    );
    activeBaselineDetail.value = loadedActiveBaseline
      ? await WbsApi.getWbsBaseline(projectId, loadedActiveBaseline.baselineId)
      : null;
  };

  /** baseline作成Dialogを、Project管理権限と更新可能状態を確認して開く。 */
  const openBaselineCreateDialog = (): void => {
    baselineErrorMessages.value = [];
    baselineSuccessMessage.value = "";
    baselineEditorErrorMessages.value = [];
    if (!canManageBaselines.value) {
      baselineErrorMessages.value = [
        "baselineを作成するにはProjectのOWNERまたはMANAGER権限が必要です。",
      ];
      return;
    }
    isBaselineCreateDialogOpen.value = true;
  };

  /** 保存処理中でなければbaseline作成Dialogを閉じる。 */
  const closeBaselineCreateDialog = (): void => {
    if (!isCreatingBaseline.value) {
      closeBaselineCreateDialogAfterSaving();
    }
  };

  /**
   * API成功またはSession失効後にbaseline作成Dialogを強制的に閉じる。
   * Session失効時は統括の`useWbsPage`が`discardBaselineDialogs`として呼ぶ。
   */
  const closeBaselineCreateDialogAfterSaving = (): void => {
    isBaselineCreateDialogOpen.value = false;
    baselineEditorErrorMessages.value = [];
  };

  /** baseline API競合後にも一覧とactive baseline詳細を最新状態へ戻す。 */
  const reloadWbsBaselines = async (): Promise<void> => {
    try {
      await loadWbsBaselines();
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // 認証・認可・公開範囲の変化は、操作時点の競合理由より新しい取得結果を優先する。
        await handleBaselineMutationError(
          refreshError,
          DISPLAY_MESSAGES.wbs.baseline.reloadFailed,
          baselineErrorMessages
        );
        return;
      }
      baselineErrorMessages.value.push(
        DISPLAY_MESSAGES.wbs.baseline.reloadFailed
      );
    }
  };

  /**
   * baseline更新APIの認証・認可・対象なし・競合を共通の画面動作へ変換する。
   *
   * @param error API呼出しで発生した例外
   * @param fallbackMessage 契約済みmessageがない失敗で表示する案内
   * @param messageTarget 案内の表示先。作成Dialog内なら`baselineEditorErrorMessages`、card上なら`baselineErrorMessages`
   */
  const handleBaselineMutationError = async (
    error: unknown,
    fallbackMessage: string,
    messageTarget: Ref<string[]>
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      messageTarget.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      messageTarget.value = [DISPLAY_MESSAGES.wbs.baseline.forbidden];
      return;
    }
    if (error.status === 404) {
      messageTarget.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.baseline.resourceNotFound
      );
      return;
    }
    if (error.status === 409) {
      messageTarget.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.baseline.conflict
      );
      await reloadWbsBaselines();
      return;
    }
    messageTarget.value = resolveWbsErrorMessages(error, fallbackMessage);
  };

  /**
   * 現在計画のTask・依存関係・日別予定工数を新しいbaselineへ保存する。
   * 作成Dialogが開いていない場合、保存中の再実行、権限・入力不正ではAPIを呼ばない。
   *
   * @param form baseline名と説明の未検証入力
   */
  const saveWbsBaseline = async (
    form: Readonly<WbsBaselineCreateForm>
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (
      isCreatingBaseline.value ||
      !isBaselineCreateDialogOpen.value ||
      projectId === null
    ) {
      return;
    }
    if (!canManageBaselines.value) {
      baselineEditorErrorMessages.value = [
        "baselineを作成するにはProjectのOWNERまたはMANAGER権限が必要です。",
      ];
      return;
    }
    const validationMessages = validateWbsBaselineCreateForm(form);
    if (validationMessages.length > 0) {
      baselineEditorErrorMessages.value = validationMessages;
      return;
    }

    isCreatingBaseline.value = true;
    baselineEditorErrorMessages.value = [];
    baselineErrorMessages.value = [];
    baselineSuccessMessage.value = "";
    try {
      const created = await WbsApi.createWbsBaseline(
        projectId,
        buildWbsBaselineCreateRequest(form)
      );
      closeBaselineCreateDialogAfterSaving();
      baselineSuccessMessage.value =
        `baseline「${created.baseline.name}」を作成しました` +
        `（Task ${created.taskCount}件、依存関係 ${created.dependencyCount}件、日別予定 ${created.effortPlanCount}件）。`;
      // EVMはactive baselineへ紐づくため、作成前の集計結果を新しい基準計画として表示し続けない。
      options.onActiveBaselineChanged();
      // baseline作成自体は確定済みのため、再取得失敗を作成失敗として誤表示しない。
      await reloadWbsBaselines();
    } catch (error: unknown) {
      await handleBaselineMutationError(
        error,
        "baselineを作成できませんでした。",
        baselineEditorErrorMessages
      );
    } finally {
      isCreatingBaseline.value = false;
    }
  };

  /**
   * 選択baselineを取得時点versionでactiveへ切り替え、比較対象をBackendの最新Responseへ更新する。
   * すでにactive、baseline操作中、権限不足の場合はAPIを呼ばない。
   *
   * @param baseline 一覧で選択したbaseline。`version`を楽観ロックに使う
   */
  const activateWbsBaseline = async (
    baseline: Readonly<WbsBaselineSummary>
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (baseline.active || isBaselineMutating.value || projectId === null) {
      return;
    }
    baselineErrorMessages.value = [];
    baselineSuccessMessage.value = "";
    if (!canManageBaselines.value) {
      baselineErrorMessages.value = [
        "baselineを有効化するにはProjectのOWNERまたはMANAGER権限が必要です。",
      ];
      return;
    }

    activatingBaselineId.value = baseline.baselineId;
    try {
      const activated = await WbsApi.activateWbsBaseline(
        projectId,
        baseline.baselineId,
        { version: baseline.version }
      );
      baselineSuccessMessage.value = `baseline「${activated.name}」を有効化しました。`;
      // 切替前baselineの指標は意味が変わるため、利用者が新しい基準日で再集計するまで破棄する。
      options.onActiveBaselineChanged();
      // active切替成功後の一覧取得失敗は、切替失敗ではなく再読込案内として扱う。
      await reloadWbsBaselines();
    } catch (error: unknown) {
      await handleBaselineMutationError(
        error,
        "baselineを有効化できませんでした。",
        baselineErrorMessages
      );
    } finally {
      activatingBaselineId.value = null;
    }
  };

  /** 画面の再読込時に、前回操作の結果messageと作成Dialogのエラーを残さない。 */
  const clearBaselineMessages = (): void => {
    baselineEditorErrorMessages.value = [];
    baselineErrorMessages.value = [];
    baselineSuccessMessage.value = "";
  };

  /** 画面全体の取得失敗時に、別Projectや権限喪失前のbaselineを表示し続けない。 */
  const clearBaselines = (): void => {
    baselineList.value = null;
    activeBaselineDetail.value = null;
  };

  return {
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
    discardBaselineDialogs: closeBaselineCreateDialogAfterSaving,
    isBaselineCreateDialogOpen,
    isBaselineMutating,
    isCreatingBaseline,
    loadWbsBaselines,
    openBaselineCreateDialog,
    saveWbsBaseline,
  };
};
