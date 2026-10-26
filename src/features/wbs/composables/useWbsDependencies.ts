import { computed, ref } from "vue";
import type { Ref } from "vue";

import { ProjectApiError } from "@/features/project/api/projectApi";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  TaskDependency,
  TaskDependencyCreateForm,
  TaskDependencyListResponse,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildDependencyRows,
  buildDependencyTaskOptions,
  buildTaskDependencyCreateRequest,
} from "@/features/wbs/utils/taskDependency";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** `useWbsDependencies`が画面全体の状態・操作として受け取るもの。 */
export interface UseWbsDependenciesOptions {
  /**
   * 依存関係一覧の正本。Project・WBS Taskと同じ画面スナップショットとして`useWbsPage`が取得し、
   * このcomposableは作成・削除の確定後だけ更新する。
   */
  readonly dependencyList: Ref<TaskDependencyListResponse | null>;
  /**
   * Project・WBS Task・依存関係・baselineを同じスナップショットとして取り直す。
   * 依存関係の競合は端点Taskの変更・削除が原因のこともあるため、依存関係だけでなく画面全体を再取得する。
   *
   * @throws WbsApiError | ProjectApiError いずれかの取得に失敗した場合
   */
  readonly reloadPageSnapshot: () => Promise<void>;
  /** 画面全体の参照APIエラーを、Session動作または画面上部の案内へ変換する。 */
  readonly handleReadApiError: (error: unknown) => Promise<void>;
}

/**
 * WBS画面のTask依存関係（Finish-to-Start）の一覧表示・追加・削除を管理する。
 *
 * - 呼び出すAPI: `WbsApi.createTaskDependency`（作成後の一覧Responseで差し替え）、
 *   `WbsApi.deleteTaskDependency`（取得時点version付き、204確定後に一覧から除外）。
 * - 更新にはTASK_UPDATE permissionが必要。循環・Project状態・最新Task状態はBackendが最終判定する。
 * - 作成の409、削除の404・409ではDialogを閉じ、`reloadPageSnapshot`で画面全体を取り直す。
 *   再取得の401・403・404は操作時点の競合理由より優先する。
 * - Dialog外の操作結果は画面上部の`context.errorMessages`・`context.successMessage`へ表示する。
 *
 * @param context Project ID、階層表の行、権限、画面上部message、Session失効処理を提供する画面共通context
 * @param options 依存関係一覧の正本と、競合時の画面全体再取得
 */
