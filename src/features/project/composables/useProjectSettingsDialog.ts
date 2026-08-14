import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type {
  ProjectDetail,
  ProjectMember,
  ProjectMemberCreateRequest,
  ProjectMemberUpdateRequest,
  ProjectRole,
  ProjectUpdateRequest,
} from "@/features/project/types/project";

/** Project設定Dialogで編集する表示情報と取得時点のversion。 */
interface ProjectSettingsForm {
  name: string;
  description: string;
  version: number;
}

/** Project role選択肢の表示名とBackendコード。 */
interface ProjectRoleOption {
  title: string;
  value: ProjectRole;
}

/** Project設定Dialogの表示section。 */
type ProjectSettingsSection = "project" | "members";

const PROJECT_ROLE_OPTIONS: ProjectRoleOption[] = [
  { title: "OWNER", value: "OWNER" },
  { title: "MANAGER", value: "MANAGER" },
  { title: "MEMBER", value: "MEMBER" },
];

/** Project未読込時にも共有参照を持たない空フォームを作る。 */
const createEmptyProjectForm = (): ProjectSettingsForm => ({
  name: "",
  description: "",
  version: 0,
});

/** number inputが返す文字列または数値を正の安全な整数へ変換する。 */
const parseAccountId = (value: number | string | null): number | null => {
  if (value === null || value === "") {
    return null;
  }
  const accountId = Number(value);
  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null;
};

/**
 * Task Board上のProject設定Dialogについて、Project更新・archive・member管理をまとめて扱う。
 * Backendのsystem permissionとProject roleを画面案内に使うが、最終認可・最後のOWNER保護・version競合はBackendへ委ねる。
 *
 * @param project Task Boardが保持する最新Project詳細
 * @param onProjectUpdated 更新APIまたは再取得で確定したProject詳細を親画面へ反映するcallback
 * @returns Dialog、フォーム、認可表示、更新操作を構成するreactive state
 */
