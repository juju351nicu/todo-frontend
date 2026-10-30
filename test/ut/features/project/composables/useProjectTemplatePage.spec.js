import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTemplateApiError } from "@/features/project/api/projectTemplateApi";
import {
  PROJECT_TEMPLATE_CONTROL,
  buildTemplateItemControlKey,
  useProjectTemplatePage,
} from "@/features/project/composables/useProjectTemplatePage";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectTemplateApi: {
    apply: vi.fn(),
    archive: vi.fn(),
    findOwnTemplates: vi.fn(),
    getOwnTemplate: vi.fn(),
    update: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: {
    accountId: 7,
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectTemplateApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectTemplateApi");
  return { ...actual, default: mocks.projectTemplateApi };
});

const summary = {
  projectTemplateId: 81,
  name: "開発Template",
  description: "開発用の雛形",
  baseDate: "2026-09-21",
  sourceProjectId: 5,
  createdAt: "2026-09-21T01:00:00Z",
  updatedAt: "2026-09-21T01:00:00Z",
  version: 1,
};
const template = {
  ...summary,
  memberSlots: [
    {
      slotKey: "OWNER_1",
      displayName: "OWNER 1",
      projectRole: "OWNER",
      position: 1000,
    },
    {
      slotKey: "MEMBER_1",
      displayName: "MEMBER 1",
      projectRole: "MEMBER",
      position: 2000,
    },
  ],
  statuses: [
    {
      statusCode: "TODO",
      name: "未着手",
      position: 1000,
      completed: false,
    },
  ],
  tasks: [
    {
      projectTemplateTaskId: 91,
      parentProjectTemplateTaskId: null,
      assigneeSlotKey: "OWNER_1",
      statusCode: "TODO",
      taskType: "TASK",
      wbsCode: "1",
      title: "API実装",
      detail: "Controllerからテストまで",
      priority: 3,
      plannedEffortMinutes: 480,
      startOffsetDays: 0,
      dueOffsetDays: 2,
      position: 1000,
      checklistItems: [],
    },
  ],
  dependencies: [],
};

