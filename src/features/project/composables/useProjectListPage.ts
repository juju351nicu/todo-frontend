import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type { ProjectSummary } from "@/features/project/types/project";
import { useUserStore } from "@/features/auth/stores/user";

/** Project一覧の検索、読込、Board遷移を管理する。 */
export const useProjectListPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const projects = ref<ProjectSummary[]>([]);
  const searchText = ref<string | null>("");

  const filteredProjects = computed(() => {
    // Vuetifyのclearableはnullを設定するため、検索境界で空文字へ正規化する。
    const keyword = (searchText.value ?? "").trim().toLocaleLowerCase();
    if (keyword.length === 0) {
      return projects.value;
    }
    return projects.value.filter((project) =>
      [project.projectKey, project.name, project.status, project.projectRole ?? ""]
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
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["Projectを参照するpermissionがありません。"];
      return;
    }
    errorMessages.value = ["Project一覧を取得できませんでした。"];
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
