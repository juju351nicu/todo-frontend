import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import { useTaskBoardPage } from "@/features/task/composables/useTaskBoardPage";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectApi: { getProject: vi.fn(), getTaskBoard: vi.fn() },
  projectTaskApi: {
    createTask: vi.fn(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
  },
  route: { params: { projectId: "5" } },
  router: { push: vi.fn() },
  userStore: {
    memberId: 2,
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
    hasRole: vi.fn(() => false),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/task/api/projectTaskApi", async () => {
  const actual = await vi.importActual("@/features/task/api/projectTaskApi");
  return { ...actual, default: mocks.projectTaskApi };
});

const project = {
  projectId: 5,
  projectKey: "DEMO",
  name: "開発Project",
  description: "Boardテスト",
  status: "ACTIVE",
  projectRole: "MEMBER",
  createdBy: 1,
  createdAt: "2026-08-14T00:00:00Z",
  updatedAt: "2026-08-14T00:00:00Z",
  version: 1,
  members: [
    {
      accountId: 2,
      projectRole: "MEMBER",
      joinedAt: "2026-08-14T00:00:00Z",
      assignedBy: 1,
      version: 1,
    },
  ],
  taskStatuses: [
    {
      taskStatusId: 11,
      statusCode: "TODO",
      name: "Todo",
      position: 1024,
      completed: false,
      version: 1,
    },
  ],
};

const task = {
  taskId: 31,
  projectId: 5,
  taskStatusId: 11,
  title: "既存Task",
  detail: "詳細",
  dateFrom: "2026-08-14",
  dateTo: "2026-08-15",
  assigneeAccountId: 2,
  priority: 2,
  position: 1024,
  archived: false,
  createdBy: 2,
  createdAt: "2026-08-14T00:00:00Z",
  updatedAt: "2026-08-14T00:00:00Z",
  version: 4,
};

const board = {
  projectId: 5,
  projectName: "開発Project",
  columns: [{ ...project.taskStatuses[0], tasks: [task] }],
};

describe("useTaskBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.permissions.add("TASK_READ");
    mocks.permissions.add("TASK_CREATE");
    mocks.permissions.add("TASK_UPDATE");
    mocks.route.params.projectId = "5";
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectApi.getProject.mockResolvedValue(project);
    mocks.projectApi.getTaskBoard.mockResolvedValue(board);
    mocks.projectTaskApi.getTask.mockResolvedValue(task);
    mocks.projectTaskApi.createTask.mockResolvedValue(task);
    mocks.projectTaskApi.updateTask.mockResolvedValue({ ...task, version: 5 });
  });

  it("初期表示でProject詳細とBoardを並行取得する", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(mocks.projectApi.getProject).toHaveBeenCalledWith(5);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledWith(5);
    expect(page.project.value).toEqual(project);
    expect(page.board.value).toEqual(board);
  });

  it("列の追加操作から担当者・日付・配置先を初期設定してTaskを登録する", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    page.openTaskCreator(11);
    page.form.value.title = "新規Task";
    page.form.value.detail = "実装する";

    await page.saveTask();

    expect(mocks.projectTaskApi.createTask).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        title: "新規Task",
        detail: "実装する",
        assigneeAccountId: 2,
        taskStatusId: 11,
        priority: 2,
      })
    );
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.isEditorOpen.value).toBe(false);
  });

  it("Task詳細取得時点のversionを使い、列を含めず更新する", async () => {
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.form.value.title = "更新Task";

    await page.saveTask();

    expect(mocks.projectTaskApi.getTask).toHaveBeenCalledWith(5, 31);
    expect(mocks.projectTaskApi.updateTask).toHaveBeenCalledWith(5, 31, {
      title: "更新Task",
      detail: "詳細",
      dateFrom: "2026-08-14",
      dateTo: "2026-08-15",
      assigneeAccountId: 2,
      priority: 2,
      version: 4,
    });
  });

  it("保存中の再実行ではTask APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectTaskApi.updateTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    const firstSave = page.saveTask();
    const secondSave = page.saveTask();

    expect(mocks.projectTaskApi.updateTask).toHaveBeenCalledOnce();
    resolveRequest(task);
    await Promise.all([firstSave, secondSave]);
  });

  it("409競合ではBackendメッセージを表示しDialogを閉じて最新Boardを再取得する", async () => {
    mocks.projectTaskApi.updateTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          { field: "version", message: "他の操作で更新されています。" },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);

    await page.saveTask();

    expect(page.errorMessages.value).toEqual(["他の操作で更新されています。"]);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.projectApi.getProject.mockRejectedValue(new ProjectApiError(401, null));
    const page = useTaskBoardPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