describe("useProjectTemplatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.permissions.add("PROJECT_READ");
    mocks.permissions.add("PROJECT_CREATE");
    mocks.permissions.add("PROJECT_UPDATE");
    mocks.userStore.accountId = 7;
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectTemplateApi.findOwnTemplates.mockResolvedValue([structuredClone(summary)]);
    mocks.projectTemplateApi.getOwnTemplate.mockResolvedValue(structuredClone(template));
    mocks.projectTemplateApi.update.mockImplementation((_id, request) =>
      Promise.resolve({ ...structuredClone(template), ...request, version: 2 })
    );
    mocks.projectTemplateApi.archive.mockResolvedValue(undefined);
    mocks.projectTemplateApi.apply.mockResolvedValue({ projectId: 99 });
  });

  it("Project開始日の初期値は、端末のタイムゾーンによらず業務日（Asia/Tokyo）の今日にする", () => {
    // 日本時間では10月30日0時30分、UTCではまだ10月29日。端末のタイムゾーンで「今日」を決めると1日ずれる。
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T15:30:00Z"));
    try {
      const page = useProjectTemplatePage();

      expect(page.applyForm.value.projectStartDate).toBe("2026-10-30");
    } finally {
      vi.useRealTimers();
    }
  });

  it("初期表示で本人所有一覧と先頭snapshot詳細を取得する", async () => {
    const page = useProjectTemplatePage();

    await page.initialize();

    expect(mocks.projectTemplateApi.findOwnTemplates).toHaveBeenCalledOnce();
    expect(mocks.projectTemplateApi.getOwnTemplate).toHaveBeenCalledWith(81);
    expect(page.selectedTemplate.value).toEqual(template);
    expect(page.applyForm.value.memberMappings).toEqual({
      OWNER_1: 7,
      MEMBER_1: null,
    });
  });

  it("headerだけをtrim済みの現在versionで更新する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();
    page.editForm.value.name = "  改訂Template  ";
    page.editForm.value.description = "  新しい説明  ";

    await page.saveTemplate();

    expect(mocks.projectTemplateApi.update).toHaveBeenCalledWith(81, {
      name: "改訂Template",
      description: "新しい説明",
      version: 1,
    });
    expect(page.templates.value[0].name).toBe("改訂Template");
    expect(page.selectedTemplate.value.version).toBe(2);
    expect(page.isEditing.value).toBe(false);
  });

  it("大文字Project keyと重複のないslot mappingからProjectを生成しBoardへ遷移する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "new-project";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.projectStartDate = "2026-10-01";
    page.applyForm.value.memberMappings.MEMBER_1 = 8;

    await page.applyTemplate();

    expect(mocks.projectTemplateApi.apply).toHaveBeenCalledWith(81, {
      projectKey: "NEW-PROJECT",
      name: "新Project",
      projectStartDate: "2026-10-01",
      memberMappings: [
        { slotKey: "OWNER_1", accountId: 7 },
        { slotKey: "MEMBER_1", accountId: 8 },
      ],
    });
    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 99 },
    });
  });

  it("OWNER_1が未入力ならSessionの本人accountを割り当てる", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "NEW-PROJECT";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.memberMappings.OWNER_1 = null;
    page.applyForm.value.memberMappings.MEMBER_1 = 8;

    await page.applyTemplate();

    expect(mocks.projectTemplateApi.apply).toHaveBeenCalledWith(
      81,
      expect.objectContaining({
        memberMappings: [
          { slotKey: "OWNER_1", accountId: 7 },
          { slotKey: "MEMBER_1", accountId: 8 },
        ],
      })
    );
  });

  it("存在しないProject開始日はAPI送信前に拒否する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "NEW-PROJECT";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.projectStartDate = "2026-02-30";
    page.applyForm.value.memberMappings.MEMBER_1 = 8;

    await page.applyTemplate();

    expect(mocks.projectTemplateApi.apply).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Project開始日を正しく入力してください。"]);
  });

  it("同じaccountの複数slot割当はAPI送信前に拒否する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "NEW-PROJECT";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.memberMappings.MEMBER_1 = 7;

    await page.applyTemplate();

    expect(mocks.projectTemplateApi.apply).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "同じアカウントを複数のmember slotへ割り当てることはできません。",
    ]);
  });

  it("archive成功後はactive一覧と選択から除外する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.openArchiveConfirm();

    await page.archiveTemplate();

    expect(mocks.projectTemplateApi.archive).toHaveBeenCalledWith(81, 1);
    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
    expect(page.isArchiveConfirmOpen.value).toBe(false);
  });

  it("409競合では編集draftを破棄して最新一覧・snapshotを再取得する", async () => {
    const latestSummary = { ...summary, name: "別tab更新", version: 2 };
    const latest = { ...template, ...latestSummary };
    mocks.projectTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(summary)])
      .mockResolvedValueOnce([latestSummary]);
    mocks.projectTemplateApi.getOwnTemplate
      .mockResolvedValueOnce(structuredClone(template))
      .mockResolvedValueOnce(latest);
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "PROJECT_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();
    page.editForm.value.name = "古いdraft";

    await page.saveTemplate();

    expect(mocks.projectTemplateApi.findOwnTemplates).toHaveBeenCalledTimes(2);
    expect(mocks.projectTemplateApi.getOwnTemplate).toHaveBeenCalledTimes(2);
    expect(page.selectedTemplate.value.name).toBe("別tab更新");
    expect(page.isEditing.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "別の操作で更新されました。",
      "最新のProject Templateを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
  });

  it.each([
    ["PROJECT_KEY_CONFLICT", "projectKey", "同じProjectキーが既に使用されています。"],
    [
      "PROJECT_TEMPLATE_MEMBER_MAPPING_INVALID",
      "memberMappings",
      "Project Templateのmember割当を適用できません。割当内容を確認してください。",
    ],
  ])(
    "作成の409（%s）は入力の誤りなので、取り直さず入力を残して作成ボタンの上に出す",
    async (errorCode, field, message) => {
      mocks.projectTemplateApi.apply.mockRejectedValue(
        new ProjectTemplateApiError(409, { fieldErrors: [{ field, errorCode, message }] })
      );
      const page = useProjectTemplatePage();
      await page.initialize();
      page.applyForm.value.projectKey = "DEMO";
      page.applyForm.value.name = "入力したProject名";
      page.applyForm.value.memberMappings.MEMBER_1 = 8;

      await page.applyTemplate();

      expect(page.errorMessages.value).toEqual([message]);
      expect(page.isApplyFeedback.value).toBe(true);
      expect(mocks.projectTemplateApi.findOwnTemplates).toHaveBeenCalledOnce();
      expect(page.applyForm.value).toMatchObject({
        projectKey: "DEMO",
        name: "入力したProject名",
        memberMappings: { OWNER_1: 7, MEMBER_1: 8 },
      });
    }
  );

  it("作成の入力チェックのエラーは作成ボタンの上に、その後の編集のエラーは画面の上部に出す", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "";

    await page.applyTemplate();
    expect(page.isApplyFeedback.value).toBe(true);

    page.beginEditing();
    page.editForm.value.name = " ";
    await page.saveTemplate();
    expect(page.errorMessages.value).toEqual(["Template名を1〜100文字で入力してください。"]);
    expect(page.isApplyFeedback.value).toBe(false);
  });

  it("archive済みで作成できない409は、作成フォームがなくなるので画面の上部に出す", async () => {
    mocks.projectTemplateApi.apply.mockRejectedValue(
      new ProjectTemplateApiError(409, {
        fieldErrors: [
          {
            field: "projectTemplateId",
            errorCode: "PROJECT_TEMPLATE_ARCHIVED",
            message: "archive済みProject Templateは変更または適用できません。",
          },
        ],
      })
    );
    mocks.projectTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(summary)])
      .mockResolvedValueOnce([]);
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "DEMO";
    page.applyForm.value.memberMappings.MEMBER_1 = 8;

    await page.applyTemplate();

    expect(page.selectedTemplate.value).toBeNull();
    expect(page.isApplyFeedback.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "archive済みProject Templateは変更または適用できません。",
    ]);
  });

  describe("操作後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // absentに入れた部品は画面にない（消えた）ものとして扱う。
    const stubDocument = (absent = []) => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => {
          const key = selector.match(/data-project-template-control="([^"]+)"/)?.[1];
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

    it("編集を始めるとTemplate名へ、キャンセルすると「編集」へ移す", async () => {
      const page = useProjectTemplatePage();
      await page.initialize();
      const focused = stubDocument();

      page.beginEditing();
      await Promise.resolve();
      page.cancelEditing();
      await vi.waitFor(() => expect(focused).toHaveLength(2));

      expect(focused).toEqual([
        PROJECT_TEMPLATE_CONTROL.editName,
        PROJECT_TEMPLATE_CONTROL.editButton,
      ]);
    });

    it("保存できた後は、編集フォームが閉じるので「編集」へ戻す", async () => {
      const page = useProjectTemplatePage();
      await page.initialize();
      page.beginEditing();
      const focused = stubDocument([PROJECT_TEMPLATE_CONTROL.editName]);

      await page.saveTemplate();

      expect(focused).toContain(PROJECT_TEMPLATE_CONTROL.editButton);
    });

    it("作成に失敗したら作成ボタンへ戻す", async () => {
      mocks.projectTemplateApi.apply.mockRejectedValue(new TypeError("Failed to fetch"));
      const page = useProjectTemplatePage();
      await page.initialize();
      page.applyForm.value.projectKey = "DEMO";
      page.applyForm.value.memberMappings.MEMBER_1 = 8;
      const focused = stubDocument();

      await page.applyTemplate();

      expect(focused).toEqual([PROJECT_TEMPLATE_CONTROL.applyButton]);
    });

    it("archiveの後は、次に表示したTemplateの「編集」か一覧の先頭へ戻す", async () => {
      const next = { ...summary, projectTemplateId: 82, name: "次のTemplate" };
      mocks.projectTemplateApi.findOwnTemplates.mockResolvedValue([structuredClone(summary), next]);
      const page = useProjectTemplatePage();
      await page.initialize();
      page.openArchiveConfirm();
      const focused = stubDocument([PROJECT_TEMPLATE_CONTROL.editButton]);

      await page.archiveTemplate();

      expect(focused).toEqual([buildTemplateItemControlKey(82)]);
    });
  });

  it("一覧の本文なし403はSessionを維持して参照permission不足を表示する", async () => {
    mocks.projectTemplateApi.findOwnTemplates.mockRejectedValue(
      new ProjectTemplateApiError(403, null)
    );
    const page = useProjectTemplatePage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual([
      "Project Templateを参照するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("一覧の未知codeはBackend本文を表示せず一覧fallbackへ閉じる", async () => {
    mocks.projectTemplateApi.findOwnTemplates.mockRejectedValue(
      new ProjectTemplateApiError(500, {
        fieldErrors: [
          {
            field: "exception",
            errorCode: "INTERNAL_DETAIL",
            message: "内部例外とpathを含む文言",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual(["Project Template一覧を取得できませんでした。"]);
  });

  it("機能資格403だけはBackendのupgrade案内を表示する", async () => {
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(403, {
        fieldErrors: [
          {
            field: "featureCode",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "現在のPlanでは利用できません。",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessages.value).toEqual(["現在のPlanでは利用できません。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("featureCode以外の資格codeはupgrade案内にせずpermission不足を表示する", async () => {
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(403, {
        fieldErrors: [
          {
            field: "permission",
            errorCode: "FEATURE_NOT_ENTITLED",
            message: "誤ったfieldの案内",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessages.value).toEqual([
      "Project Templateを操作するpermissionがありません。",
    ]);
  });

  it("契約済みの複数入力エラーをBackend順で表示する", async () => {
    mocks.projectTemplateApi.apply.mockRejectedValue(
      new ProjectTemplateApiError(400, {
        fieldErrors: [
          {
            field: "projectKey",
            errorCode: "INVALID_REQUEST_BODY",
            message: "Projectキーを確認してください。",
          },
          {
            field: "memberMappings",
            errorCode: "INVALID_REQUEST_BODY",
            message: "member mappingを確認してください。",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "NEW-PROJECT";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.memberMappings.MEMBER_1 = 8;

    await page.applyTemplate();

    expect(page.errorMessages.value).toEqual([
      "Projectキーを確認してください。",
      "member mappingを確認してください。",
    ]);
  });

  it("409回復中の401は競合案内とsnapshotを破棄してLoginへ戻す", async () => {
    mocks.projectTemplateApi.getOwnTemplate
      .mockResolvedValueOnce(structuredClone(template))
      .mockRejectedValueOnce(new ProjectTemplateApiError(401, null));
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "PROJECT_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessages.value).toEqual([]);
    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it.each([
    [403, "Project Templateを参照するpermissionがありません。"],
    [404, "対象のProjectまたはProject Templateが見つかりません。"],
  ])("409回復中の%sは古い競合案内より現在の参照状態を優先する", async (status, expectedMessage) => {
    mocks.projectTemplateApi.getOwnTemplate
      .mockResolvedValueOnce(structuredClone(template))
      .mockRejectedValueOnce(new ProjectTemplateApiError(status, null));
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "PROJECT_TEMPLATE_VERSION_CONFLICT",
            message: "古い競合案内",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessages.value).toEqual([expectedMessage]);
    expect(page.selectedTemplate.value).toBeNull();
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("409回復の通信失敗では競合理由を維持して再取得失敗を追加する", async () => {
    mocks.projectTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(summary)])
      .mockRejectedValueOnce(new TypeError("network"));
    mocks.projectTemplateApi.update.mockRejectedValue(
      new ProjectTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "PROJECT_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で更新されました。",
          },
        ],
      })
    );
    const page = useProjectTemplatePage();
    await page.initialize();
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessages.value).toEqual([
      "別の操作で更新されました。",
      "最新のProject Templateを再取得できませんでした。再読込してください。",
    ]);
    expect(page.selectedTemplate.value).toBeNull();
  });

  it("archive確定後の次Template詳細取得401は成功案内を残さずLoginへ戻す", async () => {
    const secondSummary = { ...summary, projectTemplateId: 82, name: "次Template" };
    mocks.projectTemplateApi.findOwnTemplates.mockResolvedValue([
      structuredClone(summary),
      secondSummary,
    ]);
    mocks.projectTemplateApi.getOwnTemplate
      .mockResolvedValueOnce(structuredClone(template))
      .mockRejectedValueOnce(new ProjectTemplateApiError(401, null));
    const page = useProjectTemplatePage();
    await page.initialize();
    page.openArchiveConfirm();

    await page.archiveTemplate();

    expect(page.successMessage.value).toBe("");
    expect(page.errorMessages.value).toEqual([]);
    expect(page.templates.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.projectTemplateApi.findOwnTemplates.mockRejectedValue(
      new ProjectTemplateApiError(401, null)
    );
    const page = useProjectTemplatePage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.errorMessages.value).toEqual([]);
  });
});
