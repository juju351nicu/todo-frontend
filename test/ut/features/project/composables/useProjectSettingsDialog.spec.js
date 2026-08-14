import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import { useProjectSettingsDialog } from "@/features/project/composables/useProjectSettingsDialog";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectApi: {
    addProjectMember: vi.fn(),
    getProject: vi.fn(),
    removeProjectMember: vi.fn(),
    updateProject: vi.fn(),
    updateProjectMember: vi.fn(),
  },
  roles: new Set(),
  router: { push: vi.fn() },
  userStore: {
    memberId: 2,
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
    hasRole: vi.fn((code) => mocks.roles.has(code)),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  return { ...actual, default: mocks.projectApi };
});

const project = {
  projectId: 5,
  projectKey: "DEMO",
  name: "開発Project",
  description: "設定テスト",
  status: "ACTIVE",
  createdBy: 2,
  createdAt: "2026-08-14T00:00:00Z",
  updatedAt: "2026-08-14T00:00:00Z",
  version: 3,
  members: [
    {
      accountId: 2,
      projectRole: "OWNER",
      joinedAt: "2026-08-14T00:00:00Z",
      assignedBy: 2,
      version: 1,
    },
    {
      accountId: 3,
      projectRole: "OWNER",
      joinedAt: "2026-08-14T00:00:00Z",
      assignedBy: 2,
      version: 2,
    },
    {
      accountId: 4,
      projectRole: "MEMBER",
      joinedAt: "2026-08-14T00:00:00Z",
      assignedBy: 2,
      version: 5,
    },
  ],
  taskStatuses: [],
};

