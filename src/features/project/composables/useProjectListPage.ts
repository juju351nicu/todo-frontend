import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type {
  ProjectCreateRequest,
  ProjectSummary,
} from "@/features/project/types/project";
import { useUserStore } from "@/features/auth/stores/user";
import { PROJECT_ERROR_CODES } from "@/features/project/utils/apiErrors";
import { getProjectStatusLabel } from "@/features/project/utils/projectStatus";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

/** Projectキーの形式（Backendの`ProjectCreateRequest`と同じ。大文字英数字をハイフンで区切る）。 */
const PROJECT_KEY_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** Project作成フォームの初期値。 */
const createEmptyCreateForm = (): ProjectCreateRequest => ({
  projectKey: "",
  name: "",
  description: "",
});

/** Project一覧の検索、読込、Board遷移と、Templateを使わないProject作成（改善提案 2-13）を管理する。 */
export const useProjectListPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const projects = ref<ProjectSummary[]>([]);
  const searchText = ref<string>("");
  const isCreateDialogOpen = ref(false);
  const isCreatingProject = ref(false);
  const createForm = ref<ProjectCreateRequest>(createEmptyCreateForm());
  /** 作成Dialog内に出すBackendの理由（Projectキー重複等）。一覧の取得エラーとは分ける。 */
  const createErrorMessages = ref<string[]>([]);

  /**
   * Templateを使わずにProjectを作れるか。以前は画面がなくTemplateからしか作れず、Templateは既存Projectから保存するため、
   * Projectがない利用者は最初のProjectを作れなかった（改善提案 2-13）。
   */
  const canCreateProject = computed(() => userStore.hasPermission("PROJECT_CREATE"));

  /**
   * 作成フォームの入力の誤り（項目名→理由）。空欄は入力途中のことが多いため出さず、「作成」を押せないことで示す。
   * 上限と形式はBackendの`ProjectCreateRequest`と同じ。
   */
  const createFormErrors = computed<Record<"projectKey" | "name" | "description", string>>(() => {
    const projectKey = createForm.value.projectKey.trim();
    const name = createForm.value.name.trim();
    const description = createForm.value.description.trim();
    return {
      projectKey:
        projectKey.length > 30
          ? "Projectキーは30文字以内で入力してください。"
          : projectKey.length > 0 && !PROJECT_KEY_PATTERN.test(projectKey)
            ? "Projectキーは大文字英数字をハイフンで区切って入力してください（例：SALES-2026）。"
            : "",
      name: name.length > 100 ? "名前は100文字以内で入力してください。" : "",
      description: description.length > 2000 ? "説明は2000文字以内で入力してください。" : "",
    };
  });

  /** 必須項目が入り、形式・上限の誤りがなく、作成中でないか。 */
  const canSubmitCreate = computed(
    () =>
      canCreateProject.value &&
      !isCreatingProject.value &&
      createForm.value.projectKey.trim().length > 0 &&
      createForm.value.name.trim().length > 0 &&
      Object.values(createFormErrors.value).every((message) => message === "")
  );

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

  /** 空のフォームでProject作成Dialogを開く。 */
  const openCreateDialog = (): void => {
    if (!canCreateProject.value) {
      return;
    }
    createForm.value = createEmptyCreateForm();
    createErrorMessages.value = [];
    isCreateDialogOpen.value = true;
  };

  /** Project作成Dialogを閉じる。作成中は閉じない（結果を受け取る前に閉じると、作成済みか分からなくなるため）。 */
  const closeCreateDialog = (): void => {
    if (isCreatingProject.value) {
      return;
    }
    isCreateDialogOpen.value = false;
  };

  /**
   * 入力したProjectキー・名前・説明でProjectを作り、作ったProjectのBoardへ移る。
   * 失敗した場合はDialogを開いたまま、Backendの理由（Projectキー重複等）をDialog内に出す。
   */
  const submitCreate = async (): Promise<void> => {
    if (!canSubmitCreate.value) {
      return;
    }
    isCreatingProject.value = true;
    createErrorMessages.value = [];
    try {
      const created = await ProjectApi.createProject({
        projectKey: createForm.value.projectKey.trim(),
        name: createForm.value.name.trim(),
        description: createForm.value.description.trim(),
      });
      isCreateDialogOpen.value = false;
      await openBoard(created.projectId);
    } catch (error: unknown) {
      if (error instanceof ProjectApiError && error.status === 401) {
        isCreateDialogOpen.value = false;
        await handleApiError(error);
        return;
      }
      createErrorMessages.value = resolveCreateErrorMessages(error);
    } finally {
      isCreatingProject.value = false;
    }
  };

  /**
   * Project作成の失敗を、Dialog内に出す案内へ変換する。
   *
   * @param error 作成APIの例外
   * @returns 表示する案内。Backendの既知のerror code（Projectキー重複等）はその文言、それ以外は固定文言
   */
  const resolveCreateErrorMessages = (error: unknown): string[] => {
    if (!(error instanceof ProjectApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [DISPLAY_MESSAGES.project.create.forbidden];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      PROJECT_ERROR_CODES,
      DISPLAY_MESSAGES.project.create.failed
    );
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
    canCreateProject,
    canSubmitCreate,
    closeCreateDialog,
    createErrorMessages,
    createForm,
    createFormErrors,
    errorMessages,
    filteredProjects,
    initialize,
    isCreateDialogOpen,
    isCreatingProject,
    isLoading,
    openBoard,
    openCreateDialog,
    projects,
    searchText,
    submitCreate,
  };
};
