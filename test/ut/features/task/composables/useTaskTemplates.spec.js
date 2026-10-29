import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskTemplateApiError } from "@/features/task/api/taskTemplateApi";
import { useTaskTemplates } from "@/features/task/composables/useTaskTemplates";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskTemplateApi: {
    apply: vi.fn(),
    archive: vi.fn(),
    findOwnTemplates: vi.fn(),
    update: vi.fn(),
  },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskTemplateApi", async () => {
  const actual = await vi.importActual("@/features/task/api/taskTemplateApi");
  return { ...actual, default: mocks.taskTemplateApi };
});

const template = {
  taskTemplateId: 81,
  name: "API実装",
  title: "APIを実装する",
  detail: "Controllerからテストまで実装する",
  priority: 3,
  dueOffsetDays: 2,
  plannedEffortMinutes: 480,
  defaultStatusCode: "TODO",
  defaultAssigneeAccountId: 7,
  sourceProjectId: 5,
  sourceTaskId: 31,
  checklistItems: [{ content: "テストを追加", position: 1000 }],
  createdAt: "2026-09-21T01:00:00Z",
  updatedAt: "2026-09-21T01:00:00Z",
  version: 0,
};
const createdTask = {
  taskId: 91,
  projectId: 5,
  taskStatusId: 11,
  title: template.title,
  detail: template.detail,
  dateFrom: "2026-09-21",
  dateTo: "2026-09-23",
  assigneeAccountId: 7,
  priority: 3,
  position: 1000,
  archived: false,
  createdBy: 7,
  createdAt: "2026-09-21T01:00:00Z",
  updatedAt: "2026-09-21T01:00:00Z",
  version: 0,
};

const createPage = () => useTaskTemplates(ref(5));

