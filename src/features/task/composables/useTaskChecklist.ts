import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import TaskChecklistApi, {
  TaskChecklistApiError,
} from "@/features/task/api/taskChecklistApi";
import type { TaskChecklistItem } from "@/features/task/types/taskChecklist";
import {
  TASK_CHECKLIST_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { focusFirstEnabledElement } from "@/shared/utils/focus";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";

/** チェック項目本文の最大文字数（trim後）。Backendの入力制約と同じ値。 */
export const CHECKLIST_ITEM_MAX_LENGTH = 255;

/** 1 Taskに登録できるチェック項目の最大件数。Backendの入力制約と同じ値。 */
export const CHECKLIST_ITEM_MAX_COUNT = 50;

/**
 * 操作後にフォーカスを戻すチェック項目の部品。
 * `toggle`は完了状態のcheckbox、`move-up`・`move-down`は上下移動のボタン、`edit`は編集ボタン。
 */
export type ChecklistControl = "toggle" | "move-up" | "move-down" | "edit";

/**
 * 部品に付ける`data-checklist-control`属性の値を組み立てる。
 * `TaskChecklistPanel.vue`はこの値で属性を付け、`useTaskChecklist`は同じ値で部品を探してフォーカスを戻す。
 *
 * @param itemId checklist item ID
 * @param control 部品の種類
 * @returns `"{itemId}:{control}"`形式の属性値
 */
export const checklistControlKey = (
  itemId: number,
  control: ChecklistControl
): string => `${itemId}:${control}`;

/**
 * trim後1文字以上、最大文字数以下のチェック項目本文か。
 * `String.prototype.trim`は全角空白も除くため、全角空白だけの本文も無効として扱う
 * （Backendの`@NotBlank`も全角空白だけの本文を400にする）。
 */
const isValidChecklistContent = (content: string): boolean => {
  const trimmedContent = content.trim();
  return trimmedContent.length > 0 && trimmedContent.length <= CHECKLIST_ITEM_MAX_LENGTH;
};

/** 更新系APIへ渡すProject IDとTask ID。 */
interface ChecklistMutationTarget {
  projectId: number;
  taskId: number;
}

/**
 * Task詳細（Board画面のTask Dialog）内のチェックリストの取得・追加・更新・並び替え・削除を扱う。
 *
 * - 初期化と再読込: `projectId`・`taskId`が変わるたびに編集中・削除確認中の状態と追加欄を捨て、一覧を取り直す。
 * - 参照のみ: `disabled`がtrueの間は更新系APIを呼ばない（BackendはMEMBERに担当Taskだけを許可する。
 *   `todo-backend`の`TaskResourceAuthorizationLogic#checkCanManageChecklist`）。
 * - 401: 一覧と操作中の状態を捨て、Sessionを破棄してLoginへ遷移する。
 * - 403: 権限不足の文言を出す。参照で403・404になった場合は一覧を空にする。
 * - 404／409: 取得時点のversionを捨て、Backendの最新一覧へ置き換えてから、
 *   Backendの文言と再取得済みの案内を出す。
 * - 完了状態の切替・上下移動・編集の後は、操作した項目の部品へフォーカスを戻す（`data-checklist-control`属性）。
 *
 * @param projectId 対象ProjectのID。nullの間は一覧を空にしてAPIを呼ばない
 * @param taskId 対象TaskのID。nullの間は一覧を空にしてAPIを呼ばない
 * @param disabled 参照のみ（権限がない、archive済みProject等）のときtrue
 * @returns 一覧・入力欄・処理中フラグ・表示文言のref／computedと、各操作の関数
 */
export const useTaskChecklist = (
  projectId: Readonly<Ref<number | null>>,
  taskId: Readonly<Ref<number | null>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const { expireSession } = useSessionExpiry();

  /** Backendのposition順のチェック項目。更新APIの確定Responseで置き換える。 */
  const items = ref<TaskChecklistItem[]>([]);
  /** 追加欄の入力値（trim前）。 */
  const newContent = ref("");
  /** 本文を編集中の項目ID。編集していないときはnull。 */
  const editingItemId = ref<number | null>(null);
  /** 編集欄の入力値（trim前）。 */
  const editContent = ref("");
  /** 削除確認Dialogで確認中の項目。確認していないときはnull。 */
  const deletingItem = ref<TaskChecklistItem | null>(null);
  /** パネル内に赤で出す文言（複数行）。 */
  const errorMessages = ref<string[]>([]);
  /** パネル内に緑で出す文言。出さないときは空文字。 */
  const successMessage = ref("");
  const isLoading = ref(false);
  /**
   * checklist一覧の読込の順番。Task詳細Dialogを開いたまま別のTaskへ切り替えたとき、
   * 前のTaskの一覧が後から届いて今のTaskの一覧を上書きしないよう、最後に始めた読込だけを反映する。
   */
  const listRequests = createLatestRequestTracker();
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const isReordering = ref(false);
  /** いずれかの更新系APIを実行中か。実行中は全項目の操作部品をdisabledにして二重送信を防ぐ。 */
  const isMutating = computed(
    () =>
      isCreating.value ||
      isUpdating.value ||
      isDeleting.value ||
      isReordering.value
  );
  const completedCount = computed(
    () => items.value.filter((item) => item.completed).length
  );
  /** 追加欄の本文が有効で、上限件数未満、参照のみでなく、他の更新中でない場合だけ追加できる。 */
  const canAdd = computed(
    () =>
      !disabled.value &&
      !isMutating.value &&
      items.value.length < CHECKLIST_ITEM_MAX_COUNT &&
      isValidChecklistContent(newContent.value)
  );
  /** 完了済み項目の割合（0～100の整数）。項目がない場合は0。 */
  const progressPercent = computed<number>(() =>
    items.value.length === 0 ? 0 : Math.round((completedCount.value / items.value.length) * 100)
  );
  /** 編集中の本文が有効で、他の更新中でない場合だけ保存できる。 */
  const canSaveEdit = computed<boolean>(() => isValidChecklistContent(editContent.value) && !isMutating.value);

  /** 前回の操作結果の文言を消す。新しい操作・取得を始めるときに呼ぶ。 */
  const clearFeedback = (): void => {
    errorMessages.value = [];
    successMessage.value = "";
  };

  /**
   * 更新系APIを今呼んでよいときだけ、送り先のProject IDとTask IDを返す。
   *
   * @returns 参照のみ・他の更新中・ID未確定のいずれかならnull
   */
  const resolveMutationTarget = (): ChecklistMutationTarget | null => {
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return null;
    }
    return { projectId: projectId.value, taskId: taskId.value };
  };

  /**
   * API statusと契約済みerror codeを利用者向けメッセージへ変換する。
   *
   * @param error APIまたは通信で発生した例外
   * @param fallback 契約外のerror codeや本文なしのときに出す文言
   * @param forbidden 403のときに出す文言（参照と更新で文言が違う）
   * @returns パネルに出す文言。通信失敗は接続失敗の文言1件
   */
  const getErrorMessages = (
    error: unknown,
    fallback: string,
    forbidden: string = DISPLAY_MESSAGES.task.checklist.operationForbidden
  ): string[] => {
    if (!(error instanceof TaskChecklistApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.checklist.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      TASK_CHECKLIST_ERROR_CODES,
      fallback
    );
  };

  /** 編集・削除対象を破棄し、古いversionを再利用できない状態へ戻す。 */
  const clearMutationDrafts = (): void => {
    editingItemId.value = null;
    editContent.value = "";
    deletingItem.value = null;
  };

  /**
   * 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。
   *
   * @param error APIまたは通信で発生した例外
   * @returns 401を処理した（呼出側は以降の表示更新をしない）ときtrue
   */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskChecklistApiError) || error.status !== 401) {
      return false;
    }
    items.value = [];
    clearMutationDrafts();
    clearFeedback();
    await expireSession();
    return true;
  };

  /**
   * Task IDが有効なときだけchecklistを取得する。
   *
   * @returns 取得できたときtrue。IDが未確定・取得失敗のときfalse
   */
  const loadItems = async (): Promise<boolean> => {
    if (projectId.value === null || taskId.value === null) {
      items.value = [];
      return false;
    }
    const isLatestRequest = listRequests.begin();
    isLoading.value = true;
    clearFeedback();
    try {
      const loadedItems = await TaskChecklistApi.findItems(
        projectId.value,
        taskId.value
      );
      if (!isLatestRequest()) {
        return false;
      }
      items.value = loadedItems;
      return true;
    } catch (error: unknown) {
      if (!isLatestRequest()) {
        return false;
      }
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskChecklistApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          items.value = [];
          clearMutationDrafts();
        }
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.checklist.loadFailed,
          DISPLAY_MESSAGES.task.checklist.readForbidden
        );
      }
      return false;
    } finally {
      if (isLatestRequest()) {
        isLoading.value = false;
      }
    }
  };

  /**
   * 404／409後に操作対象を破棄し、最新一覧へ置き換える。
   * 再取得に成功したら、Backendの文言（「最新状態を取得してください」等）の後ろに再取得済みの案内を添える。
   * 画面はすでに最新一覧を表示しているので、利用者が手動で再読込しなくてよいと分かるようにするため。
   * 再取得自体が401・403・404等になった場合は、古い競合の文言よりそちらを優先して出す。
   *
   * @param error 更新系APIが返した404または409
   * @param fallback Backendの文言を出せないときの代わりの文言
   */
  const recoverLatestItems = async (
    error: TaskChecklistApiError,
    fallback: string
  ): Promise<void> => {
    const currentProjectId = projectId.value;
    const currentTaskId = taskId.value;
    if (currentProjectId === null || currentTaskId === null) {
      items.value = [];
      clearMutationDrafts();
      return;
    }
    const mutationMessages = getErrorMessages(error, fallback);
    clearMutationDrafts();
    const isLatestRequest = listRequests.begin();
    isLoading.value = true;
    clearFeedback();
    try {
      const loadedItems = await TaskChecklistApi.findItems(
        currentProjectId,
        currentTaskId
      );
      if (!isLatestRequest()) {
        return;
      }
      items.value = loadedItems;
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.checklist.conflictReloaded,
      ];
    } catch (reloadError: unknown) {
      if (!isLatestRequest() || (await handleUnauthorized(reloadError))) {
        return;
      }
      if (
        reloadError instanceof TaskChecklistApiError &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
      ) {
        if (reloadError.status === 403 || reloadError.status === 404) {
          items.value = [];
        }
        errorMessages.value = getErrorMessages(
          reloadError,
          DISPLAY_MESSAGES.task.checklist.reloadFailed,
          DISPLAY_MESSAGES.task.checklist.readForbidden
        );
        return;
      }
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.checklist.reloadFailed,
      ];
    } finally {
      if (isLatestRequest()) {
        isLoading.value = false;
      }
    }
  };

  /**
   * 更新系APIの失敗を共通処理する。401はLoginへ、404／409は最新一覧へ回復し、それ以外は文言を出す。
   *
   * @param error 更新系APIまたは通信で発生した例外
   * @param fallback 契約外のerror codeや本文なしのときに出す文言
   */
  const handleMutationError = async (
    error: unknown,
    fallback: string
  ): Promise<void> => {
    if (await handleUnauthorized(error)) return;
    if (
      error instanceof TaskChecklistApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      await recoverLatestItems(
        error,
        DISPLAY_MESSAGES.task.checklist.conflictFallback
      );
      return;
    }
    errorMessages.value = getErrorMessages(error, fallback);
  };

  /**
   * 完了状態の切替・上下移動・編集の後（失敗した場合も含む）、操作した項目の部品へフォーカスを戻す。
   * 更新中は全項目の部品をdisabledにするためフォーカスが外れ、キーボードだけでは続けて操作できなくなるため。
   * 一覧の再描画で別の要素になるので`data-checklist-control`属性で探し直し、disabledの部品は飛ばす
   * （`focusFirstEnabledElement`）。isUpdating等をfalseへ戻した後に呼ぶ。
   *
   * @param itemId 操作したchecklist item ID
   * @param candidates フォーカスを戻す部品の候補（優先順）
   */
  const restoreControlFocus = (
    itemId: number,
    candidates: readonly ChecklistControl[]
  ): Promise<void> =>
    focusFirstEnabledElement(
      candidates.map(
        (control) =>
          `[data-checklist-control="${checklistControlKey(itemId, control)}"]`
      )
    );

  /** Backend確定Responseで対象itemを置き換える。 */
  const replaceItem = (updated: TaskChecklistItem): void => {
    items.value = items.value.map((item) =>
      item.checklistItemId === updated.checklistItemId ? updated : item
    );
  };

  /** 入力本文をtrimしてTask末尾へchecklist itemを追加し、成功したら追加欄を空にする。 */
  const addItem = async (): Promise<void> => {
    const target = resolveMutationTarget();
    if (!canAdd.value || target === null) {
      return;
    }
    isCreating.value = true;
    clearFeedback();
    try {
      items.value.push(
        await TaskChecklistApi.createItem(target.projectId, target.taskId, {
          content: newContent.value.trim(),
        })
      );
      newContent.value = "";
      successMessage.value = DISPLAY_MESSAGES.task.checklist.created;
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.createFailed
      );
    } finally {
      isCreating.value = false;
    }
  };

  /** checklist itemの本文編集を開始する。削除確認中なら閉じる。 */
  const startEditing = (item: TaskChecklistItem): void => {
    if (disabled.value || isMutating.value) return;
    deletingItem.value = null;
    editingItemId.value = item.checklistItemId;
    editContent.value = item.content;
    clearFeedback();
  };

  /** 未送信の本文編集を破棄する（フォーカスは動かさない）。 */
  const cancelEditing = (): void => {
    editingItemId.value = null;
    editContent.value = "";
  };

  /**
   * 利用者の操作（「取消」・Escキー）で本文編集をやめ、その項目の編集ボタンへフォーカスを戻す。
   * 編集欄は閉じると消えるため、戻さないとフォーカスがDialogの先頭へ外れる。
   */
  const discardEditing = async (): Promise<void> => {
    const itemId = editingItemId.value;
    cancelEditing();
    if (itemId !== null) {
      await restoreControlFocus(itemId, ["edit"]);
    }
  };

  /**
   * 取得時点versionを使用して本文を更新する。完了状態は変えない。
   * Enterキーからも呼ばれるため、保存ボタンのdisabledとは別に本文の長さを確かめる。
   */
  const saveEdit = async (): Promise<void> => {
    const target = resolveMutationTarget();
    if (target === null || editingItemId.value === null) {
      return;
    }
    const item = items.value.find(
      (candidate) => candidate.checklistItemId === editingItemId.value
    );
    const content = editContent.value.trim();
    if (!item || !content || content.length > CHECKLIST_ITEM_MAX_LENGTH) {
      errorMessages.value = [DISPLAY_MESSAGES.task.checklist.contentInvalid];
      return;
    }
    isUpdating.value = true;
    clearFeedback();
    try {
      replaceItem(
        await TaskChecklistApi.updateItem(
          target.projectId,
          target.taskId,
          item.checklistItemId,
          { content, completed: item.completed, version: item.version }
        )
      );
      cancelEditing();
      successMessage.value = DISPLAY_MESSAGES.task.checklist.updated;
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.updateFailed
      );
    } finally {
      isUpdating.value = false;
    }
    // 保存に失敗して編集欄が残っている場合は、編集欄のフォーカスを奪わない。
    if (editingItemId.value === null) {
      await restoreControlFocus(item.checklistItemId, ["edit"]);
    }
  };

  /** 取得時点versionを使用して完了状態を反転する。本文は変えない。 */
  const toggleItem = async (item: TaskChecklistItem): Promise<void> => {
    const target = resolveMutationTarget();
    if (target === null) {
      return;
    }
    isUpdating.value = true;
    clearFeedback();
    try {
      replaceItem(
        await TaskChecklistApi.updateItem(
          target.projectId,
          target.taskId,
          item.checklistItemId,
          {
            content: item.content,
            completed: !item.completed,
            version: item.version,
          }
        )
      );
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.toggleFailed
      );
    } finally {
      isUpdating.value = false;
    }
    await restoreControlFocus(item.checklistItemId, ["toggle"]);
  };

  /**
   * itemを上下へ1件移動する。Backendは全itemのID・versionを要求するため、入れ替え後の全件を送る。
   * 先頭で上、末尾で下を指定した場合はAPIを呼ばない。
   *
   * @param item 動かす項目
   * @param direction -1で上、1で下
   */
  const moveItem = async (
    item: TaskChecklistItem,
    direction: -1 | 1
  ): Promise<void> => {
    const target = resolveMutationTarget();
    if (target === null) {
      return;
    }
    const index = items.value.findIndex(
      (candidate) => candidate.checklistItemId === item.checklistItemId
    );
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= items.value.length) {
      return;
    }
    const reordered = [...items.value];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    isReordering.value = true;
    clearFeedback();
    try {
      items.value = await TaskChecklistApi.reorderItems(
        target.projectId,
        target.taskId,
        {
          items: reordered.map((candidate) => ({
            checklistItemId: candidate.checklistItemId,
            version: candidate.version,
          })),
        }
      );
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.reorderFailed
      );
    } finally {
      isReordering.value = false;
    }
    // 先頭・末尾へ動かすと同じ向きのボタンはdisabledになるため、そのときは逆向きのボタンへ戻す。
    await restoreControlFocus(
      item.checklistItemId,
      direction === -1 ? ["move-up", "move-down"] : ["move-down", "move-up"]
    );
  };

  /** 削除確認Dialogを開く。本文の編集中なら編集を捨てる。 */
  const openDeleteConfirm = (item: TaskChecklistItem): void => {
    if (disabled.value || isMutating.value) return;
    cancelEditing();
    deletingItem.value = item;
  };

  /** 削除確認を閉じる。 */
  const cancelDelete = (): void => {
    deletingItem.value = null;
  };

  /** 削除確認Dialogが閉じられた（Esc・外側クリック等）場合に削除対象を破棄する。 */
  const handleDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelDelete();
    }
  };

  /** 確認対象を取得時点version付きで削除し、204のときだけ一覧から外す。 */
  const confirmDelete = async (): Promise<void> => {
    const item = deletingItem.value;
    const target = resolveMutationTarget();
    if (!item || target === null) {
      return;
    }
    isDeleting.value = true;
    clearFeedback();
    try {
      await TaskChecklistApi.deleteItem(
        target.projectId,
        target.taskId,
        item.checklistItemId,
        item.version
      );
      items.value = items.value.filter(
        (candidate) => candidate.checklistItemId !== item.checklistItemId
      );
      cancelDelete();
      successMessage.value = DISPLAY_MESSAGES.task.checklist.deleted;
    } catch (error: unknown) {
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.task.checklist.deleteFailed
      );
    } finally {
      isDeleting.value = false;
    }
  };

  // 別のTaskを開いたときに前のTaskの編集・削除対象（古いversion）を送らないよう、取り直す前に捨てる。
  watch(
    [projectId, taskId],
    () => {
      clearMutationDrafts();
      newContent.value = "";
      void loadItems();
    },
    { immediate: true }
  );

  return {
    addItem,
    canAdd,
    canSaveEdit,
    cancelDelete,
    cancelEditing,
    completedCount,
    confirmDelete,
    deletingItem,
    discardEditing,
    editContent,
    editingItemId,
    errorMessages,
    handleDeleteDialogVisibility,
    isCreating,
    isDeleting,
    isLoading,
    isMutating,
    isReordering,
    isUpdating,
    items,
    loadItems,
    moveItem,
    newContent,
    openDeleteConfirm,
    progressPercent,
    saveEdit,
    startEditing,
    successMessage,
    toggleItem,
  };
};
