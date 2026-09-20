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
  const errorMessage = ref("");
  const successMessage = ref("");
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const isMutating = computed(
    () => isSubmitting.value || isUpdating.value || isDeleting.value
  );

  /** Backend共通ErrorResponseから最初の利用者向けメッセージを取得する。 */
  const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof TaskCommentApiError
      ? error.errorResponse?.fieldErrors?.[0]?.message ?? fallback
      : fallback;

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskCommentApiError) || error.status !== 401) {
      return false;
    }
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
    errorMessage.value = "";
    successMessage.value = "";
    try {
      comments.value = await TaskCommentApi.findComments(
        projectId.value,
        taskId.value
      );
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "コメントを取得できませんでした。"
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
    if (!normalizedBody || normalizedBody.length > 2000) {
      errorMessage.value = "コメント本文を1〜2000文字で入力してください。";
      return;
    }
    const payload: TaskCommentCreateRequest = { body: normalizedBody };
    isSubmitting.value = true;
    errorMessage.value = "";
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
        errorMessage.value = getErrorMessage(
          error,
          "コメントを投稿できませんでした。"
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
    errorMessage.value = "";
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
    const message = getErrorMessage(error, fallback);
    clearMutationDrafts();
    if (await loadComments()) {
      errorMessage.value = message;
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
    if (!normalizedBody || normalizedBody.length > 2000) {
      errorMessage.value = "コメント本文を1〜2000文字で入力してください。";
      return;
    }
    const payload: TaskCommentUpdateRequest = {
      body: normalizedBody,
      version: comment.version,
    };
    isUpdating.value = true;
    errorMessage.value = "";
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
      errorMessage.value = getErrorMessage(
        error,
        "コメントを更新できませんでした。"
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
    errorMessage.value = "";
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
    errorMessage.value = "";
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
      errorMessage.value = getErrorMessage(
        error,
        "コメントを削除できませんでした。"
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

  return {
    cancelDelete,
    cancelEditing,
    canModifyComment,
    commentBody,
    comments,
    confirmDelete,
    deletingComment,
    editBody,
    editingCommentId,
    errorMessage,
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