export const useWbsDependencies = (
  context: WbsPageContext,
  options: UseWbsDependenciesOptions
) => {
  const { dependencyList } = options;
  const dependencyEditorErrorMessages = ref<string[]>([]);
  /** 削除確認中の依存関係と取得時点version。確認Dialogの開閉もこの値の有無で決まる。 */
  const dependencyPendingDelete = ref<TaskDependency | null>(null);
  const isDeletingDependency = ref(false);
  const isDependencyEditorOpen = ref(false);
  const isSavingDependency = ref(false);

  const dependencies = computed(() => dependencyList.value?.dependencies ?? []);
  const dependencyTaskOptions = computed(() =>
    buildDependencyTaskOptions(context.rows.value)
  );
  const dependencyRows = computed(() =>
    buildDependencyRows(dependencies.value, dependencyTaskOptions.value)
  );
  /** 削除確認Dialogへ表示する、表示名付きの削除対象行。確認中でなければnull。 */
  const dependencyPendingDeleteRow = computed(() => {
    const pendingId = dependencyPendingDelete.value?.dependencyId;
    return pendingId === undefined
      ? null
      : dependencyRows.value.find((row) => row.dependencyId === pendingId) ??
          null;
  });
  const isDependencyMutating = computed(
    () => isSavingDependency.value || isDeletingDependency.value
  );

  /** TASK_UPDATEを持ち、依存関係の両端候補が2件以上ある場合だけ追加Dialogを開く。 */
  const openDependencyEditor = (): void => {
    context.errorMessages.value = [];
    context.successMessage.value = "";
    if (!context.canEditWbs.value) {
      context.errorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }
    if (dependencyTaskOptions.value.length < 2) {
      context.errorMessages.value = [
        "依存関係を追加するにはTaskが2件以上必要です。",
      ];
      return;
    }
    dependencyEditorErrorMessages.value = [];
    isDependencyEditorOpen.value = true;
  };

  /** 依存関係の保存中でなければ未確定入力を破棄して追加Dialogを閉じる。 */
  const closeDependencyEditor = (): void => {
    if (!isSavingDependency.value) {
      closeDependencyEditorAfterSaving();
    }
  };

  /** 作成成功・競合・Session失効時に保存中でも古い入力を破棄する。 */
  const closeDependencyEditorAfterSaving = (): void => {
    isDependencyEditorOpen.value = false;
    dependencyEditorErrorMessages.value = [];
  };

  /**
   * 検証済みFinish-to-Start依存関係を追加し、成功時はBackendの一覧Responseで差し替える。
   * 409競合ではDialogを閉じ、WBS Taskと依存関係の両方を再取得する。
   *
   * @param form 先行Task、後続Task、分単位待ち時間
   */
  const saveDependency = async (
    form: TaskDependencyCreateForm
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (isSavingDependency.value || projectId === null) {
      return;
    }
    if (!context.canEditWbs.value) {
      dependencyEditorErrorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }
    const built = buildTaskDependencyCreateRequest(
      form,
      new Set(dependencyTaskOptions.value.map((option) => option.value)),
      dependencies.value
    );
    if (built.request === null) {
      dependencyEditorErrorMessages.value = built.messages;
      return;
    }

    isSavingDependency.value = true;
    dependencyEditorErrorMessages.value = [];
    context.errorMessages.value = [];
    context.successMessage.value = "";
    try {
      dependencyList.value = await WbsApi.createTaskDependency(
        projectId,
        built.request
      );
      closeDependencyEditorAfterSaving();
      context.successMessage.value = "Task依存関係を追加しました。";
    } catch (error: unknown) {
      await handleDependencyCreateError(error);
    } finally {
      isSavingDependency.value = false;
    }
  };

  /** Task依存関係作成APIのstatusをDialog、競合再読込またはSession動作へ変換する。 */
  const handleDependencyCreateError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      dependencyEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      dependencyEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.dependency.forbidden,
      ];
      return;
    }
    if (error.status === 404) {
      dependencyEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.dependency.resourceNotFound,
      ];
      return;
    }
    if (error.status === 409) {
      closeDependencyEditorAfterSaving();
      context.errorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.dependency.createConflict
      );
      await reloadPageAfterDependencyConflict();
      return;
    }
    dependencyEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.dependency.createFailed
    );
  };

  /**
   * 削除対象とversionを現在の一覧から確定して確認Dialogを開く。
   *
   * @param dependencyId 一覧で選択した依存関係ID
   */
  const requestDependencyDelete = (dependencyId: number): void => {
    context.errorMessages.value = [];
    context.successMessage.value = "";
    if (!context.canEditWbs.value) {
      context.errorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }
    const dependency = dependencies.value.find(
      (candidate) => candidate.dependencyId === dependencyId
    );
    if (dependency === undefined) {
      context.errorMessages.value = ["削除対象のTask依存関係が見つかりません。"];
      return;
    }
    dependencyPendingDelete.value = { ...dependency };
  };

  /** 削除中でなければ確認対象を破棄して削除Dialogを閉じる。 */
  const cancelDependencyDelete = (): void => {
    if (!isDeletingDependency.value) {
      dependencyPendingDelete.value = null;
    }
  };

  /** 一覧取得時点versionで依存関係を削除し、204確定後に画面一覧から除外する。 */
  const confirmDependencyDelete = async (): Promise<void> => {
    const dependency = dependencyPendingDelete.value;
    const projectId = context.projectId.value;
    if (
      dependency === null ||
      projectId === null ||
      isDeletingDependency.value
    ) {
      return;
    }
    if (!context.canEditWbs.value) {
      context.errorMessages.value = [
        "Task依存関係を更新するpermissionがありません。",
      ];
      return;
    }

    isDeletingDependency.value = true;
    context.errorMessages.value = [];
    context.successMessage.value = "";
    try {
      await WbsApi.deleteTaskDependency(
        projectId,
        dependency.dependencyId,
        dependency.version
      );
      if (dependencyList.value !== null) {
        dependencyList.value = {
          ...dependencyList.value,
          dependencies: dependencyList.value.dependencies.filter(
            (candidate) => candidate.dependencyId !== dependency.dependencyId
          ),
        };
      }
      dependencyPendingDelete.value = null;
      context.successMessage.value = "Task依存関係を削除しました。";
    } catch (error: unknown) {
      await handleDependencyDeleteError(error);
    } finally {
      isDeletingDependency.value = false;
    }
  };

  /** Task依存関係削除APIのstatusを競合再読込、認可案内またはSession動作へ変換する。 */
  const handleDependencyDeleteError = async (error: unknown): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      context.errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      context.errorMessages.value = [DISPLAY_MESSAGES.wbs.dependency.forbidden];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      dependencyPendingDelete.value = null;
      context.errorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.dependency.stale
      );
      await reloadPageAfterDependencyConflict();
      return;
    }
    context.errorMessages.value = [DISPLAY_MESSAGES.wbs.dependency.deleteFailed];
  };

  /** 依存関係競合後にWBS Taskと依存関係を再取得し、古い端点とversionを残さない。 */
  const reloadPageAfterDependencyConflict = async (): Promise<void> => {
    try {
      await options.reloadPageSnapshot();
    } catch (refreshError: unknown) {
      if (
        (refreshError instanceof WbsApiError ||
          refreshError instanceof ProjectApiError) &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // 認証・認可・公開範囲の変化は、操作時点の競合理由より新しい取得結果を優先する。
        await options.handleReadApiError(refreshError);
        return;
      }
      context.errorMessages.value.push(
        DISPLAY_MESSAGES.wbs.dependency.reloadFailed
      );
    }
  };

  /**
   * 追加Dialogと削除確認を処理中状態に依存せず閉じ、古い入力とversionを残さない。
   * Session失効時に統括の`useWbsPage`から呼ばれる。
   */
  const discardDependencyDialogs = (): void => {
    closeDependencyEditorAfterSaving();
    dependencyPendingDelete.value = null;
  };

  /**
   * 削除確認dialogが閉じられた場合だけ未確定の削除対象を破棄する。
   * 確認dialogの開閉は削除対象の有無で決まるため、閉じる操作をここで削除対象の破棄へ変換する。
   *
   * @param open dialogの新しい開閉状態
   */
  const handleDependencyDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelDependencyDelete();
    }
  };

  return {
    cancelDependencyDelete,
    closeDependencyEditor,
    confirmDependencyDelete,
    dependencies,
    dependencyEditorErrorMessages,
    dependencyPendingDelete,
    dependencyPendingDeleteRow,
    dependencyRows,
    dependencyTaskOptions,
    discardDependencyDialogs,
    handleDependencyDeleteDialogVisibility,
    isDeletingDependency,
    isDependencyEditorOpen,
    isDependencyMutating,
    isSavingDependency,
    openDependencyEditor,
    requestDependencyDelete,
    saveDependency,
  };
};
