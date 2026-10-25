import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

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

/** コメント本文の最大文字数（trim後）。Backendの入力制約と同じ値。 */
export const TASK_COMMENT_MAX_LENGTH = 2000;

/** trim後1文字以上、最大文字数以下のコメント本文か。 */
const isValidCommentBody = (body: string): boolean => {
  const trimmedBody = body.trim();
  return trimmedBody.length > 0 && trimmedBody.length <= TASK_COMMENT_MAX_LENGTH;
};

/**
 * Project BoardのTask編集Dialog内でコメント取得・投稿・本人編集・本人削除を扱う。
 * 409では古い編集対象を破棄して一覧を再取得し、取得前versionの再送を防ぐ。
 *
 * @param projectId コメント対象Project ID
 * @param taskId コメント対象Task ID
 * @param disabled archiveまたは画面上の参照専用状態
 * @returns コメント一覧、入力状態、所有者判定と各操作
 */
export const useTaskComments = (
  projectId: Readonly<Ref<number | null>>,
  taskId: Readonly<Ref<number | null>>,
  disabled: Readonly<Ref<boolean>>
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const comments = ref<TaskComment[]>([]);
  const commentBody = ref("");
  const editingCommentId = ref<number | null>(null);
  const editBody = ref("");
  const deletingComment = ref<TaskComment | null>(null);
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const isMutating = computed(
    () => isSubmitting.value || isUpdating.value || isDeleting.value
  );
  /** 参照専用でなく、入力中の本文が有効で、他の更新中でない場合だけ投稿できる。 */
  const canSubmit = computed<boolean>(
    () => !disabled.value && isValidCommentBody(commentBody.value) && !isMutating.value
  );
  /** 編集中の本文が有効で、他の更新中でない場合だけ更新できる。 */
  const canSaveEdit = computed<boolean>(() => isValidCommentBody(editBody.value) && !isMutating.value);

  /** API statusと契約済みerror codeを利用者向けメッセージへ変換する。 */
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

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskCommentApiError) || error.status !== 401) {
      return false;
    }
    comments.value = [];
    clearMutationDrafts();
    errorMessages.value = [];
    successMessage.value = "";
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** 編集・削除対象を破棄し、取得前versionを再利用できない状態へ戻す。 */
  const clearMutationDrafts = (): void => {
    editingCommentId.value = null;
    editBody.value = "";
    deletingComment.value = null;
  };

  /** Task IDが有効なときだけコメントを取得し、Task切替時に前の内容を残さない。 */
  const loadComments = async (): Promise<boolean> => {
    if (projectId.value === null || taskId.value === null) {
      comments.value = [];
      return false;
    }
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      comments.value = await TaskCommentApi.findComments(
        projectId.value,
        taskId.value
      );
      return true;
    } catch (error: unknown) {
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
      isLoading.value = false;
    }
  };

  /** 現在のSession利用者が対象コメントの投稿者本人か判定する。 */
  const canModifyComment = (comment: TaskComment): boolean =>
    !disabled.value &&
    userStore.memberId !== null &&
    comment.authorAccountId === userStore.memberId;

  /** 本文を投稿し、Backendが返したコメントを一覧へ追加する。 */
  const submitComment = async (): Promise<void> => {
    const normalizedBody = commentBody.value.trim();
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null
    ) {
      return;
    }
    if (!normalizedBody || normalizedBody.length > TASK_COMMENT_MAX_LENGTH) {
      errorMessages.value = ["コメント本文を1〜2000文字で入力してください。"];
      return;
    }
    const payload: TaskCommentCreateRequest = { body: normalizedBody };
    isSubmitting.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      comments.value.push(
        await TaskCommentApi.createComment(
          projectId.value,
          taskId.value,
          payload
        )
      );
      commentBody.value = "";
      successMessage.value = "コメントを投稿しました。";
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
  };

  /** 投稿者本人のコメント本文を編集状態へ切り替える。 */
  const startEditing = (comment: TaskComment): void => {
    if (!canModifyComment(comment) || isMutating.value) {
      return;
    }
    deletingComment.value = null;
    editingCommentId.value = comment.commentId;
    editBody.value = comment.body;
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 未送信のコメント編集内容を破棄する。 */
  const cancelEditing = (): void => {
    editingCommentId.value = null;
    editBody.value = "";
  };

  /** 409または404の古い操作対象を破棄し、最新コメント一覧へ置き換える。 */
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
    isLoading.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      comments.value = await TaskCommentApi.findComments(
        currentProjectId,
        currentTaskId
      );
      errorMessages.value = mutationMessages;
    } catch (reloadError: unknown) {
      if (await handleUnauthorized(reloadError)) {
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
      isLoading.value = false;
    }
  };

  /** 編集開始時点のversionで本人コメントを更新する。 */
  const submitEdit = async (): Promise<void> => {
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null ||
      editingCommentId.value === null
    ) {
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
    if (!normalizedBody || normalizedBody.length > TASK_COMMENT_MAX_LENGTH) {
      errorMessages.value = ["コメント本文を1〜2000文字で入力してください。"];
      return;
    }
    const payload: TaskCommentUpdateRequest = {
      body: normalizedBody,
      version: comment.version,
    };
    isUpdating.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updated = await TaskCommentApi.updateComment(
        projectId.value,
        taskId.value,
        comment.commentId,
        payload
      );
      comments.value = comments.value.map((candidate) =>
        candidate.commentId === updated.commentId ? updated : candidate
      );
      cancelEditing();
      successMessage.value = "コメントを更新しました。";
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) {
        return;
      }
      if (
        error instanceof TaskCommentApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        await recoverLatestComments(
          error,
          "コメントが変更されています。最新の一覧を表示しました。"
        );
        return;
      }
      errorMessages.value = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.comments.updateFailed
      );
    } finally {
      isUpdating.value = false;
    }
  };

  /** 投稿者本人のコメントを削除確認対象にする。 */
  const openDeleteConfirm = (comment: TaskComment): void => {
    if (!canModifyComment(comment) || isMutating.value) {
      return;
    }
    cancelEditing();
    deletingComment.value = comment;
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 未実行のコメント削除確認を閉じる。 */
  const cancelDelete = (): void => {
    deletingComment.value = null;
  };

  /** 削除確認対象の取得時点versionで本人コメントを削除する。 */
  const confirmDelete = async (): Promise<void> => {
    const target = deletingComment.value;
    if (
      disabled.value ||
      isMutating.value ||
      projectId.value === null ||
      taskId.value === null ||
      target === null ||
      !canModifyComment(target)
    ) {
      return;
    }
    isDeleting.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await TaskCommentApi.deleteComment(
        projectId.value,
        taskId.value,
        target.commentId,
        target.version
      );
      comments.value = comments.value.filter(
        (comment) => comment.commentId !== target.commentId
      );
      cancelDelete();
      successMessage.value = "コメントを削除しました。";
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) {
        return;
      }
      if (
        error instanceof TaskCommentApiError &&
        (error.status === 404 || error.status === 409)
      ) {
        await recoverLatestComments(
          error,
          "コメントが変更されています。最新の一覧を表示しました。"
        );
        return;
      }
      errorMessages.value = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.comments.deleteFailed
      );
    } finally {
      isDeleting.value = false;
    }
  };

  watch(
    [projectId, taskId],
    () => {
      commentBody.value = "";
      clearMutationDrafts();
      void loadComments();
    },
    { immediate: true }
  );

  /** 削除確認dialogが閉じられた場合に削除対象を破棄する。 */
  const handleDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelDelete();
    }
  };

  return {
    cancelDelete,
    cancelEditing,
    canModifyComment,
    canSaveEdit,
    canSubmit,
    handleDeleteDialogVisibility,
    commentBody,
    comments,
    confirmDelete,
    deletingComment,
    editBody,
    editingCommentId,
    errorMessages,
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
