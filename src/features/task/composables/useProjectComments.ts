import { ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TaskCommentApi, {
  TaskCommentApiError,
} from "@/features/task/api/taskCommentApi";
import type { ProjectTaskComment } from "@/features/task/types/taskComment";
import { TASK_COMMENT_ERROR_CODES } from "@/features/task/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

/**
 * Project BoardのTask横断コメントDialogを管理する。
 * Dialogを開くたびに最新100件を取得し、定期pollingやFrontend側の横断集計は行わない。
 *
 * @param projectId 参照対象Project ID
 * @returns Dialog状態、Task情報付きコメント一覧、再読込操作
 */
export const useProjectComments = (
  projectId: Readonly<Ref<number | null>>
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const comments = ref<ProjectTaskComment[]>([]);
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const isOpen = ref(false);

  /** API statusと契約済みerror codeをProjectコメント用の案内へ変換する。 */
  const getErrorMessages = (error: unknown): string[] => {
    if (!(error instanceof TaskCommentApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [DISPLAY_MESSAGES.task.comments.readForbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.comments.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      TASK_COMMENT_ERROR_CODES,
      DISPLAY_MESSAGES.task.comments.projectLoadFailed
    );
  };

  /**
   * Project内コメントを再取得する。
   * 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。
   */
  const loadComments = async (): Promise<void> => {
    if (projectId.value === null || isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      comments.value = await TaskCommentApi.findProjectComments(
        projectId.value
      );
    } catch (error: unknown) {
      comments.value = [];
      if (error instanceof TaskCommentApiError && error.status === 401) {
        isOpen.value = false;
        errorMessages.value = [];
        userStore.clearSession();
        await router.push({ name: "Login" });
      } else {
        errorMessages.value = getErrorMessages(error);
      }
    } finally {
      isLoading.value = false;
    }
  };

  /** Dialogを開き、前回表示後の投稿・編集・削除を含む最新一覧を取得する。 */
  const openComments = async (): Promise<void> => {
    if (projectId.value === null || isLoading.value) {
      return;
    }
    isOpen.value = true;
    await loadComments();
  };

  /** Task選択または閉じる操作でDialogだけを閉じる。 */
  const closeComments = (): void => {
    isOpen.value = false;
  };

  watch(projectId, () => {
    comments.value = [];
    errorMessages.value = [];
    isOpen.value = false;
  });

  return {
    closeComments,
    comments,
    errorMessages,
    isLoading,
    isOpen,
    loadComments,
    openComments,
  };
};
