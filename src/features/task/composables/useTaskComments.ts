import { ref, watch, type Ref } from "vue";

import TaskCommentApi from "@/features/task/api/taskCommentApi";
import type {
  TaskComment,
  TaskCommentCreateRequest,
} from "@/features/task/types/taskComment";
import type { ErrorResponse } from "@/shared/types/error";

/** Project BoardのTask編集Dialog内でコメント取得・投稿を扱う。 */
export const useTaskComments = (
  projectId: Readonly<Ref<number | null>>,
  taskId: Readonly<Ref<number | null>>
) => {
  const comments = ref<TaskComment[]>([]);
  const commentBody = ref("");
  const errorMessage = ref("");
  const isLoading = ref(false);
  const isSubmitting = ref(false);

  const readError = async (response: Response, fallback: string): Promise<string> => {
    try {
      const errorResponse = (await response.json()) as ErrorResponse;
      return errorResponse.fieldErrors?.[0]?.message ?? fallback;
    } catch (_error: unknown) {
      return fallback;
    }
  };

  /** Task IDが有効なときだけコメントを取得し、Task切替時に前の内容を残さない。 */
  const loadComments = async (): Promise<void> => {
    if (projectId.value === null || taskId.value === null) {
      comments.value = [];
      return;
    }
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const response = await TaskCommentApi.findComments(
        projectId.value,
        taskId.value
      );
      if (!response.ok) {
        errorMessage.value = await readError(
          response,
          "コメントを取得できませんでした。"
        );
        return;
      }
      comments.value = (await response.json()) as TaskComment[];
    } catch (_error: unknown) {
      errorMessage.value = "コメントを取得できませんでした。";
    } finally {
      isLoading.value = false;
    }
  };

  /** 本文を投稿し、Backendが返したコメントを一覧へ追加する。 */
  const submitComment = async (): Promise<void> => {
    const normalizedBody = commentBody.value.trim();
    if (projectId.value === null || taskId.value === null || !normalizedBody) {
      errorMessage.value = "コメント本文を入力してください。";
      return;
    }
    const payload: TaskCommentCreateRequest = { body: normalizedBody };
    isSubmitting.value = true;
    errorMessage.value = "";
    try {
      const response = await TaskCommentApi.createComment(
        projectId.value,
        taskId.value,
        payload
      );
      if (!response.ok) {
        errorMessage.value = await readError(
          response,
          "コメントを投稿できませんでした。"
        );
        return;
      }
      comments.value.push((await response.json()) as TaskComment);
      commentBody.value = "";
    } catch (_error: unknown) {
      errorMessage.value = "コメントを投稿できませんでした。";
    } finally {
      isSubmitting.value = false;
    }
  };

  watch([projectId, taskId], () => {
    void loadComments();
  }, { immediate: true });

  return {
    comments,
    commentBody,
    errorMessage,
    isLoading,
    isSubmitting,
    loadComments,
    submitComment,
  };
};
