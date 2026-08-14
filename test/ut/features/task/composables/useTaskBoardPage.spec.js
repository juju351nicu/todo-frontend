import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectApiError } from "@/features/project/api/projectApi";
import { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import { useTaskBoardPage } from "@/features/task/composables/useTaskBoardPage";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  projectApi: { getProject: vi.fn(), getTaskBoard: vi.fn() },
  projectTaskApi: {
    archiveTask: vi.fn(),
    createTask: vi.fn(),
    getTask: vi.fn(),
    moveTask: vi.fn(),
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

const ownerProject = {
  ...project,
  projectRole: "OWNER",
  members: [{ ...project.members[0], projectRole: "OWNER" }],
};

const destinationTask = {
  ...task,
  taskId: 40,
  title: "移動先Task",
  position: 1024,
  version: 2,
};

const precedingTask = {
  ...task,
  taskId: 30,
  title: "直前Task",
  position: 512,
  version: 3,
};

const movableBoard = {
  projectId: 5,
  projectName: "開発Project",
  columns: [
    { ...project.taskStatuses[0], tasks: [task] },
    {
      taskStatusId: 12,
      statusCode: "IN_PROGRESS",
      name: "進行中",
      position: 2048,
      completed: false,
      version: 1,
      tasks: [destinationTask],
    },
  ],
};

const keyboardBoard = {
  ...movableBoard,
  columns: [
    { ...project.taskStatuses[0], tasks: [precedingTask, task] },
    movableBoard.columns[1],
    {
      taskStatusId: 13,
      statusCode: "DONE",
      name: "完了",
      position: 3072,
      completed: true,
      version: 1,
      tasks: [],
    },
  ],
};

describe("useTaskBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.permissions.add("TASK_READ");
    mocks.permissions.add("TASK_CREATE");
    mocks.permissions.add("TASK_UPDATE");
    mocks.permissions.add("TASK_MOVE");
    mocks.permissions.add("TASK_ARCHIVE");
    mocks.route.params.projectId = "5";
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(board));
    mocks.projectTaskApi.getTask.mockResolvedValue(task);
    mocks.projectTaskApi.archiveTask.mockResolvedValue(undefined);
    mocks.projectTaskApi.createTask.mockResolvedValue(task);
    mocks.projectTaskApi.moveTask.mockResolvedValue(structuredClone(movableBoard));
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

  it("MEMBERはTASK_MOVE permissionを持っていてもドラッグできない", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canMoveTask.value).toBe(false);
  });

  it("MEMBERはTASK_ARCHIVE permissionを持っていてもarchiveできない", async () => {
    const page = useTaskBoardPage();

    await page.initialize();

    expect(page.canArchiveTask.value).toBe(false);
  });

  it("OWNERは確認後にTaskをversion付きでarchiveして最新Boardを取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    await page.archiveTask();

    expect(mocks.projectTaskApi.archiveTask).toHaveBeenCalledWith(5, 31, 4);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.isArchiveConfirmOpen.value).toBe(false);
    expect(page.isEditorOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("Taskをアーカイブしました。");
  });

  it("archive実行中の再実行ではDELETE APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectTaskApi.archiveTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    const firstArchive = page.archiveTask();
    const secondArchive = page.archiveTask();

    expect(mocks.projectTaskApi.archiveTask).toHaveBeenCalledOnce();
    resolveRequest();
    await Promise.all([firstArchive, secondArchive]);
  });

  it("archiveの409競合では古いDialogを閉じて最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectTaskApi.archiveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          { field: "version", message: "Taskが先に更新されています。" },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    await page.openTaskEditor(31);
    page.openArchiveConfirm();

    await page.archiveTask();

    expect(page.errorMessages.value).toEqual(["Taskが先に更新されています。"]);
    expect(page.isArchiveConfirmOpen.value).toBe(false);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
  });

  it("OWNERが別列の末尾へ移動すると直前Taskと移動前versionを送信する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    const confirmedBoard = {
      ...movableBoard,
      columns: movableBoard.columns.map((column) => ({
        ...column,
        tasks:
          column.taskStatusId === 11
            ? []
            : [destinationTask, { ...task, version: 5 }],
      })),
    };
    mocks.projectTaskApi.moveTask.mockResolvedValue(confirmedBoard);
    const page = useTaskBoardPage();
    await page.initialize();
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(mocks.projectTaskApi.moveTask).toHaveBeenCalledWith(5, 31, {
      destinationStatusId: 12,
      previousTaskId: 40,
      nextTaskId: null,
      version: 4,
    });
    expect(page.board.value).toEqual(confirmedBoard);
    expect(page.successMessage.value).toBe("Taskを移動しました。");
  });

  it.each([
    ["上キー", 31, "UP", 11, null, 30, 4],
    ["下キー", 30, "DOWN", 11, 31, null, 3],
    ["右キー", 31, "RIGHT", 12, 40, null, 4],
    ["左キー", 40, "LEFT", 11, 31, null, 2],
  ])(
    "%sでTaskの前後関係を計算して移動APIへ送信する",
    async (
      _keyName,
      taskId,
      direction,
      destinationStatusId,
      previousTaskId,
      nextTaskId,
      version
    ) => {
      mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
      mocks.projectApi.getTaskBoard.mockResolvedValue(
        structuredClone(keyboardBoard)
      );
      const page = useTaskBoardPage();
      await page.initialize();

      await page.moveTaskByKeyboard(taskId, direction);

      expect(mocks.projectTaskApi.moveTask).toHaveBeenCalledWith(5, taskId, {
        destinationStatusId,
        previousTaskId,
        nextTaskId,
        version,
      });
      expect(page.successMessage.value).toBe("Taskを移動しました。");
    }
  );

  it("先頭Taskの上・左方向では移動APIを送信しない", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(keyboardBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(30, "UP");
    await page.moveTaskByKeyboard(30, "LEFT");

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("MEMBERの方向キー操作では移動APIを送信しない", async () => {
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(keyboardBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(31, "RIGHT");

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("方向キー移動の409競合ではBackendの最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard
      .mockResolvedValueOnce(structuredClone(keyboardBoard))
      .mockResolvedValueOnce(structuredClone(board));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          { field: "version", message: "移動中にTaskが更新されました。" },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();

    await page.moveTaskByKeyboard(31, "RIGHT");

    expect(page.errorMessages.value).toEqual([
      "移動中にTaskが更新されました。",
    ]);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.board.value).toEqual(board);
  });

  it("source列のremoved eventでは移動APIを送信しない", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    const page = useTaskBoardPage();
    await page.initialize();

    await page.handleTaskDrop(
      { removed: { element: task, newIndex: 0 } },
      11
    );

    expect(mocks.projectTaskApi.moveTask).not.toHaveBeenCalled();
  });

  it("403で移動できない場合はドラッグ前の列と順序へ戻す", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard.mockResolvedValue(structuredClone(movableBoard));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(403, null)
    );
    const page = useTaskBoardPage();
    await page.initialize();
    const beforeDrag = JSON.parse(JSON.stringify(page.board.value));
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(page.board.value).toEqual(beforeDrag);
    expect(page.errorMessages.value).toEqual([
      "この操作を実行するpermissionがありません。",
    ]);
  });

  it("409競合では楽観表示を破棄してBackendの最新Boardを再取得する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(ownerProject));
    mocks.projectApi.getTaskBoard
      .mockResolvedValueOnce(structuredClone(movableBoard))
      .mockResolvedValueOnce(structuredClone(board));
    mocks.projectTaskApi.moveTask.mockRejectedValue(
      new ProjectTaskApiError(409, {
        fieldErrors: [
          { field: "version", message: "移動中にTaskが更新されました。" },
        ],
      })
    );
    const page = useTaskBoardPage();
    await page.initialize();
    page.startTaskDrag();
    const movedTask = page.board.value.columns[0].tasks.shift();
    page.board.value.columns[1].tasks.push(movedTask);

    await page.handleTaskDrop(
      { added: { element: movedTask, newIndex: 1 } },
      12
    );

    expect(page.errorMessages.value).toEqual([
      "移動中にTaskが更新されました。",
    ]);
    expect(mocks.projectApi.getTaskBoard).toHaveBeenCalledTimes(2);
    expect(page.board.value).toEqual(board);
  });
});
