import { ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TaskCommentApi, {
  TaskCommentApiError,
} from "@/features/task/api/taskCommentApi";
import type { ProjectTaskComment } from "@/features/task/types/taskComment";

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
  const errorMessage = ref("");
  const isLoading = ref(false);
  const isOpen = ref(false);

  /** Backend共通ErrorResponseから一覧用の案内文を取得する。 */
  const getErrorMessage = (error: TaskCommentApiError): string =>
    error.errorResponse?.fieldErrors?.[0]?.message ??
    "Projectのコメントを取得できませんでした。";

  /**
   * Project内コメントを再取得する。
   * 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。
   */
  const loadComments = async (): Promise<void> => {
    if (projectId.value === null || isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessage.value = "";
    try {
      comments.value = await TaskCommentApi.findProjectComments(
        projectId.value
      );
    } catch (error: unknown) {
      comments.value = [];
      if (error instanceof TaskCommentApiError && error.status === 401) {
        isOpen.value = false;
        userStore.clearSession();
        await router.push({ name: "Login" });
      } else if (error instanceof TaskCommentApiError) {
        errorMessage.value = getErrorMessage(error);
      } else {
        errorMessage.value = "Backendへ接続できませんでした。";
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
    errorMessage.value = "";
    isOpen.value = false;
  });

  return {
    closeComments,
    comments,
    errorMessage,
    isLoading,
    isOpen,
    loadComments,
    openComments,
  };
};
