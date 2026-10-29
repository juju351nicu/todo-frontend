import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MY_TASKS_RELOAD_CONTROL,
  buildMyTaskCompleteControlKey,
  useMyTasksPage,
} from "@/features/task/composables/useMyTasksPage";
import { MyTaskApiError } from "@/features/task/api/myTaskApi";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  myTaskApi: {
    completeMyTask: vi.fn(),
    findMyTasks: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasAnyPermission: vi.fn(),
    hasPermission: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/task/api/myTaskApi", async (importOriginal) => ({
  ...(await importOriginal()),
  default: mocks.myTaskApi,
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
    version: 3,
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
    version: 0,
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
    version: 1,
  },
];

describe("useMyTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.hasAnyPermission.mockReturnValue(true);
    mocks.userStore.hasPermission.mockReturnValue(true);
    mocks.myTaskApi.findMyTasks.mockResolvedValue({
      businessDate: "2026-09-20",
      tasks,
    });
  });

  it("専用APIの本人担当TaskをBackend確定済み期限グループへ表示する", async () => {
    const page = useMyTasksPage();

    await page.loadTasks();

    expect(mocks.myTaskApi.findMyTasks).toHaveBeenCalledOnce();
    expect(page.myTasks.value).toEqual(tasks);
    expect(page.groups.value.map((group) => group.items.map((task) => task.taskId)))
      .toEqual([[15], [16], [17]]);
  });

  it("今週では業務日から日曜までが期限のTaskだけを表示する", async () => {
    const page = useMyTasksPage();
    await page.loadTasks();

    page.selectedFilter.value = "THIS_WEEK";

    expect(page.businessDate.value).toBe("2026-09-20");
    expect(page.visibleTasks.value.map((task) => task.taskId)).toEqual([16]);
    expect(page.groups.value.map((group) => group.items.map((task) => task.taskId)))
      .toEqual([[], [16], []]);
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
    mocks.myTaskApi.completeMyTask.mockResolvedValue(undefined);
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockResolvedValue({
      businessDate: "2026-09-20",
      tasks: tasks.slice(1),
    });

    await page.completeTask(tasks[0]);

    expect(mocks.myTaskApi.completeMyTask).toHaveBeenCalledWith(1, 15, 3);
    expect(mocks.myTaskApi.findMyTasks).toHaveBeenCalledTimes(2);
    expect(page.myTasks.value.map((task) => task.taskId)).toEqual([16, 17]);
    expect(page.successMessage.value).toBe("「期限超過Task」を完了しました。");
  });

  it("完了の後に再取得できなかった場合は、成功の案内を出さずに再取得失敗を出す", async () => {
    mocks.myTaskApi.completeMyTask.mockResolvedValue(undefined);
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new TypeError("Failed to fetch"));

    await page.completeTask(tasks[0]);

    expect(page.successMessage.value).toBe("");
    expect(page.errorMessages.value).toEqual([
      "Taskは完了しましたが、最新のMy Tasksを取得できませんでした。再読込してください。",
    ]);
  });

  it("取得失敗時は既存一覧を維持して接続エラーを表示する", async () => {
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new Error("offline"));

    await page.loadTasks();

    expect(page.myTasks.value).toEqual(tasks);
    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new MyTaskApiError(401, null));
    const page = useMyTasksPage();

    await page.loadTasks();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("本文なし403ではSessionを維持してMy Tasksを破棄する", async () => {
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new MyTaskApiError(403, null));

    await page.loadTasks();

    expect(page.myTasks.value).toEqual([]);
    expect(page.businessDate.value).toBe("");
    expect(page.errorMessages.value).toEqual([
      "My Tasksを参照するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("未知codeのBackend本文を表示せず固定文言へ閉じる", async () => {
    mocks.myTaskApi.findMyTasks.mockRejectedValue(
      new MyTaskApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_INTERNAL_ERROR",
            field: "sql",
            message: "secret table name",
          },
        ],
      })
    );
    const page = useMyTasksPage();

    await page.loadTasks();

    expect(page.errorMessages.value).toEqual([
      "My Tasksを取得できませんでした。",
    ]);
  });

  it("完了確定後の再取得失敗は完了操作失敗と区別する", async () => {
    mocks.myTaskApi.completeMyTask.mockResolvedValue(undefined);
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new Error("offline"));

    await page.completeTask(tasks[0]);

    expect(page.myTasks.value.map((task) => task.taskId)).toEqual([16, 17]);
    expect(page.errorMessages.value).toEqual([
      "Taskは完了しましたが、最新のMy Tasksを取得できませんでした。再読込してください。",
    ]);
  });

  it("完了404の回復中に401となった場合は古い案内よりSession失効を優先する", async () => {
    mocks.myTaskApi.completeMyTask.mockRejectedValue(new MyTaskApiError(404, null));
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockRejectedValue(new MyTaskApiError(401, null));

    await page.completeTask(tasks[0]);

    expect(page.myTasks.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("TASK_UPDATEがない場合は完了操作を表示しない", () => {
    mocks.userStore.hasPermission.mockImplementation(
      (code) => code !== "TASK_UPDATE"
    );

    const page = useMyTasksPage();

    expect(page.canCompleteTasks.value).toBe(false);
    expect(mocks.userStore.hasPermission).toHaveBeenCalledWith("TASK_UPDATE");
  });

  it("TASK_UPDATEがない場合は完了APIを呼ばない", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (code) => code !== "TASK_UPDATE"
    );
    const page = useMyTasksPage();

    await page.completeTask(tasks[0]);

    expect(mocks.myTaskApi.completeMyTask).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "Taskを完了するpermissionがありません。",
    ]);
  });

  it("完了が409で競合した場合は一覧を取り直し、Backendの理由を表示する", async () => {
    mocks.myTaskApi.completeMyTask.mockRejectedValue(
      new MyTaskApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の利用者がTaskを更新しました。",
          },
        ],
      })
    );
    const page = useMyTasksPage();
    await page.loadTasks();
    mocks.myTaskApi.findMyTasks.mockResolvedValue({
      businessDate: "2026-09-20",
      tasks: tasks.slice(1),
    });

    await page.completeTask(tasks[0]);

    expect(mocks.myTaskApi.findMyTasks).toHaveBeenCalledTimes(2);
    expect(page.myTasks.value.map((task) => task.taskId)).toEqual([16, 17]);
    expect(page.errorMessages.value).toEqual([
      "他の利用者がTaskを更新しました。",
    ]);
  });

  it("TASK_UPDATEがある場合だけTimer開始操作を表示する", () => {
    const page = useMyTasksPage();

    expect(page.canStartTimers.value).toBe(true);

    mocks.userStore.hasPermission.mockReturnValue(false);
    const readonlyPage = useMyTasksPage();
    expect(readonlyPage.canStartTimers.value).toBe(false);
  });

  describe("完了の後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // presentに入れた部品だけが画面にあるものとして扱う（完了したTaskの「完了」は一覧から消える）。
    const stubDocument = (present) => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => {
          const key = selector.match(/data-my-task-control="([^"]+)"/)?.[1];
          return present.includes(key) ? { focus: () => focused.push(key), matches: () => false } : null;
        },
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("完了したTaskと同じ位置へ来たTaskの「完了」へ戻す", async () => {
      mocks.myTaskApi.completeMyTask.mockResolvedValue(undefined);
      const page = useMyTasksPage();
      await page.loadTasks();
      mocks.myTaskApi.findMyTasks.mockResolvedValue({ businessDate: "2026-09-20", tasks: [tasks[0], tasks[2]] });
      const focused = stubDocument([buildMyTaskCompleteControlKey(15), buildMyTaskCompleteControlKey(17), MY_TASKS_RELOAD_CONTROL]);

      await page.completeTask(tasks[1]);

      expect(focused).toEqual([buildMyTaskCompleteControlKey(17)]);
    });

    it("最後のTaskを完了したら1つ前、Taskがなくなったら再読み込みボタンへ戻す", async () => {
      mocks.myTaskApi.completeMyTask.mockResolvedValue(undefined);
      const page = useMyTasksPage();
      await page.loadTasks();
      mocks.myTaskApi.findMyTasks.mockResolvedValue({ businessDate: "2026-09-20", tasks: tasks.slice(0, 2) });
      let focused = stubDocument([buildMyTaskCompleteControlKey(15), buildMyTaskCompleteControlKey(16), MY_TASKS_RELOAD_CONTROL]);

      await page.completeTask(tasks[2]);
      expect(focused).toEqual([buildMyTaskCompleteControlKey(16)]);

      mocks.myTaskApi.findMyTasks.mockResolvedValue({ businessDate: "2026-09-20", tasks: [] });
      focused = stubDocument([MY_TASKS_RELOAD_CONTROL]);
      await page.completeTask(tasks[0]);
      expect(focused).toEqual([MY_TASKS_RELOAD_CONTROL]);
    });

    it("完了に失敗してTaskが残る場合は、そのTaskの「完了」へ戻す", async () => {
      mocks.myTaskApi.completeMyTask.mockRejectedValue(new TypeError("Failed to fetch"));
      const page = useMyTasksPage();
      await page.loadTasks();
      const focused = stubDocument([buildMyTaskCompleteControlKey(15), buildMyTaskCompleteControlKey(16), buildMyTaskCompleteControlKey(17)]);

      await page.completeTask(tasks[1]);

      expect(focused).toEqual([buildMyTaskCompleteControlKey(16)]);
    });
  });
});