describe("useTaskTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskTemplateApi.findOwnTemplates.mockResolvedValue([structuredClone(template)]);
    mocks.taskTemplateApi.update.mockImplementation((_id, request) =>
      Promise.resolve({ ...template, ...request, version: 1 })
    );
    mocks.taskTemplateApi.archive.mockResolvedValue(undefined);
    mocks.taskTemplateApi.apply.mockResolvedValue(createdTask);
  });

  it("適用日の初期値は、端末のタイムゾーンによらず業務日（Asia/Tokyo）の今日にする", () => {
    // 日本時間では10月30日0時30分、UTCではまだ10月29日。端末のタイムゾーンで「今日」を決めると1日ずれる。
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T15:30:00Z"));
    try {
      const page = createPage();

      expect(page.applyDateFrom.value).toBe("2026-10-30");
    } finally {
      vi.useRealTimers();
    }
  });

  it("本人所有Templateを取得して一覧へ反映する", async () => {
    const page = createPage();

    await page.loadTemplates();

    expect(page.templates.value).toEqual([template]);
  });

  it("選択Templateを独立フォームへ複製しtrim済みsnapshotで更新する", async () => {
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();
    page.editForm.value.name = "  API実装 改  ";
    page.editForm.value.checklistContents = ["  テストを追加  "];

    await page.saveTemplate();

    expect(mocks.taskTemplateApi.update).toHaveBeenCalledWith(
      81,
      expect.objectContaining({
        name: "API実装 改",
        checklistItems: [{ content: "テストを追加" }],
        version: 0,
      })
    );
    expect(page.templates.value[0].version).toBe(1);
    expect(page.isEditing.value).toBe(false);
  });

  it("選択Templateと適用上書き値から通常Taskを生成する", async () => {
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.applyDateFrom.value = "2026-09-22";
    page.applyAssigneeAccountId.value = 8;
    page.applyTaskStatusId.value = 12;

    await expect(page.applyTemplate()).resolves.toEqual(createdTask);
    expect(mocks.taskTemplateApi.apply).toHaveBeenCalledWith(5, {
      taskTemplateId: 81,
      dateFrom: "2026-09-22",
      assigneeAccountId: 8,
      taskStatusId: 12,
    });
  });

  it("archive成功後に選択Templateを一覧から除外する", async () => {
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);

    await page.archiveTemplate();

    expect(mocks.taskTemplateApi.archive).toHaveBeenCalledWith(81, 0);
    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
  });

  it("409競合では編集状態を破棄して最新一覧を再取得する", async () => {
    const latest = { ...template, title: "別画面の更新", version: 1 };
    mocks.taskTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(template)])
      .mockResolvedValueOnce([latest]);
    mocks.taskTemplateApi.update.mockRejectedValue(
      new TaskTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "TASK_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();

    await page.saveTemplate();

    expect(mocks.taskTemplateApi.findOwnTemplates).toHaveBeenCalledTimes(2);
    expect(page.templates.value).toEqual([latest]);
    expect(page.isEditing.value).toBe(false);
    expect(page.errorMessage.value).toBe("別の操作で変更されました。");
  });

  it("一覧のpermission 403では固定文言を表示して取得済みTemplateを破棄する", async () => {
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    mocks.taskTemplateApi.findOwnTemplates.mockRejectedValue(new TaskTemplateApiError(403, null));

    await page.loadTemplates();

    expect(page.errorMessage.value).toBe("Task Templateを参照するpermissionがありません。");
    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("404のBackend文言を表示せず固定文言で最新一覧へ回復する", async () => {
    mocks.taskTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(template)])
      .mockResolvedValueOnce([structuredClone(template)]);
    mocks.taskTemplateApi.update.mockRejectedValue(
      new TaskTemplateApiError(404, {
        fieldErrors: [
          {
            field: "taskTemplateId",
            errorCode: "TASK_TEMPLATE_NOT_FOUND",
            message: "所有者情報を含む表示禁止文言",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessage.value).toBe(
      "対象のProject、TaskまたはTask Templateが見つかりません。"
    );
    expect(page.selectedTemplate.value.taskTemplateId).toBe(81);
    expect(page.isEditing.value).toBe(false);
  });

  it("未知error codeではBackend文言を表示せず更新固定文言へfallbackする", async () => {
    mocks.taskTemplateApi.update.mockRejectedValue(
      new TaskTemplateApiError(400, {
        fieldErrors: [
          {
            field: "name",
            errorCode: "UNKNOWN_TEMPLATE_ERROR",
            message: "内部構造を含む未契約メッセージ",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessage.value).toBe("Task Templateを更新できませんでした。");
  });

  it("409回復中の401では古いTemplateを破棄してLoginへ戻す", async () => {
    mocks.taskTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(template)])
      .mockRejectedValueOnce(new TaskTemplateApiError(401, null));
    mocks.taskTemplateApi.update.mockRejectedValue(
      new TaskTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "TASK_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();

    await page.saveTemplate();

    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409回復中の通信失敗では競合理由と再取得失敗を併記する", async () => {
    mocks.taskTemplateApi.findOwnTemplates
      .mockResolvedValueOnce([structuredClone(template)])
      .mockRejectedValueOnce(new TypeError("Network error"));
    mocks.taskTemplateApi.update.mockRejectedValue(
      new TaskTemplateApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "TASK_TEMPLATE_VERSION_CONFLICT",
            message: "別の操作で変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await page.loadTemplates();
    page.selectTemplate(page.templates.value[0]);
    page.beginEditing();

    await page.saveTemplate();

    expect(page.errorMessage.value).toBe(
      "別の操作で変更されました。\n最新のTask Template一覧を取得できませんでした。再読込してください。"
    );
    expect(page.templates.value).toEqual([]);
    expect(page.selectedTemplate.value).toBeNull();
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskTemplateApi.findOwnTemplates.mockRejectedValue(new TaskTemplateApiError(401, null));
    const page = createPage();

    await page.loadTemplates();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
