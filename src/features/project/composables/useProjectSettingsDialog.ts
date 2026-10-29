import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from "@/features/project/constants/projectLimits";
import type {
  ProjectDetail,
  ProjectMember,
  ProjectMemberCandidate,
  ProjectMemberCreateRequest,
  ProjectMemberUpdateRequest,
  ProjectRole,
  ProjectUpdateRequest,
} from "@/features/project/types/project";
import {
  PROJECT_ERROR_CODES,
  PROJECT_RECOVERY_PRIORITY_STATUSES,
} from "@/features/project/utils/apiErrors";
import { resolveProjectMemberDisplayName } from "@/features/project/utils/projectMember";
import { canManageProject, findProjectRole } from "@/features/project/utils/projectRole";
import { isActiveProject } from "@/features/project/utils/projectStatus";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";

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

/** 参加済みのアカウントを追加しようとしたときの案内。入力欄の下と、押した後のエラーで同じ文言を使う。 */
const ALREADY_JOINED_MESSAGE = "指定したアカウントは既にProjectへ参加しています。";

/** number inputが返す文字列または数値を正の安全な整数へ変換する。 */
const parseAccountId = (value: number | string | null): number | null => {
  if (value === null || value === "") {
    return null;
  }
  const accountId = Number(value);
  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null;
};

/**
 * Project設定Dialogの部品に付ける`data-project-settings-control`属性の値。
 * `ProjectSettingsDialog.vue`はこの値で属性を付け、`useProjectSettingsDialog`は操作の後（失敗した場合も含む）に
 * 同じ値で部品を探してフォーカスを戻す。
 */
export const PROJECT_SETTINGS_CONTROL = {
  /** 基本情報の「Project名」入力欄。 */
  projectName: "project-name",
  /** 「Projectをアーカイブ」ボタン。 */
  archive: "archive",
  /** 「メンバーを追加」の「アカウントID」入力欄。 */
  addAccountId: "add-account-id",
  /** Dialog下部の「閉じる」ボタン。ほかの候補がすべて消えた・disabledのときの戻し先。 */
  close: "close",
} as const;

/**
 * メンバー一覧の行ごとのProject role選択に付ける`data-project-settings-control`属性の値を組み立てる。
 *
 * @param accountId 行のアカウントID
 * @returns `"member:{accountId}:role"`形式の属性値
 */
export const buildMemberRoleControlKey = (accountId: number): string =>
  `member:${accountId}:role`;

/**
 * Backendの文言が「最新状態を取得してください。」で終わる409のerror code（`messages.properties`の
 * `error.project.conflict.version`・`member-version`・`member`）。画面は409の後に必ず再取得するため、
 * これらのときだけ取り直し済みの案内を添える。最後のOWNER・無効なアカウント等は再取得しても状況が変わらないので添えない。
 */
const RELOAD_GUIDANCE_ERROR_CODES: ReadonlySet<string> = new Set([
  "PROJECT_VERSION_CONFLICT",
  "PROJECT_MEMBER_VERSION_CONFLICT",
  "PROJECT_MEMBER_CONFLICT",
]);

/** 409のResponseに、取り直し済みの案内を添えるerror codeが含まれるか。 */
const needsReloadGuidance = (error: ProjectApiError): boolean =>
  Array.isArray(error.errorResponse?.fieldErrors) &&
  error.errorResponse.fieldErrors.some(
    (fieldError) =>
      typeof fieldError?.errorCode === "string" &&
      RELOAD_GUIDANCE_ERROR_CODES.has(fieldError.errorCode)
  );