export const useProjectSettingsDialog = (
  project: Readonly<Ref<ProjectDetail | null>>,
  onProjectUpdated: (updatedProject: ProjectDetail) => void
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const activeSection = ref<ProjectSettingsSection>("project");
  const addMemberAccountId = ref<number | string | null>(null);
  const addMemberRole = ref<ProjectRole>("MEMBER");
  const errorMessages = ref<string[]>([]);
  const isArchiveConfirmOpen = ref(false);
  const isArchivingProject = ref(false);
  const isDialogOpen = ref(false);
  const isLoadingLatest = ref(false);
  const isRemoveConfirmOpen = ref(false);
  const isSavingMember = ref(false);
  const isSavingProject = ref(false);
  const memberRoleDrafts = ref<Record<number, ProjectRole>>({});
  const memberToRemove = ref<ProjectMember | null>(null);
  const projectForm = ref<ProjectSettingsForm>(createEmptyProjectForm());
  const successMessage = ref("");

  const currentProjectRole = computed(
    () =>
      project.value?.members.find(
        (member) => member.accountId === userStore.memberId
      )?.projectRole ?? null
  );
  const canManageResource = computed(
    () =>
      userStore.hasRole("SYSTEM_ADMIN") || currentProjectRole.value === "OWNER"
  );
  const isProjectActive = computed(() => project.value?.status === "ACTIVE");
  const canUpdateProject = computed(
    () =>
      canManageResource.value &&
      userStore.hasPermission("PROJECT_UPDATE") &&
      isProjectActive.value
  );
  const canManageMembers = computed(
    () =>
      canManageResource.value &&
      userStore.hasPermission("PROJECT_MEMBER_UPDATE") &&
      isProjectActive.value
  );
  const canOpenSettings = computed(
    () =>
      canManageResource.value &&
      (userStore.hasPermission("PROJECT_UPDATE") ||
        userStore.hasPermission("PROJECT_MEMBER_UPDATE"))
  );
  const isBusy = computed(
    () =>
      isArchivingProject.value ||
      isLoadingLatest.value ||
      isSavingMember.value ||
      isSavingProject.value
  );
  const ownerCount = computed(
    () =>
      project.value?.members.filter((member) => member.projectRole === "OWNER")
        .length ?? 0
  );
  const hasProjectChanges = computed(() => {
    const current = project.value;
    return (
      current !== null &&
      (projectForm.value.name.trim() !== current.name ||
        projectForm.value.description.trim() !== (current.description ?? ""))
    );
  });
  const canSaveProject = computed(
    () =>
      canUpdateProject.value &&
      !isBusy.value &&
      hasProjectChanges.value &&
      projectForm.value.name.trim().length > 0 &&
      projectForm.value.name.trim().length <= 100 &&
      projectForm.value.description.trim().length <= 2000
  );
  const canAddMember = computed(() => {
    const accountId = parseAccountId(addMemberAccountId.value);
    return (
      canManageMembers.value &&
      !isBusy.value &&
      accountId !== null &&
      !project.value?.members.some((member) => member.accountId === accountId)
    );
  });

  /** Backend確定済みProjectから編集フォームとmember role draftを作り直す。 */
  const synchronizeProject = (current: ProjectDetail | null): void => {
    if (current === null) {
      projectForm.value = createEmptyProjectForm();
      memberRoleDrafts.value = {};
      return;
    }
    projectForm.value = {
      name: current.name,
      description: current.description ?? "",
      version: current.version,
    };
    memberRoleDrafts.value = Object.fromEntries(
      current.members.map((member) => [member.accountId, member.projectRole])
    );
  };

  watch(project, synchronizeProject, { immediate: true });

  /** Backend確定済みProjectを親画面へ通知し、Dialog内のversionとdraftも同期する。 */
  const applyProjectDetail = (updatedProject: ProjectDetail): void => {
    onProjectUpdated(updatedProject);
    synchronizeProject(updatedProject);
  };

  /** Project設定を最新詳細から開始し、前回のmessageや確認対象を破棄する。 */
  const openDialog = (): void => {
    if (!canOpenSettings.value) {
      return;
    }
    synchronizeProject(project.value);
    activeSection.value = "project";
    errorMessages.value = [];
    successMessage.value = "";
    memberToRemove.value = null;
    isDialogOpen.value = true;
  };

  /** 更新処理中でない場合だけProject設定Dialogを閉じる。 */
  const closeDialog = (): void => {
    if (!isBusy.value) {
      isDialogOpen.value = false;
    }
  };

  /** Project表示情報を詳細取得時点のversionで更新する。 */
  const saveProject = async (): Promise<void> => {
    const current = project.value;
    if (current === null || !canSaveProject.value) {
      return;
    }
    const request: ProjectUpdateRequest = {
      name: projectForm.value.name.trim(),
      description: projectForm.value.description.trim() || null,
      status: current.status,
      version: projectForm.value.version,
    };

    isSavingProject.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updatedProject = await ProjectApi.updateProject(
        current.projectId,
        request
      );
      applyProjectDetail(updatedProject);
      successMessage.value = "Project情報を更新しました。";
    } catch (error: unknown) {
      await handleApiError(error, "Project情報を更新できませんでした。");
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict();
      }
    } finally {
      isSavingProject.value = false;
    }
  };

  /** ACTIVEなProjectだけを対象にarchive確認Dialogを開く。 */
  const openArchiveConfirm = (): void => {
    if (!canUpdateProject.value) {
      errorMessages.value = ["Projectをアーカイブするpermissionがありません。"];
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    isArchiveConfirmOpen.value = true;
  };

  /** archive実行中でない場合だけ確認Dialogを閉じる。 */
  const closeArchiveConfirm = (): void => {
    if (!isArchivingProject.value) {
      isArchiveConfirmOpen.value = false;
    }
  };

  /** Projectを現在versionでarchiveし、親Boardを即座に参照専用へ切り替える。 */
  const archiveProject = async (): Promise<void> => {
    const current = project.value;
    if (current === null || !canUpdateProject.value || isArchivingProject.value) {
      return;
    }
    const request: ProjectUpdateRequest = {
      name: current.name,
      description: current.description,
      status: "ARCHIVED",
      version: current.version,
    };

    isArchivingProject.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updatedProject = await ProjectApi.updateProject(
        current.projectId,
        request
      );
      isArchiveConfirmOpen.value = false;
      applyProjectDetail(updatedProject);
      successMessage.value = "Projectをアーカイブしました。";
    } catch (error: unknown) {
      isArchiveConfirmOpen.value = false;
      await handleApiError(error, "Projectをアーカイブできませんでした。");
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict();
      }
    } finally {
      isArchivingProject.value = false;
    }
  };

  /** 入力した有効アカウントを選択roleでProjectへ追加する。 */
  const addMember = async (): Promise<void> => {
    const current = project.value;
    const accountId = parseAccountId(addMemberAccountId.value);
    if (current === null || isSavingMember.value || !canManageMembers.value) {
      return;
    }
    if (accountId === null) {
      errorMessages.value = ["正の整数のアカウントIDを入力してください。"];
      return;
    }
    if (current.members.some((member) => member.accountId === accountId)) {
      errorMessages.value = ["指定したアカウントは既にProjectへ参加しています。"];
      return;
    }
    const request: ProjectMemberCreateRequest = {
      accountId,
      projectRole: addMemberRole.value,
    };

    isSavingMember.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updatedProject = await ProjectApi.addProjectMember(
        current.projectId,
        request
      );
      applyProjectDetail(updatedProject);
      addMemberAccountId.value = null;
      addMemberRole.value = "MEMBER";
      successMessage.value = `アカウントID ${accountId} をProjectへ追加しました。`;
    } catch (error: unknown) {
      await handleApiError(error, "Project memberを追加できませんでした。");
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict();
      }
    } finally {
      isSavingMember.value = false;
    }
  };

  /** 指定memberが有効なProjectの最後のOWNERか判定する。 */
  const isLastOwner = (member: ProjectMember): boolean =>
    member.projectRole === "OWNER" && ownerCount.value === 1;

  /** 指定memberが現在のSession利用者自身か判定する。 */
  const isCurrentMember = (member: ProjectMember): boolean =>
    member.accountId === userStore.memberId;

  /** member role draftが変更され、最後のOWNER規則にも違反しないか判定する。 */
  const canSaveMemberRole = (member: ProjectMember): boolean => {
    const nextRole = memberRoleDrafts.value[member.accountId];
    return (
      canManageMembers.value &&
      !isBusy.value &&
      nextRole !== undefined &&
      nextRole !== member.projectRole &&
      !(isLastOwner(member) && nextRole !== "OWNER")
    );
  };

  /** Project memberのroleをmember取得時点のversionで更新する。 */
  const saveMemberRole = async (member: ProjectMember): Promise<void> => {
    const current = project.value;
    const nextRole = memberRoleDrafts.value[member.accountId];
    if (current === null || isSavingMember.value || !canManageMembers.value) {
      return;
    }
    if (nextRole === undefined || nextRole === member.projectRole) {
      return;
    }
    if (isLastOwner(member) && nextRole !== "OWNER") {
      errorMessages.value = ["ProjectにはOWNERを1人以上残す必要があります。"];
      return;
    }
    const request: ProjectMemberUpdateRequest = {
      projectRole: nextRole,
      version: member.version,
    };

    isSavingMember.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const updatedProject = await ProjectApi.updateProjectMember(
        current.projectId,
        member.accountId,
        request
      );
      applyProjectDetail(updatedProject);
      successMessage.value = `アカウントID ${member.accountId} のProject roleを更新しました。`;
    } catch (error: unknown) {
      await handleApiError(error, "Project memberのroleを更新できませんでした。");
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict();
      }
    } finally {
      isSavingMember.value = false;
    }
  };

  /** 最後のOWNER以外を対象としてmember除外確認Dialogを開く。 */
  const openRemoveConfirm = (member: ProjectMember): void => {
    if (!canManageMembers.value) {
      errorMessages.value = ["Project memberを除外するpermissionがありません。"];
      return;
    }
    if (isLastOwner(member)) {
      errorMessages.value = ["ProjectにはOWNERを1人以上残す必要があります。"];
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    memberToRemove.value = member;
    isRemoveConfirmOpen.value = true;
  };

  /** member除外中でない場合だけ確認対象を破棄する。 */
  const closeRemoveConfirm = (): void => {
    if (!isSavingMember.value) {
      isRemoveConfirmOpen.value = false;
      memberToRemove.value = null;
    }
  };

  /**
   * 選択memberをversion条件付きで除外する。
   * 自己除外後は詳細を再取得できないため、204成功を確定結果としてProject一覧へ遷移する。
   */
  const removeMember = async (): Promise<void> => {
    const current = project.value;
    const target = memberToRemove.value;
    if (
      current === null ||
      target === null ||
      isSavingMember.value ||
      !canManageMembers.value
    ) {
      return;
    }

    isSavingMember.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await ProjectApi.removeProjectMember(
        current.projectId,
        target.accountId,
        target.version
      );
    } catch (error: unknown) {
      isRemoveConfirmOpen.value = false;
      memberToRemove.value = null;
      await handleApiError(error, "Project memberを除外できませんでした。");
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict();
      }
      isSavingMember.value = false;
      return;
    }

    isRemoveConfirmOpen.value = false;
    memberToRemove.value = null;
    if (target.accountId === userStore.memberId) {
      isDialogOpen.value = false;
      isSavingMember.value = false;
      await router.push({ name: "ProjectList" });
      return;
    }

    try {
      const updatedProject = await ProjectApi.getProject(current.projectId);
      applyProjectDetail(updatedProject);
      successMessage.value = `アカウントID ${target.accountId} をProjectから除外しました。`;
    } catch (_error: unknown) {
      // DELETEは確定済みのため再実行を促さず、最新表示の再取得だけを案内する。
      errorMessages.value = [
        "Project memberは除外されましたが、最新のProject情報を取得できませんでした。",
      ];
    } finally {
      isSavingMember.value = false;
    }
  };

  /** 409競合後にProject詳細を再取得し、古いProject／member versionを画面へ残さない。 */
  const reloadProjectAfterConflict = async (): Promise<void> => {
    const current = project.value;
    if (current === null || isLoadingLatest.value) {
      return;
    }
    isLoadingLatest.value = true;
    try {
      applyProjectDetail(await ProjectApi.getProject(current.projectId));
    } catch (_error: unknown) {
      errorMessages.value.push("最新のProject情報を再取得できませんでした。");
    } finally {
      isLoadingLatest.value = false;
    }
  };

  /** Project APIのstatusと項目エラーを、Sessionを含むDialog動作へ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof ProjectApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      isDialogOpen.value = false;
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["この操作を実行するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = ["対象のProjectまたはmemberが見つかりません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value = fieldMessages.length > 0 ? fieldMessages : [fallbackMessage];
  };

  return {
    activeSection,
    addMember,
    addMemberAccountId,
    addMemberRole,
    archiveProject,
    canAddMember,
    canManageMembers,
    canOpenSettings,
    canSaveMemberRole,
    canSaveProject,
    canUpdateProject,
    closeArchiveConfirm,
    closeDialog,
    closeRemoveConfirm,
    errorMessages,
    isArchiveConfirmOpen,
    isArchivingProject,
    isBusy,
    isCurrentMember,
    isDialogOpen,
    isLastOwner,
    isProjectActive,
    isRemoveConfirmOpen,
    isSavingMember,
    isSavingProject,
    memberRoleDrafts,
    memberToRemove,
    openArchiveConfirm,
    openDialog,
    openRemoveConfirm,
    projectForm,
    projectRoleOptions: PROJECT_ROLE_OPTIONS,
    removeMember,
    saveMemberRole,
    saveProject,
    successMessage,
  };
};
