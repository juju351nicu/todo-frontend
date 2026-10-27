import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectSummary } from "@/features/project/types/project";
import { useUserStore } from "@/features/auth/stores/user";
import { getProjectStatusLabel } from "@/features/project/utils/projectStatus";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/** Project一覧の検索、読込、Board遷移を管理する。 */
export const useProjectListPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const projects = ref<ProjectSummary[]>([]);
  const searchText = ref<string>("");

  /**
   * 検索欄の語を含むProjectだけを返す（大文字小文字は区別しない）。
   * 照合する文字列はカードに出ている名前・Project key・状態の表示名・Project roleと、状態コード。
   * 状態はカードに「利用中」「アーカイブ」と出るため表示名でも探せるようにする
   * （コードだけで照合していたため「アーカイブ」で0件になった。動作確認/13_Project一覧_Template G-2）。
   */
  const filteredProjects = computed(() => {
    const keyword = searchText.value.trim().toLocaleLowerCase();
    if (keyword.length === 0) {
      return projects.value;
    }
    return projects.value.filter((project) =>
      [
        project.projectKey,
        project.name,
        getProjectStatusLabel(project.status),
        project.status,
        project.projectRole ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(keyword)
    );
  });

  /** 画面初期表示用に、参照可能なProjectを取得する。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      projects.value = await ProjectApi.getProjects();
    } catch (error: unknown) {
      await handleApiError(error);
    } finally {
      isLoading.value = false;
    }
  };

  /** 選択したProjectのBoardへ遷移する。 */
  const openBoard = async (projectId: number): Promise<void> => {
    await router.push({ name: "TaskBoard", params: { projectId } });
  };

  /** Project APIのstatusを、認証状態を含む一覧画面の案内へ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof ProjectApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [DISPLAY_MESSAGES.project.readForbidden];
      return;
    }
    errorMessages.value = [DISPLAY_MESSAGES.project.listLoadFailed];
  };

  return {
    errorMessages,
    filteredProjects,
    initialize,
    isLoading,
    openBoard,
    projects,
    searchText,
  };
};