/** `data-project-settings-control`属性の値から、その要素を探すselectorを作る。 */
const buildProjectSettingsControlSelector = createDataAttributeSelector("data-project-settings-control");

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
  const { expireSession } = useSessionExpiry();

  const activeSection = ref<ProjectSettingsSection>("project");
  const addMemberAccountId = ref<number | string | null>(null);
  const addMemberRole = ref<ProjectRole>("MEMBER");
  /** member候補を探す語（名前・メールアドレス・ログインIDの先頭）。 */
  const memberCandidateQuery = ref("");
  /** 直前の検索で見つかったmember候補（有効でまだ参加していないアカウント、最大20件）。 */
  const memberCandidates = ref<ProjectMemberCandidate[]>([]);
  const isSearchingMemberCandidates = ref(false);
  /** 直前に検索した語。候補が0件のときに「見つかりません」を出すかの判定に使う（未検索なら空）。 */
  const searchedMemberCandidateQuery = ref("");
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

  const currentProjectRole = computed(() =>
    findProjectRole(project.value, userStore.accountId)
  );
  const canManageResource = computed(() =>
    canManageProject(userStore.hasRole("SYSTEM_ADMIN"), currentProjectRole.value)
  );
  const isProjectActive = computed(() => isActiveProject(project.value));
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
      projectForm.value.name.trim().length <= PROJECT_NAME_MAX_LENGTH &&
      projectForm.value.description.trim().length <= PROJECT_DESCRIPTION_MAX_LENGTH
  );
  /** 入力中のアカウントIDが、すでにProjectへ参加しているアカウントか。 */
  const isAddMemberAlreadyJoined = computed<boolean>(() => {
    const accountId = parseAccountId(addMemberAccountId.value);
    return (
      accountId !== null &&
      (project.value?.members.some((member) => member.accountId === accountId) ?? false)
    );
  });
  /**
   * 「追加」を押せない理由のうち、入力欄の下に出すもの。
   * 黙ってbuttonが無効になると理由が分からないため、参加済みのアカウントIDを入れた時点で示す。
   * 空欄・正の整数でない入力は、入力途中のことが多いため出さない（押せば`addMember`が案内する）。
   */
  const addMemberAccountIdError = computed<string>(() =>
    isAddMemberAlreadyJoined.value ? ALREADY_JOINED_MESSAGE : ""
  );
  const canAddMember = computed(
    () =>
      canManageMembers.value &&
      !isBusy.value &&
      parseAccountId(addMemberAccountId.value) !== null &&
      !isAddMemberAlreadyJoined.value
  );

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

  /**
   * 操作の後（失敗した場合も含む）、候補の部品へフォーカスを戻す。
   * 更新中はDialog内の入力欄とボタンをすべてdisabledにするため、押した部品からフォーカスが外れて
   * bodyへ移り、キーボードだけでは続けて操作できなくなる。
   * 候補がすべて消えた・disabledのとき（自分を降格した後など）は「閉じる」へ戻す。
   * Dialogを閉じた後（401・自己除外）は何もしない。isSaving等をfalseへ戻した後に呼ぶ。
   *
   * @param candidates `PROJECT_SETTINGS_CONTROL`または`buildMemberRoleControlKey`の値（優先順）
   */
  const restoreControlFocus = async (candidates: readonly string[]): Promise<void> => {
    if (!isDialogOpen.value) {
      return;
    }
    await focusFirstEnabledElement(
      [...candidates, PROJECT_SETTINGS_CONTROL.close].map(buildProjectSettingsControlSelector)
    );
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
      await handleApiError(error, DISPLAY_MESSAGES.project.settings.updateFailed);
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict(error);
      }
    } finally {
      isSavingProject.value = false;
    }
    await restoreControlFocus([PROJECT_SETTINGS_CONTROL.projectName]);
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
      await handleApiError(error, DISPLAY_MESSAGES.project.settings.archiveFailed);
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict(error);
      }
    } finally {
      isArchivingProject.value = false;
    }
    // archive後は「Projectをアーカイブ」が消え、入力欄は読み取り専用になるため、候補にないときは「閉じる」へ戻る。
    await restoreControlFocus([PROJECT_SETTINGS_CONTROL.archive]);
  };

  /**
   * member候補を名前・メールアドレス・ログインIDの先頭で探す。利用者は他人のアカウントIDを知らないため。
   * 空白だけの語では探さず候補を消す。
   */
  const searchMemberCandidates = async (): Promise<void> => {
    const current = project.value;
    const query = memberCandidateQuery.value.trim();
    if (current === null || !canManageMembers.value || isSearchingMemberCandidates.value) {
      return;
    }
    if (query.length === 0) {
      memberCandidates.value = [];
      searchedMemberCandidateQuery.value = "";
      return;
    }
    isSearchingMemberCandidates.value = true;
    errorMessages.value = [];
    try {
      memberCandidates.value = await ProjectApi.findMemberCandidates(current.projectId, query);
      searchedMemberCandidateQuery.value = query;
    } catch (error: unknown) {
      memberCandidates.value = [];
      searchedMemberCandidateQuery.value = "";
      await handleApiError(error, DISPLAY_MESSAGES.project.settings.memberCandidateSearchFailed);
    } finally {
      isSearchingMemberCandidates.value = false;
    }
  };

  /**
   * 候補を選び、追加するアカウントIDへ入れる。Project roleを選んで「追加」を押すと追加する。
   *
   * @param candidate 選んだmember候補
   */
  const selectMemberCandidate = (candidate: ProjectMemberCandidate): void => {
    addMemberAccountId.value = candidate.accountId;
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
      errorMessages.value = [ALREADY_JOINED_MESSAGE];
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
      // 追加したアカウントは候補ではなくなるため、検索結果を消して次の検索から始める。
      memberCandidates.value = [];
      memberCandidateQuery.value = "";
      searchedMemberCandidateQuery.value = "";
      successMessage.value = `${resolveProjectMemberDisplayName(updatedProject.members, accountId)}（ID: ${accountId}）をProjectへ追加しました。`;
    } catch (error: unknown) {
      await handleApiError(error, DISPLAY_MESSAGES.project.settings.memberAddFailed);
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict(error);
      }
    } finally {
      isSavingMember.value = false;
    }
    await restoreControlFocus([PROJECT_SETTINGS_CONTROL.addAccountId]);
  };

  /** 指定memberが有効なProjectの最後のOWNERか判定する。 */
  const isLastOwner = (member: ProjectMember): boolean =>
    member.projectRole === "OWNER" && ownerCount.value === 1;

  /** 指定memberが現在のSession利用者自身か判定する。 */
  const isCurrentMember = (member: ProjectMember): boolean =>
    member.accountId === userStore.accountId;

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
      successMessage.value = `${member.displayName}（ID: ${member.accountId}）のProject roleを更新しました。`;
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.project.settings.memberRoleUpdateFailed
      );
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict(error);
      }
    } finally {
      isSavingMember.value = false;
    }
    // 変更後は「role保存」がdisabledに戻るため、同じ行のrole選択へ戻す。
    await restoreControlFocus([
      buildMemberRoleControlKey(member.accountId),
      PROJECT_SETTINGS_CONTROL.addAccountId,
    ]);
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
      await handleApiError(error, DISPLAY_MESSAGES.project.settings.memberRemoveFailed);
      if (error instanceof ProjectApiError && error.status === 409) {
        await reloadProjectAfterConflict(error);
      }
      isSavingMember.value = false;
      await restoreControlFocus([PROJECT_SETTINGS_CONTROL.addAccountId]);
      return;
    }

    isRemoveConfirmOpen.value = false;
    memberToRemove.value = null;
    if (target.accountId === userStore.accountId) {
      isDialogOpen.value = false;
      isSavingMember.value = false;
      await router.push({ name: ROUTE_NAMES.projectList });
      return;
    }

    try {
      const updatedProject = await ProjectApi.getProject(current.projectId);
      applyProjectDetail(updatedProject);
      successMessage.value = `${target.displayName}（ID: ${target.accountId}）をProjectから除外しました。`;
    } catch (error: unknown) {
      // DELETEは確定済みのため再実行を促さず、最新表示の再取得だけを案内する。
      await handleProjectRefreshError(
        error,
        DISPLAY_MESSAGES.project.settings.memberRemovedRefreshFailed
      );
    } finally {
      isSavingMember.value = false;
    }
    // 除外した行の部品は消えるため、メンバー追加欄へ戻す。
    await restoreControlFocus([PROJECT_SETTINGS_CONTROL.addAccountId]);
  };

  /**
   * 409競合後にProject詳細を再取得し、古いProject／member versionを画面へ残さない。
   * version競合等（`RELOAD_GUIDANCE_ERROR_CODES`）で再取得できたときは、Backendの「最新状態を取得してください。」の後ろに、
   * 画面側で取り直し済みであることの案内を添える（チェックリスト・コメントの409と同じ書き方）。
   *
   * @param conflict 操作APIが返した409
   */
  const reloadProjectAfterConflict = async (conflict: ProjectApiError): Promise<void> => {
    const current = project.value;
    if (current === null || isLoadingLatest.value) {
      return;
    }
    const messagesBeforeReload = [...errorMessages.value];
    isLoadingLatest.value = true;
    try {
      applyProjectDetail(await ProjectApi.getProject(current.projectId));
      if (needsReloadGuidance(conflict)) {
        errorMessages.value = [
          ...messagesBeforeReload,
          DISPLAY_MESSAGES.project.settings.conflictReloaded,
        ];
      }
    } catch (error: unknown) {
      if (
        error instanceof ProjectApiError &&
        PROJECT_RECOVERY_PRIORITY_STATUSES.has(error.status)
      ) {
        // 再取得時点の認証・認可・公開範囲を操作時点の競合理由より優先する。
        await handleProjectRefreshError(
          error,
          DISPLAY_MESSAGES.project.settings.reloadFailed
        );
        return;
      }
      errorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.project.settings.reloadFailed,
      ];
    } finally {
      isLoadingLatest.value = false;
    }
  };

  /** Session失効時に設定・確認Dialogと古いAPIメッセージを破棄してLoginへ戻す。 */
  const handleUnauthorized = async (): Promise<void> => {
    errorMessages.value = [];
    successMessage.value = "";
    isArchiveConfirmOpen.value = false;
    isRemoveConfirmOpen.value = false;
    memberToRemove.value = null;
    isDialogOpen.value = false;
    await expireSession();
  };

  /** 競合または確定済みDELETE後の詳細再取得失敗を現在の参照状態へ変換する。 */
  const handleProjectRefreshError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof ProjectApiError)) {
      errorMessages.value = [fallbackMessage];
      return;
    }
    if (error.status === 401) {
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [DISPLAY_MESSAGES.project.readForbidden];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [DISPLAY_MESSAGES.project.projectNotFound];
      return;
    }
    errorMessages.value = [fallbackMessage];
  };

  /** Project APIのstatusと項目エラーを、Sessionを含むDialog動作へ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof ProjectApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [
        DISPLAY_MESSAGES.project.settings.operationForbidden,
      ];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [DISPLAY_MESSAGES.project.settings.resourceNotFound];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      PROJECT_ERROR_CODES,
      fallbackMessage
    );
  };

  return {
    activeSection,
    addMember,
    addMemberAccountId,
    addMemberAccountIdError,
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
    isSearchingMemberCandidates,
    memberCandidateQuery,
    memberCandidates,
    memberRoleDrafts,
    memberToRemove,
    openArchiveConfirm,
    openDialog,
    openRemoveConfirm,
    projectForm,
    searchMemberCandidates,
    searchedMemberCandidateQuery,
    selectMemberCandidate,
    projectRoleOptions: PROJECT_ROLE_OPTIONS,
    removeMember,
    saveMemberRole,
    saveProject,
    successMessage,
  };
};
