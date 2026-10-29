import { computed, ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import { isActiveProject } from "@/features/project/utils/projectStatus";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { WbsTask, WbsTaskEditForm } from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  resolveWbsStandardErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildWbsParentOptions,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { hasApiFieldError } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * WBS Task編集Dialogの部品に付ける`data-wbs-task-editor-control`属性の値。
 * 保存中は「保存」がdisabledになりフォーカスがbodyへ外れるため、Dialogを開いたまま失敗を表示する場合はここへ戻す。
 */
export const WBS_TASK_EDITOR_CONTROL = {
  /** Dialog下部の「保存」ボタン。 */
  save: "save",
} as const;

/** `data-wbs-task-editor-control`属性の値から、その要素を探すselectorを作る。 */
const buildWbsTaskEditorControlSelector = createDataAttributeSelector("data-wbs-task-editor-control");

/**
 * Backendの文言が「WBSを再読み込みしてください。」で終わる409のerror code
 * （`messages.properties`の`error.wbs.conflict.task-version`）。
 * 画面は409の後に必ずWBSを取り直すため、このときだけ取り直し済みの案内を添える。
 * archive済みProject・Taskの409は取り直しても編集できないので添えない。
 */
const RELOAD_GUIDANCE_ERROR_CODE = "TASK_VERSION_CONFLICT";

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
 * - 編集の入口（`canEditTask`）は、Backendが保存を許す行だけに出す。利用中のProjectで、SYSTEM_ADMIN・OWNER・MANAGERは
 *   全Task、MEMBERは自分が担当するTaskだけ（`todo-backend`の`docs/wbs-core-design.md`「2. 階層・予定の編集」）。
 *   入力してから403・409で断られないよう、保存できない行には入口を出さない。
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
  const userStore = useUserStore();

  /**
   * そのTaskのWBS情報を保存できるか。Backendの判定（TASK_UPDATE、利用中のProject、Project管理者または担当者本人）と同じ条件で、
   * 押しても必ず失敗する編集の入口を出さないために使う。最終判定はBackendが行う。
   *
   * @param task 判定するTask（担当アカウントIDだけを使う）
   * @returns 保存できる場合はtrue
   */
  const canEditTask = (task: Readonly<Pick<WbsTask, "assigneeAccountId">>): boolean =>
    context.canEditWbs.value &&
    isActiveProject(context.project.value) &&
    (context.canManageProject.value || task.assigneeAccountId === userStore.accountId);

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
   * 保存できるTask（`canEditTask`）だけ、取得済みTaskの編集Dialogを開く。保存できない場合は理由を画面上部に出す。
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
    if (!canEditTask(task)) {
      context.errorMessages.value = [
        isActiveProject(context.project.value)
          ? "担当していないTaskのWBS情報は編集できません。"
          : "archive済みのProjectのTaskは編集できません。",
      ];
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
    // 409以外の失敗でDialogを開いたままにした場合だけ、保存後に「保存」へフォーカスを戻す。
    let shouldRestoreSaveFocus = false;
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
        await reloadWbsAfterConflict(error);
      } else {
        await handleUpdateApiError(error);
        shouldRestoreSaveFocus = isEditorOpen.value;
      }
    } finally {
      isSaving.value = false;
    }
    if (shouldRestoreSaveFocus) {
      // disabledが解除されたDOMへ反映された後に戻す（`focusFirstEnabledElement`がnextTickを待つ）。
      await focusFirstEnabledElement([
        buildWbsTaskEditorControlSelector(WBS_TASK_EDITOR_CONTROL.save),
      ]);
    }
  };

  /**
   * 409競合後に最新WBSを取得し、古い親関係とversionを画面へ残さない。
   * version競合（`RELOAD_GUIDANCE_ERROR_CODE`）で取り直せたときは、Backendの「WBSを再読み込みしてください。」の後ろに、
   * 画面側で取り直し済みであることの案内を添える（Project設定・Project Templateの409と同じ書き方）。
   *
   * @param conflict 更新APIが返した409
   */
  const reloadWbsAfterConflict = async (conflict: WbsApiError): Promise<void> => {
    try {
      await options.reloadWbs();
      if (hasApiFieldError(conflict.errorResponse, RELOAD_GUIDANCE_ERROR_CODE)) {
        context.errorMessages.value = [
          ...context.errorMessages.value,
          DISPLAY_MESSAGES.wbs.conflictReloaded,
        ];
      }
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

  /** WBS更新APIの失敗（409以外）を、Dialogの案内またはSession失効処理へ変換する。409は呼出側で競合回復する。 */
  const handleUpdateApiError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.updateForbidden,
      notFound: DISPLAY_MESSAGES.wbs.taskNotFound,
      failed: DISPLAY_MESSAGES.wbs.updateFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    editorErrorMessages.value = result.messages;
  };

  return {
    canEditTask,
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