describe("useProjectSettingsDialog", () => {
  let projectRef;
  let onProjectUpdated;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.permissions.add("PROJECT_UPDATE");
    mocks.permissions.add("PROJECT_MEMBER_UPDATE");
    mocks.roles.clear();
    mocks.router.push.mockResolvedValue(undefined);
    projectRef = ref(structuredClone(project));
    onProjectUpdated = vi.fn();
    mocks.projectApi.addProjectMember.mockResolvedValue(structuredClone(project));
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    mocks.projectApi.removeProjectMember.mockResolvedValue(undefined);
    mocks.projectApi.updateProject.mockResolvedValue({
      ...structuredClone(project),
      name: "更新Project",
      version: 4,
    });
    mocks.projectApi.updateProjectMember.mockResolvedValue(structuredClone(project));
  });

  it("OWNERはProject名と説明を現在version付きで更新する", async () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.projectForm.value.name = " 更新Project ";
    dialog.projectForm.value.description = " 更新説明 ";

    await dialog.saveProject();

    expect(mocks.projectApi.updateProject).toHaveBeenCalledWith(5, {
      name: "更新Project",
      description: "更新説明",
      status: "ACTIVE",
      version: 3,
    });
    expect(onProjectUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ name: "更新Project", version: 4 })
    );
    expect(dialog.successMessage.value).toBe("Project情報を更新しました。");
  });

  it("Project更新中の再実行ではPUT APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectApi.updateProject.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    const firstSave = dialog.saveProject();
    const secondSave = dialog.saveProject();

    expect(mocks.projectApi.updateProject).toHaveBeenCalledOnce();
    resolveRequest({ ...project, name: "更新Project", version: 4 });
    await Promise.all([firstSave, secondSave]);
  });

  it("Project更新の409競合ではBackendメッセージを表示して最新versionを再取得する", async () => {
    const latest = { ...structuredClone(project), name: "他画面更新", version: 8 };
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          { field: "version", message: "Projectが先に更新されています。" },
        ],
      })
    );
    mocks.projectApi.getProject.mockResolvedValue(latest);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "自分の更新";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([
      "Projectが先に更新されています。",
    ]);
    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(dialog.projectForm.value).toEqual({
      name: "他画面更新",
      description: "設定テスト",
      version: 8,
    });
  });

  it("Projectを現在の確定値とversionでarchiveする", async () => {
    const archived = { ...structuredClone(project), status: "ARCHIVED", version: 4 };
    mocks.projectApi.updateProject.mockResolvedValue(archived);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openArchiveConfirm();

    await dialog.archiveProject();

    expect(mocks.projectApi.updateProject).toHaveBeenCalledWith(5, {
      name: "開発Project",
      description: "設定テスト",
      status: "ARCHIVED",
      version: 3,
    });
    expect(onProjectUpdated).toHaveBeenCalledWith(archived);
    expect(dialog.isArchiveConfirmOpen.value).toBe(false);
  });

  it("正のアカウントIDとroleでProject memberを追加する", async () => {
    const updated = {
      ...structuredClone(project),
      members: [
        ...structuredClone(project.members),
        {
          accountId: 9,
          projectRole: "MANAGER",
          joinedAt: "2026-08-14T01:00:00Z",
          assignedBy: 2,
          version: 1,
        },
      ],
    };
    mocks.projectApi.addProjectMember.mockResolvedValue(updated);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.addMemberAccountId.value = "9";
    dialog.addMemberRole.value = "MANAGER";

    await dialog.addMember();

    expect(mocks.projectApi.addProjectMember).toHaveBeenCalledWith(5, {
      accountId: 9,
      projectRole: "MANAGER",
    });
    expect(onProjectUpdated).toHaveBeenCalledWith(updated);
    expect(dialog.addMemberAccountId.value).toBeNull();
  });

  it("参加済みアカウントは追加APIへ送信しない", async () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.addMemberAccountId.value = 4;

    await dialog.addMember();

    expect(mocks.projectApi.addProjectMember).not.toHaveBeenCalled();
    expect(dialog.errorMessages.value).toEqual([
      "指定したアカウントは既にProjectへ参加しています。",
    ]);
  });

  it("member取得時点のversionを使ってProject roleを更新する", async () => {
    const updated = {
      ...structuredClone(project),
      members: project.members.map((member) =>
        member.accountId === 4
          ? { ...member, projectRole: "MANAGER", version: 6 }
          : member
      ),
    };
    mocks.projectApi.updateProjectMember.mockResolvedValue(updated);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.memberRoleDrafts.value[4] = "MANAGER";

    await dialog.saveMemberRole(project.members[2]);

    expect(mocks.projectApi.updateProjectMember).toHaveBeenCalledWith(5, 4, {
      projectRole: "MANAGER",
      version: 5,
    });
    expect(onProjectUpdated).toHaveBeenCalledWith(updated);
  });

  it("最後のOWNERはFrontendでも降格・除外APIを送信しない", async () => {
    projectRef.value = {
      ...structuredClone(project),
      members: [structuredClone(project.members[0]), structuredClone(project.members[2])],
    };
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    const owner = projectRef.value.members[0];
    dialog.memberRoleDrafts.value[owner.accountId] = "MEMBER";

    await dialog.saveMemberRole(owner);
    dialog.openRemoveConfirm(owner);

    expect(mocks.projectApi.updateProjectMember).not.toHaveBeenCalled();
    expect(dialog.isRemoveConfirmOpen.value).toBe(false);
    expect(dialog.errorMessages.value).toEqual([
      "ProjectにはOWNERを1人以上残す必要があります。",
    ]);
  });

  it("別OWNERがいる場合は自己除外の204成功後に詳細を再取得せずProject一覧へ戻る", async () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.openRemoveConfirm(project.members[0]);

    await dialog.removeMember();

    expect(mocks.projectApi.removeProjectMember).toHaveBeenCalledWith(5, 2, 1);
    expect(mocks.projectApi.getProject).not.toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "ProjectList" });
    expect(dialog.isDialogOpen.value).toBe(false);
  });

  it("他member除外の204成功後は最新Projectを再取得する", async () => {
    const updated = {
      ...structuredClone(project),
      members: project.members.filter((member) => member.accountId !== 4),
    };
    mocks.projectApi.getProject.mockResolvedValue(updated);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openRemoveConfirm(project.members[2]);

    await dialog.removeMember();

    expect(mocks.projectApi.removeProjectMember).toHaveBeenCalledWith(5, 4, 5);
    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(onProjectUpdated).toHaveBeenCalledWith(updated);
  });

  it("archive済みProjectは設定を参照できるが更新APIを実行できない", async () => {
    projectRef.value = { ...structuredClone(project), status: "ARCHIVED" };
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "変更不可";

    await dialog.saveProject();
    await dialog.addMember();

    expect(dialog.canOpenSettings.value).toBe(true);
    expect(dialog.canUpdateProject.value).toBe(false);
    expect(dialog.canManageMembers.value).toBe(false);
    expect(mocks.projectApi.updateProject).not.toHaveBeenCalled();
    expect(mocks.projectApi.addProjectMember).not.toHaveBeenCalled();
  });

  it("401ではSession表示を破棄してLoginへ戻る", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(401, null)
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(dialog.isDialogOpen.value).toBe(false);
  });
});
