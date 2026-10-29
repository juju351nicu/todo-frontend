import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import {
  buildMemberRoleControlKey,
  PROJECT_SETTINGS_CONTROL,
  useProjectSettingsDialog,
} from "@/features/project/composables/useProjectSettingsDialog";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectApi: {
    addProjectMember: vi.fn(),
    findMemberCandidates: vi.fn(),
    getProject: vi.fn(),
    removeProjectMember: vi.fn(),
    updateProject: vi.fn(),
    updateProjectMember: vi.fn(),
  },
  roles: new Set(),
  router: { push: vi.fn() },
  userStore: {
    accountId: 2,
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
          {
            errorCode: "PROJECT_VERSION_CONFLICT",
            field: "version",
            message: "Projectが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject.mockResolvedValue(latest);
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "自分の更新";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([
      "Projectが先に更新されています。",
      "最新のProject情報を再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(dialog.projectForm.value).toEqual({
      name: "他画面更新",
      description: "設定テスト",
      version: 8,
    });
  });

  it("再取得しても状況が変わらない409（無効なアカウント）には取り直し済みの案内を添えない", async () => {
    mocks.projectApi.addProjectMember.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_MEMBER_ACCOUNT_UNAVAILABLE",
            field: "accountId",
            message: "有効なアカウントを指定してください。",
          },
        ],
      })
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.addMemberAccountId.value = 9;

    await dialog.addMember();

    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(dialog.errorMessages.value).toEqual(["有効なアカウントを指定してください。"]);
  });

  it("member versionの409で再取得できたときは取り直し済みの案内を添える", async () => {
    mocks.projectApi.updateProjectMember.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_MEMBER_VERSION_CONFLICT",
            field: "version",
            message: "Project memberが別の操作で変更されています。最新状態を取得してください。",
          },
        ],
      })
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.memberRoleDrafts.value[4] = "MANAGER";

    await dialog.saveMemberRole(project.members[2]);

    expect(dialog.errorMessages.value).toEqual([
      "Project memberが別の操作で変更されています。最新状態を取得してください。",
      "最新のProject情報を再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
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

  it("名前で探したmember候補を選ぶとアカウントIDへ入り、追加後は検索結果を消す", async () => {
    const candidate = {
      accountId: 9,
      displayName: "山田 太郎",
      email: "yamada@example.com",
      loginId: "yamada",
    };
    mocks.projectApi.findMemberCandidates.mockResolvedValue([candidate]);
    mocks.projectApi.addProjectMember.mockResolvedValue(structuredClone(project));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.memberCandidateQuery.value = "  山田 ";

    await dialog.searchMemberCandidates();

    expect(mocks.projectApi.findMemberCandidates).toHaveBeenCalledWith(5, "山田");
    expect(dialog.memberCandidates.value).toEqual([candidate]);
    expect(dialog.searchedMemberCandidateQuery.value).toBe("山田");

    dialog.selectMemberCandidate(candidate);
    expect(dialog.addMemberAccountId.value).toBe(9);
    expect(dialog.canAddMember.value).toBe(true);

    await dialog.addMember();
    expect(mocks.projectApi.addProjectMember).toHaveBeenCalledWith(5, {
      accountId: 9,
      projectRole: "MEMBER",
    });
    expect(dialog.memberCandidates.value).toEqual([]);
    expect(dialog.memberCandidateQuery.value).toBe("");
  });

  it("空白だけの語ではmember候補を探さず、検索に失敗したら候補を消して理由を出す", async () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.memberCandidateQuery.value = "　 ";
    await dialog.searchMemberCandidates();
    expect(mocks.projectApi.findMemberCandidates).not.toHaveBeenCalled();
    expect(dialog.searchedMemberCandidateQuery.value).toBe("");

    mocks.projectApi.findMemberCandidates.mockRejectedValue(new ProjectApiError(403, null));
    dialog.memberCandidateQuery.value = "山";
    await dialog.searchMemberCandidates();
    expect(dialog.memberCandidates.value).toEqual([]);
    expect(dialog.errorMessages.value).toHaveLength(1);
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

  it("参加済みのアカウントIDを入れた時点で、追加できない理由を入力欄に出す", () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);

    dialog.addMemberAccountId.value = "4";
    expect(dialog.canAddMember.value).toBe(false);
    expect(dialog.addMemberAccountIdError.value).toBe(
      "指定したアカウントは既にProjectへ参加しています。"
    );

    dialog.addMemberAccountId.value = "9";
    expect(dialog.canAddMember.value).toBe(true);
    expect(dialog.addMemberAccountIdError.value).toBe("");
  });

  it("入力途中（空欄・0）では理由を出さない", () => {
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);

    for (const value of ["", "0", null]) {
      dialog.addMemberAccountId.value = value;
      expect(dialog.canAddMember.value).toBe(false);
      expect(dialog.addMemberAccountIdError.value).toBe("");
    }
  });

  it("member取得時点のversionを使ってProject roleを更新する", async () => {
    const updated = {
      ...structuredClone(project),
      members: project.members.map((member) =>
        member.accountId === 4 ? { ...member, projectRole: "MANAGER", version: 6 } : member
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
    expect(dialog.errorMessages.value).toEqual(["ProjectにはOWNERを1人以上残す必要があります。"]);
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
    mocks.projectApi.updateProject.mockRejectedValue(new ProjectApiError(401, null));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(dialog.isDialogOpen.value).toBe(false);
  });

  it("契約済みの複数項目エラーをBackend順でtrimして表示する", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "name",
            message: " Project名を入力してください。 ",
          },
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "description",
            message: "説明は2000文字以内で入力してください。",
          },
        ],
      })
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([
      "Project名を入力してください。",
      "説明は2000文字以内で入力してください。",
    ]);
  });

  it("未知codeのBackend messageを表示せずProject更新fallbackへ閉じる", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(400, {
        fieldErrors: [
          {
            errorCode: "INTERNAL_PROJECT_DETAIL",
            field: "name",
            message: "内部Project情報を含む文言",
          },
        ],
      })
    );
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual(["Project情報を更新できませんでした。"]);
  });

  it("本文なし403はSessionを維持して操作権限不足を表示する", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(new ProjectApiError(403, null));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual(["この操作を実行するpermissionがありません。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it.each([
    [403, "Projectを参照するpermissionがありません。"],
    [404, "Projectが見つからないか、このProjectへ参加していません。"],
  ])("409回復中の%dは古い競合案内より現在の参照状態を優先する", async (status, expectedMessage) => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_VERSION_CONFLICT",
            field: "version",
            message: "Projectが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject.mockRejectedValue(new ProjectApiError(status, null));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([expectedMessage]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("409回復中の401は古い競合案内を破棄してSessionを失効させる", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_VERSION_CONFLICT",
            field: "version",
            message: "Projectが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject.mockRejectedValue(new ProjectApiError(401, null));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([]);
    expect(dialog.isDialogOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409回復の通信失敗では競合理由を維持して再取得失敗を追加する", async () => {
    mocks.projectApi.updateProject.mockRejectedValue(
      new ProjectApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_VERSION_CONFLICT",
            field: "version",
            message: "Projectが先に更新されています。",
          },
        ],
      })
    );
    mocks.projectApi.getProject.mockRejectedValue(new TypeError("network"));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.projectForm.value.name = "更新Project";

    await dialog.saveProject();

    expect(dialog.errorMessages.value).toEqual([
      "Projectが先に更新されています。",
      "最新のProject情報を再取得できませんでした。",
    ]);
  });

  it("member除外確定後の詳細取得401はSessionを破棄してLoginへ戻る", async () => {
    mocks.projectApi.getProject.mockRejectedValue(new ProjectApiError(401, null));
    const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
    dialog.openDialog();
    dialog.openRemoveConfirm(project.members[2]);

    await dialog.removeMember();

    expect(mocks.projectApi.removeProjectMember).toHaveBeenCalledWith(5, 4, 5);
    expect(dialog.errorMessages.value).toEqual([]);
    expect(dialog.isDialogOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  describe("操作後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // 更新中はDialog内の部品がすべてdisabledになりフォーカスが外れるため、操作後に探し直して戻すことを確かめる。
    // absentに入れた部品は画面にない（消えた）ものとして扱う。
    const stubDocument = (absent = []) => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => {
          const key = selector.match(/data-project-settings-control="([^"]+)"/)?.[1];
          return absent.includes(key)
            ? null
            : { focus: () => focused.push(key), matches: () => false };
        },
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("基本情報を保存した後、Project名の入力欄へ戻す", async () => {
      const focused = stubDocument();
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.projectForm.value.name = "更新Project";

      await dialog.saveProject();

      expect(focused).toEqual([PROJECT_SETTINGS_CONTROL.projectName]);
    });

    it("archiveした後は「Projectをアーカイブ」が消えるため「閉じる」へ戻す", async () => {
      mocks.projectApi.updateProject.mockResolvedValue({
        ...structuredClone(project),
        status: "ARCHIVED",
        version: 4,
      });
      const focused = stubDocument([PROJECT_SETTINGS_CONTROL.archive]);
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.openArchiveConfirm();

      await dialog.archiveProject();

      expect(focused).toEqual([PROJECT_SETTINGS_CONTROL.close]);
    });

    it("メンバーの追加に失敗した場合もアカウントIDの入力欄へ戻す", async () => {
      mocks.projectApi.addProjectMember.mockRejectedValue(new TypeError("Failed to fetch"));
      const focused = stubDocument();
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.addMemberAccountId.value = 9;

      await dialog.addMember();

      expect(focused).toEqual([PROJECT_SETTINGS_CONTROL.addAccountId]);
    });

    it("roleを保存した後、同じ行のrole選択へ戻す", async () => {
      const focused = stubDocument();
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.memberRoleDrafts.value[4] = "MANAGER";

      await dialog.saveMemberRole(project.members[2]);

      expect(focused).toEqual([buildMemberRoleControlKey(4)]);
    });

    it("他memberを除外した後は、行が消えるためアカウントIDの入力欄へ戻す", async () => {
      const focused = stubDocument();
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.openRemoveConfirm(project.members[2]);

      await dialog.removeMember();

      expect(focused).toEqual([PROJECT_SETTINGS_CONTROL.addAccountId]);
    });

    it("自分を除外してProject一覧へ戻るときは、フォーカスを動かさない", async () => {
      const focused = stubDocument();
      const dialog = useProjectSettingsDialog(projectRef, onProjectUpdated);
      dialog.openDialog();
      dialog.openRemoveConfirm(project.members[0]);

      await dialog.removeMember();

      expect(focused).toEqual([]);
    });
  });
});
