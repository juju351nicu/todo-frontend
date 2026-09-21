import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTemplateApiError } from "@/features/project/api/projectTemplateApi";
import { useProjectTemplatePage } from "@/features/project/composables/useProjectTemplatePage";

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
    memberId: 7,
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectTemplateApi", async () => {
  const actual = await vi.importActual(
    "@/features/project/api/projectTemplateApi"
  );
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
      name: "Todo",
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
    mocks.userStore.memberId = 7;
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectTemplateApi.findOwnTemplates.mockResolvedValue([
      structuredClone(summary),
    ]);
    mocks.projectTemplateApi.getOwnTemplate.mockResolvedValue(
      structuredClone(template)
    );
    mocks.projectTemplateApi.update.mockImplementation((_id, request) =>
      Promise.resolve({ ...structuredClone(template), ...request, version: 2 })
    );
    mocks.projectTemplateApi.archive.mockResolvedValue(undefined);
    mocks.projectTemplateApi.apply.mockResolvedValue({ projectId: 99 });
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
    expect(page.errorMessage.value).toContain("Project開始日");
  });

  it("同じaccountの複数slot割当はAPI送信前に拒否する", async () => {
    const page = useProjectTemplatePage();
    await page.initialize();
    page.applyForm.value.projectKey = "NEW-PROJECT";
    page.applyForm.value.name = "新Project";
    page.applyForm.value.memberMappings.MEMBER_1 = 7;

    await page.applyTemplate();

    expect(mocks.projectTemplateApi.apply).not.toHaveBeenCalled();
    expect(page.errorMessage.value).toContain("同じアカウント");
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
    expect(page.errorMessage.value).toBe("別の操作で更新されました。");
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.projectTemplateApi.findOwnTemplates.mockRejectedValue(
      new ProjectTemplateApiError(401, null)
    );
    const page = useProjectTemplatePage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
