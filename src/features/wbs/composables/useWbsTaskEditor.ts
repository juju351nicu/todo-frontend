import { computed, ref } from "vue";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { WbsTask, WbsTaskEditForm } from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useWbsTaskEditor`が画面全体の操作として受け取るもの。 */
export interface UseWbsTaskEditorOptions {
  /**
   * WBS Task一覧だけをBackendの最新Responseへ取り直す。
   *
   * @throws WbsApiError 取得に失敗した場合
   */
  readonly reloadWbs: () => Promise<void>;
  /** 画面全体の参照APIエラーを、Session動作または画面上部の案内へ変換する。 */
  readonly handleReadApiError: (error: unknown) => Promise<void>;
}

/**
 * WBS画面のTask編集Dialog（親Task、種別、WBSコード、予定期間・工数、進捗、実績期間）を管理する。
 *
 * - 呼び出すAPI: `WbsApi.updateWbsTask`（取得時点version付き）。成功時はResponseのWBS全体で`context.wbs`を差し替える。
 * - 更新にはTASK_UPDATE permissionが必要。階層の循環・計画の整合はBackendが最終判定する。
 * - 409競合ではDialogを閉じ、`reloadWbs`で最新WBSを再取得して再編集を促す。再取得の401・403・404は競合理由より優先する。
 * - 401では`context.handleUnauthorized`へ委ね、Dialogは統括の`useWbsPage`が`discardTaskEditor`で閉じる。
 *
 * @param context Project ID、WBS Task、権限、画面上部message、Session失効処理を提供する画面共通context
 * @param options 競合時のWBS再取得と画面全体の参照エラー処理
 */
export const useWbsTaskEditor = (
  context: WbsPageContext,
  options: UseWbsTaskEditorOptions
) => {
  /** 編集中Taskの取得時点の複製。Dialogを閉じている間はnull。 */
  const editingTask = ref<WbsTask | null>(null);
  const editorErrorMessages = ref<string[]>([]);
  const isEditorOpen = ref(false);
  const isSaving = ref(false);

  /** 親にできるSummary Taskの候補。編集中Task自身と子孫を除き、親子関係の循環を選ばせない。 */
  const parentOptions = computed(() =>
    editingTask.value === null
      ? []
      : buildWbsParentOptions(
          context.wbs.value?.tasks ?? [],
          editingTask.value.taskId
        )
  );

  /**
   * TASK_UPDATEを持つ利用者だけに、取得済みTaskの編集Dialogを開く。
   *
   * @param taskId 階層表で選択したTask ID
   */
  const openTaskEditor = (taskId: number): void => {
    context.errorMessages.value = [];
    context.successMessage.value = "";
    if (!context.canEditWbs.value) {
      context.errorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const task = context.wbs.value?.tasks.find(
      (candidate) => candidate.taskId === taskId
    );
    if (task === undefined) {
      context.errorMessages.value = ["編集対象のTaskが見つかりません。"];
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

  /**
   * 更新成功・競合・Session失効時に、保存中でも古いversionを破棄する。
   * Session失効時は統括の`useWbsPage`が`discardTaskEditor`として呼ぶ。
   */
  const closeTaskEditorAfterSaving = (): void => {
    isEditorOpen.value = false;
    editingTask.value = null;
    editorErrorMessages.value = [];
  };

  /**
   * 検証済みフォームをWBS更新APIへ送り、成功時はResponse全体で画面を更新する。
   * 409競合では古いDialogを閉じ、最新WBSを再取得して再編集を促す。
   *
   * @param form WBS Task編集Dialogの入力値と取得時点version
   */
  const saveWbsTask = async (form: WbsTaskEditForm): Promise<void> => {
    const currentTask = editingTask.value;
    const projectId = context.projectId.value;
    if (isSaving.value || currentTask === null || projectId === null) {
      return;
    }
    if (!context.canEditWbs.value) {
      editorErrorMessages.value = ["WBSを更新するpermissionがありません。"];
      return;
    }
    const validationMessages = validateWbsTaskEditForm(form);
    if (validationMessages.length > 0) {
      editorErrorMessages.value = validationMessages;
      return;
    }

    isSaving.value = true;
    context.errorMessages.value = [];
    editorErrorMessages.value = [];
    context.successMessage.value = "";
    try {
      context.wbs.value = await WbsApi.updateWbsTask(
        projectId,
        currentTask.taskId,
        buildWbsTaskUpdateRequest(form)
      );
      closeTaskEditorAfterSaving();
      context.successMessage.value = "WBS Taskを更新しました。";
    } catch (error: unknown) {
      if (error instanceof WbsApiError && error.status === 409) {
        closeTaskEditorAfterSaving();
        context.errorMessages.value = resolveWbsErrorMessages(
          error,
          DISPLAY_MESSAGES.wbs.conflict
        );
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
      await options.reloadWbs();
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // 認証・認可・公開範囲の変化は、操作時点の競合理由より新しい取得結果を優先する。
        await options.handleReadApiError(refreshError);
        return;
      }
      context.errorMessages.value.push(DISPLAY_MESSAGES.wbs.reloadFailed);
    }
  };

  /** WBS更新APIのstatusと項目エラーを、DialogまたはSession動作へ変換する。 */
  const handleUpdateApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.wbs.updateForbidden];
      return;
    }
    if (error.status === 404) {
      editorErrorMessages.value = [DISPLAY_MESSAGES.wbs.taskNotFound];
      return;
    }
    editorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.updateFailed
    );
  };

  return {
    closeTaskEditor,
    discardTaskEditor: closeTaskEditorAfterSaving,
    editingTask,
    editorErrorMessages,
    isEditorOpen,
    isSaving,
    openTaskEditor,
    parentOptions,
    saveWbsTask,
  };
};
