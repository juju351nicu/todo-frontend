import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMyTasksPage } from "@/features/task/composables/useMyTasksPage";
import { TaskApiError } from "@/features/task/api/taskApi";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  todoStore: {
    completeTodo: vi.fn(),
    findMyTasks: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasAnyPermission: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/task/stores/task", () => ({
  useTodoStore: () => mocks.todoStore,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

const tasks = [
  {
    taskId: 15,
    projectId: 1,
    projectKey: "WM",
    projectName: "Work Management",
    statusCode: "TODO",
    statusName: "Todo",
    title: "期限超過Task",
    dueDate: "2026-09-19",
    dueGroup: "OVERDUE",
    remainingDays: -1,
    priority: 3,
    progressPercent: 25,
  },
  {
    taskId: 16,
    projectId: 1,
    projectKey: "WM",
    projectName: "Work Management",
    statusCode: "IN_PROGRESS",
    statusName: "進行中",
    title: "今日のTask",
    dueDate: "2026-09-20",
    dueGroup: "TODAY",
    remainingDays: 0,
    priority: 2,
    progressPercent: 50,
  },
  {
    taskId: 17,
    projectId: 2,
    projectKey: "OPS",
    projectName: "Operations",
    statusCode: "TODO",
    statusName: "Todo",
    title: "今後のTask",
    dueDate: "2026-09-21",
    dueGroup: "UPCOMING",
    remainingDays: 1,
    priority: 1,
    progressPercent: 0,
  },
];

describe("useMyTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.hasAnyPermission.mockReturnValue(true);
    mocks.todoStore.findMyTasks.mockResolvedValue({
      businessDate: "2026-09-20",
      tasks,
    });
  });

  it("専用APIの本人担当TaskをBackend確定済み期限グループへ表示する", async () => {
    const page = useMyTasksPage();

    await page.loadTasks();

    expect(mocks.todoStore.findMyTasks).toHaveBeenCalledOnce();
    expect(page.myTasks.value).toEqual(tasks);
    expect(page.groups.value.map((group) => group.items.map((task) => task.taskId)))
      .toEqual([[15], [16], [17]]);
  });

  it("Taskの所属Project BoardへTask ID付きで移動する", () => {
    const page = useMyTasksPage();

    page.showTask(tasks[0]);

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 1 },
      query: { taskId: "15" },
    });
  });

  it("完了したTaskをMy Tasks一覧から除外する", async () => {
    mocks.todoStore.completeTodo.mockResolvedValue({ ok: true });
    const page = useMyTasksPage();
    await page.loadTasks();

    await page.completeTask(tasks[0]);

    expect(mocks.todoStore.completeTodo).toHaveBeenCalledWith(15);
    expect(page.myTasks.value.map((task) => task.taskId)).toEqual([16, 17]);
  });

  it("取得失敗時は既存一覧を維持して接続エラーを表示する", async () => {
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.todoStore.findMyTasks.mockRejectedValue(new Error("offline"));

    await page.loadTasks();

    expect(page.myTasks.value).toEqual(tasks);
    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.todoStore.findMyTasks.mockRejectedValue(new TaskApiError(401, null));
    const page = useMyTasksPage();

    await page.loadTasks();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("旧Todo更新permissionがない場合は完了操作を表示しない", () => {
    mocks.userStore.hasAnyPermission.mockReturnValue(false);

    const page = useMyTasksPage();

    expect(page.canCompleteTasks.value).toBe(false);
  });

  it("旧Todo更新permissionがない場合は完了APIを呼ばない", async () => {
    mocks.userStore.hasAnyPermission.mockReturnValue(false);
    const page = useMyTasksPage();

    await page.completeTask(tasks[0]);

    expect(mocks.todoStore.completeTodo).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "Taskを完了するpermissionがありません。",
    ]);
  });
});
