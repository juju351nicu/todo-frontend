import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import TaskCommentApi, {
  TaskCommentApiError,
} from "@/features/task/api/taskCommentApi";
import type {
  TaskComment,
  TaskCommentCreateRequest,
  TaskCommentUpdateRequest,
} from "@/features/task/types/taskComment";
import {
  TASK_COMMENT_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";
import { createLatestRequestTracker } from "@/shared/utils/latestRequest";

/** コメント本文の最大文字数（trim後）。Backendの入力制約と同じ値。 */
export const TASK_COMMENT_MAX_LENGTH = 2000;

/**
 * 投稿欄（`TaskCommentsPanel.vue`の「コメントを追加」）に付ける`data-comment-control`属性の値。
 * 投稿の後にフォーカスを戻す先として使う。
 */
export const COMMENT_COMPOSER_CONTROL = "composer";

/**
 * コメントごとの編集ボタンに付ける`data-comment-control`属性の値を組み立てる。
 * `TaskCommentsPanel.vue`はこの値で属性を付け、`useTaskComments`は同じ値で編集ボタンを探してフォーカスを戻す。
 *
 * @param commentId コメントID
 * @returns `"{commentId}:edit"`形式の属性値
 */
export const commentEditControlKey = (commentId: number): string =>
  `${commentId}:edit`;

/** `data-comment-control`属性の値から、その要素を探すselectorを作る。 */
const buildCommentControlSelector = createDataAttributeSelector("data-comment-control");

/**
 * trim後1文字以上、最大文字数以下のコメント本文か。
 * `String.prototype.trim`は全角空白も除くため、全角空白だけの本文も無効として扱う。
 */
const isValidCommentBody = (body: string): boolean => {
  const trimmedBody = body.trim();
  return trimmedBody.length > 0 && trimmedBody.length <= TASK_COMMENT_MAX_LENGTH;
};

/** 更新系APIへ渡すProject IDとTask ID。 */
interface CommentMutationTarget {
  projectId: number;
  taskId: number;
}

/**
 * Project BoardのTask Dialog内でコメントの取得・投稿・本人編集・本人削除を扱う。
 *
 * - 初期化と再読込: `projectId`・`taskId`が変わるたびに投稿欄・編集中・削除確認中の状態を捨て、一覧を取り直す。
 * - 投稿: Backendは`TASK_READ`とProject参加で投稿を許可する（担当者に関係ない）。`disabled`がtrueの間は投稿しない。
 * - 編集・削除: 投稿者本人だけ（OWNER・SYSTEM_ADMINでも他人のコメントは403）。本人のコメントにだけ操作を出す。
 * - 401: 一覧と操作中の状態を捨て、Sessionを破棄してLoginへ遷移する。
 * - 編集・削除の404／409: 取得時点のversionを捨て、Backendの最新一覧へ置き換えてから、
 *   Backendの文言と再取得済みの案内を出す。投稿の失敗は一覧を取り直さず、文言だけを出す。
 * - 投稿・編集の後は、投稿欄・編集ボタンへフォーカスを戻す（`data-comment-control`属性）。
 *
 * @param projectId コメント対象Project ID。nullの間は一覧を空にしてAPIを呼ばない
 * @param taskId コメント対象Task ID。nullの間は一覧を空にしてAPIを呼ばない
 * @param disabled 投稿・編集・削除をさせないときtrue（`TASK_READ`がない、archive済みProject）
 * @returns コメント一覧、入力状態、所有者判定と各操作
 */
export const useTaskComments = (
  projectId: Readonly<Ref<number | null>>,
  taskId: Readonly<Ref<number | null>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  /** 投稿時刻の古い順のコメント。更新APIの確定Responseで置き換える。 */
  const comments = ref<TaskComment[]>([]);
  /** 投稿欄の入力値（trim前）。 */
  const commentBody = ref("");
  /** 編集中のコメントID。編集していないときはnull。 */
  const editingCommentId = ref<number | null>(null);
  /** 編集欄の入力値（trim前）。 */
  const editBody = ref("");
  /** 削除確認Dialogで確認中のコメント。確認していないときはnull。 */
  const deletingComment = ref<TaskComment | null>(null);
  /** パネル内に赤で出す文言（複数行）。 */
  const errorMessages = ref<string[]>([]);
  /** パネル内に緑で出す文言。出さないときは空文字。 */
  const successMessage = ref("");
  const isLoading = ref(false);
  /**
   * コメント一覧の読込の順番。Task詳細Dialogを開いたまま別のTaskへ切り替えたとき、
   * 前のTaskの一覧が後から届いて今のTaskの一覧を上書きしないよう、最後に始めた読込だけを反映する。
   */
  const listRequests = createLatestRequestTracker();
  const isSubmitting = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  /** いずれかの更新系APIを実行中か。実行中は投稿欄・各ボタンをdisabledにして二重送信を防ぐ。 */
  const isMutating = computed(
    () => isSubmitting.value || isUpdating.value || isDeleting.value
  );
  /** 参照専用でなく、入力中の本文が有効で、他の更新中でない場合だけ投稿できる。 */
  const canSubmit = computed<boolean>(
    () => !disabled.value && isValidCommentBody(commentBody.value) && !isMutating.value
  );
  /** 編集中の本文が有効で、他の更新中でない場合だけ更新できる。 */
  const canSaveEdit = computed<boolean>(() => isValidCommentBody(editBody.value) && !isMutating.value);

  /** 前回の操作結果の文言を消す。新しい操作・取得を始めるときに呼ぶ。 */
  const clearFeedback = (): void => {
    errorMessages.value = [];
    successMessage.value = "";
  };

  /**
   * 更新系APIを今呼んでよいときだけ、送り先のProject IDとTask IDを返す。
   *
   * @returns 参照専用・他の更新中・ID未確定のいずれかならnull
   */
  const resolveMutationTarget = (): CommentMutationTarget | null => {
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
    forbidden: string = DISPLAY_MESSAGES.task.comments.operationForbidden
  ): string[] => {
    if (!(error instanceof TaskCommentApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.comments.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      TASK_COMMENT_ERROR_CODES,
      fallback
    );
  };

  /** 編集・削除対象を破棄し、取得前versionを再利用できない状態へ戻す。 */
  const clearMutationDrafts = (): void => {
    editingCommentId.value = null;
    editBody.value = "";
    deletingComment.value = null;
  };

  /**
   * 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。
   *
   * @param error APIまたは通信で発生した例外
   * @returns 401を処理した（呼出側は以降の表示更新をしない）ときtrue
   */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskCommentApiError) || error.status !== 401) {
      return false;
    }
    comments.value = [];
    clearMutationDrafts();
    clearFeedback();
    await expireSession();
    return true;
  };

  /**
   * Task IDが有効なときだけコメントを取得し、Task切替時に前の内容を残さない。
   *
   * @returns 取得できたときtrue。IDが未確定・取得失敗のときfalse
   */
  const loadComments = async (): Promise<boolean> => {
    if (projectId.value === null || taskId.value === null) {
      comments.value = [];
      return false;
    }
    const isLatestRequest = listRequests.begin();
    isLoading.value = true;
    clearFeedback();
    try {
      const loadedComments = await TaskCommentApi.findComments(
        projectId.value,
        taskId.value
      );
      if (!isLatestRequest()) {
        return false;
      }
      comments.value = loadedComments;
      return true;
    } catch (error: unknown) {
      if (!isLatestRequest()) {
        return false;
      }
      if (!(await handleUnauthorized(error))) {
        if (
          error instanceof TaskCommentApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          comments.value = [];
          clearMutationDrafts();
        }
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.comments.loadFailed,
          DISPLAY_MESSAGES.task.comments.readForbidden
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
   * 409または404の古い操作対象を破棄し、最新コメント一覧へ置き換える。
   * 再取得に成功したら、Backendの文言（「最新状態を取得してください」等）の後ろに再取得済みの案内を添える。
   * 画面はすでに最新一覧を表示しているので、利用者が手動で再読込しなくてよいと分かるようにするため。
   * 再取得自体が401・403・404等になった場合は、古い競合の文言よりそちらを優先して出す。
   *
   * @param error 編集・削除APIが返した404または409
   * @param fallback Backendの文言を出せないときの代わりの文言
   */
  const recoverLatestComments = async (
    error: TaskCommentApiError,
    fallback: string
  ): Promise<void> => {
    const currentProjectId = projectId.value;
    const currentTaskId = taskId.value;
    if (currentProjectId === null || currentTaskId === null) {
      comments.value = [];
      clearMutationDrafts();
      return;
    }
    const mutationMessages = getErrorMessages(error, fallback);
    clearMutationDrafts();
    const isLatestRequest = listRequests.begin();
    isLoading.value = true;
    clearFeedback();
    try {
      const loadedComments = await TaskCommentApi.findComments(
        currentProjectId,
        currentTaskId
      );
      if (!isLatestRequest()) {
        return;
      }
      comments.value = loadedComments;
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.comments.conflictReloaded,
      ];
    } catch (reloadError: unknown) {
      if (!isLatestRequest() || (await handleUnauthorized(reloadError))) {
        return;
      }
      if (
        reloadError instanceof TaskCommentApiError &&
        TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
      ) {
        if (reloadError.status === 403 || reloadError.status === 404) {
          comments.value = [];
        }
        errorMessages.value = getErrorMessages(
          reloadError,
          DISPLAY_MESSAGES.task.comments.reloadFailed,
          DISPLAY_MESSAGES.task.comments.readForbidden
        );
        return;
      }
      errorMessages.value = [
        ...mutationMessages,
        DISPLAY_MESSAGES.task.comments.reloadFailed,
      ];
    } finally {
      if (isLatestRequest()) {
        isLoading.value = false;
      }
    }
  };

  /**
   * 編集・削除APIの失敗を共通処理する。401はLoginへ、404／409は最新一覧へ回復し、それ以外は文言を出す。
   *
   * @param error 編集・削除APIまたは通信で発生した例外
   * @param fallback 契約外のerror codeや本文なしのときに出す文言
   */
  const handleMutationError = async (
    error: unknown,
    fallback: string
  ): Promise<void> => {
    if (await handleUnauthorized(error)) {
      return;
    }
    if (
      error instanceof TaskCommentApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      await recoverLatestComments(
        error,
        DISPLAY_MESSAGES.task.comments.conflictFallback
      );
      return;
    }
    errorMessages.value = getErrorMessages(error, fallback);
  };

  /** 現在のSession利用者が対象コメントの投稿者本人で、参照専用でないか判定する。 */
  const canModifyComment = (comment: TaskComment): boolean =>
    !disabled.value &&
    userStore.memberId !== null &&
    comment.authorAccountId === userStore.memberId;

  /**
   * 本文をtrimして投稿し、Backendが返したコメントを一覧の末尾へ追加する。成功したら投稿欄を空にする。
   * 投稿の後（失敗した場合も含む）は、続けて書けるよう投稿欄へフォーカスを戻す。
   */
  const submitComment = async (): Promise<void> => {
    const target = resolveMutationTarget();
    if (target === null) {
      return;
    }
    const normalizedBody = commentBody.value.trim();
    if (!isValidCommentBody(normalizedBody)) {
      errorMessages.value = [DISPLAY_MESSAGES.task.comments.bodyInvalid];
      return;
    }
    const payload: TaskCommentCreateRequest = { body: normalizedBody };
    isSubmitting.value = true;
    clearFeedback();
    try {
      comments.value.push(
        await TaskCommentApi.createComment(target.projectId, target.taskId, payload)
      );
      commentBody.value = "";
      successMessage.value = DISPLAY_MESSAGES.task.comments.created;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessages.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.comments.createFailed
        );
      }
    } finally {
      isSubmitting.value = false;
    }
    // 送信中は投稿欄と投稿ボタンをdisabledにするためフォーカスが外れる。続けて書けるよう投稿欄へ戻す。
    await focusFirstEnabledElement([buildCommentControlSelector(COMMENT_COMPOSER_CONTROL)]);
  };

  /** 投稿者本人のコメント本文を編集状態へ切り替える。削除確認中なら閉じる。 */
  const startEditing = (comment: TaskComment): void => {
    if (!canModifyComment(comment) || isMutating.value) {
      return;
    }
    deletingComment.value = null;
    editingCommentId.value = comment.commentId;
    editBody.value = comment.body;
    clearFeedback();
  };

  /** 未送信のコメント編集内容を破棄する（フォーカスは動かさない）。 */
  const cancelEditing = (): void => {
    editingCommentId.value = null;
    editBody.value = "";
  };

  /**
   * 利用者の操作（「キャンセル」・Escキー）で編集をやめ、そのコメントの編集ボタンへフォーカスを戻す。
   * 編集欄は閉じると消えるため、戻さないとフォーカスがDialogの先頭へ外れる。
   */
  const discardEditing = async (): Promise<void> => {
    const commentId = editingCommentId.value;
    cancelEditing();
    if (commentId !== null) {
      await focusFirstEnabledElement([buildCommentControlSelector(commentEditControlKey(commentId))]);
    }
  };

  /**
   * 編集開始時点のversionで本人コメントを更新する。
   * 対象が一覧から消えた・本人のものでなくなった場合は、送信せずに編集をやめる。
   */
  const submitEdit = async (): Promise<void> => {
    const target = resolveMutationTarget();
    if (target === null || editingCommentId.value === null) {
      return;
    }
    const comment = comments.value.find(
      (candidate) => candidate.commentId === editingCommentId.value
    );
    if (!comment || !canModifyComment(comment)) {
      cancelEditing();
      return;
    }
    const normalizedBody = editBody.value.trim();
    if (!isValidCommentBody(normalizedBody)) {
      errorMessages.value = [DISPLAY_MESSAGES.task.comments.bodyInvalid];
      return;
    }
    const payload: TaskCommentUpdateRequest = {
      body: normalizedBody,
      version: comment.version,
    };
    isUpdating.value = true;
    clearFeedback();
    try {
      const updated = await TaskCommentApi.updateComment(
        target.projectId,
        target.taskId,
        comment.commentId,
        payload
      );
      comments.value = comments.value.map((candidate) =>
        candidate.commentId === updated.commentId ? updated : candidate
      );
      cancelEditing();
      successMessage.value = DISPLAY_MESSAGES.task.comments.updated;
    } catch (error: unknown) {
      await handleMutationError(error, DISPLAY_MESSAGES.task.comments.updateFailed);
    } finally {
      isUpdating.value = false;
    }
    // 更新に成功して編集欄が閉じたときだけ編集ボタンへ戻す。失敗して編集欄が残る場合は編集欄のフォーカスを奪わない。
    if (editingCommentId.value === null) {
      await focusFirstEnabledElement([buildCommentControlSelector(commentEditControlKey(comment.commentId))]);
    }
  };

  /** 投稿者本人のコメントを削除確認対象にする。編集中なら編集を捨てる。 */
  const openDeleteConfirm = (comment: TaskComment): void => {
    if (!canModifyComment(comment) || isMutating.value) {
      return;
    }
    cancelEditing();
    deletingComment.value = comment;
    clearFeedback();
  };

  /** 未実行のコメント削除確認を閉じる。 */
  const cancelDelete = (): void => {
    deletingComment.value = null;
  };

  /** 削除確認Dialogが閉じられた（Esc・外側クリック等）場合に削除対象を破棄する。 */
  const handleDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelDelete();
    }
  };

  /** 削除確認対象の取得時点versionで本人コメントを削除し、204のときだけ一覧から外す。 */
  const confirmDelete = async (): Promise<void> => {
    const deleting = deletingComment.value;
    const target = resolveMutationTarget();
    if (target === null || deleting === null || !canModifyComment(deleting)) {
      return;
    }
    isDeleting.value = true;
    clearFeedback();
    try {
      await TaskCommentApi.deleteComment(
        target.projectId,
        target.taskId,
        deleting.commentId,
        deleting.version
      );
      comments.value = comments.value.filter(
        (comment) => comment.commentId !== deleting.commentId
      );
      cancelDelete();
      successMessage.value = DISPLAY_MESSAGES.task.comments.deleted;
    } catch (error: unknown) {
      await handleMutationError(error, DISPLAY_MESSAGES.task.comments.deleteFailed);
    } finally {
      isDeleting.value = false;
    }
  };

  // 別のTaskを開いたときに前のTaskの下書き・編集対象（古いversion）を送らないよう、取り直す前に捨てる。
  watch(
    [projectId, taskId],
    () => {
      commentBody.value = "";
      clearMutationDrafts();
      void loadComments();
    },
    { immediate: true }
  );

  return {
    cancelDelete,
    cancelEditing,
    canModifyComment,
    canSaveEdit,
    canSubmit,
    commentBody,
    comments,
    confirmDelete,
    deletingComment,
    discardEditing,
    editBody,
    editingCommentId,
    errorMessages,
    handleDeleteDialogVisibility,
    isDeleting,
    isLoading,
    isMutating,
    isSubmitting,
    isUpdating,
    loadComments,
    openDeleteConfirm,
    startEditing,
    submitComment,
    submitEdit,
    successMessage,
  };
};
