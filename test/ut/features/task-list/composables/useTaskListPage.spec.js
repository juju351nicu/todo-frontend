import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import {
  buildTaskEditControlKey,
  useTaskListPage,
} from "@/features/task-list/composables/useTaskListPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  taskListStore: {
    completeTask: vi.fn(),
    findTaskList: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn(),
    accountId: 5,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/task-list/stores/taskList", () => ({
  useTaskListStore: () => mocks.taskListStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

const task = {
  taskId: 42,
  title: "設計",
  detail: "詳細",
  doneFlag: false,
};

describe("useTaskListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskListStore.findTaskList.mockResolvedValue({ taskList: [] });
    mocks.userStore.accountId = 5;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_ALL"
    );
  });

  it("初期条件でTask一覧を取得してStoreにも保存する", async () => {
    mocks.taskListStore.findTaskList.mockResolvedValue({
      taskList: [task],
    });
    const page = useTaskListPage();

    await page.initialize();

    expect(mocks.taskListStore.findTaskList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(page.taskList.value).toEqual([task]);
  });

  it("入力されたタイトルと完了状態で検索する", async () => {
    mocks.taskListStore.findTaskList.mockResolvedValue({
      taskList: [],
    });
    const page = useTaskListPage();
    page.searchTitle.value = "設計";
    page.selectedDoneFlag.value = ["0"];

    await page.search();

    expect(mocks.taskListStore.findTaskList).toHaveBeenCalledWith({
      search_title: "設計",
      date_range: "",
      done_flag_values: [0],
    });
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.taskListStore.findTaskList.mockRejectedValue(
      new TaskListApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "タイトルが不正です",
          },
        ],
      })
    );
    const page = useTaskListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["タイトルが不正です"]);
  });

  it("Taskを完了状態へ更新する", async () => {
    mocks.taskListStore.completeTask.mockResolvedValue(undefined);
    mocks.taskListStore.findTaskList.mockResolvedValue({
      taskList: [{ ...task, doneFlag: true }],
    });
    const page = useTaskListPage();
    const item = { ...task };

    await page.completeTask(item);

    expect(mocks.taskListStore.completeTask).toHaveBeenCalledWith(42);
    expect(mocks.taskListStore.findTaskList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(item.doneFlag).toBe(true);
    expect(page.successMessage.value).toBe("「設計」を完了しました。");
  });

  it("完了の後に一覧を取り直せなかった場合は、成功の案内を出さずに再取得失敗を出す", async () => {
    mocks.taskListStore.completeTask.mockResolvedValue(undefined);
    mocks.taskListStore.findTaskList.mockRejectedValue(new TypeError("Failed to fetch"));
    const page = useTaskListPage();

    await page.completeTask({ ...task });

    expect(page.successMessage.value).toBe("");
    expect(page.errorMessages.value).toEqual([
      "Taskは完了しましたが、最新の一覧を取得できませんでした。再読込してください。",
    ]);
  });

  describe("完了の後のフォーカス", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("完了でdisabledになった「完了」ではなく、同じ行の「編集」へ戻す", async () => {
      // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => ({
          focus: () => focused.push(selector.match(/data-task-list-control="([^"]+)"/)?.[1]),
          matches: () => false,
        }),
      });
      mocks.taskListStore.completeTask.mockResolvedValue(undefined);
      mocks.taskListStore.findTaskList.mockResolvedValue({
        taskList: [{ ...task, doneFlag: true }],
      });
      const page = useTaskListPage();

      await page.completeTask({ ...task });

      expect(focused).toEqual([buildTaskEditControlKey(42)]);
    });
  });

  it("既知codeの複数入力エラーをBackend順で表示する", async () => {
    mocks.taskListStore.findTaskList.mockRejectedValue(
      new TaskListApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "1件目",
          },
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "doneFlagValues",
            message: "2件目",
          },
        ],
      })
    );
    const page = useTaskListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["1件目", "2件目"]);
  });

  it("未知codeを含むBackend本文は部分表示せず固定文言へ閉じる", async () => {
    mocks.taskListStore.findTaskList.mockRejectedValue(
      new TaskListApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "表示してはいけない既知文言",
          },
          {
            errorCode: "UNKNOWN_VALIDATION",
            field: "secret",
            message: "SQL details",
          },
        ],
      })
    );
    const page = useTaskListPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["Task情報を取得できませんでした。"]);
  });

  it("本文なし403ではSessionを維持して古い一覧を破棄する", async () => {
    const page = useTaskListPage();
    mocks.taskListStore.findTaskList.mockResolvedValueOnce({ taskList: [task] });
    await page.initialize();
    mocks.taskListStore.findTaskList.mockRejectedValue(new TaskListApiError(403, null));

    await page.search();

    expect(page.taskList.value).toEqual([]);
    expect(page.errorMessages.value).toEqual(["Taskを参照するpermissionがありません。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("401では一覧とSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskListStore.findTaskList.mockRejectedValue(new TaskListApiError(401, null));
    const page = useTaskListPage();

    await page.search();

    expect(page.taskList.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("完了確定後の再取得失敗を完了操作失敗と区別する", async () => {
    mocks.taskListStore.completeTask.mockResolvedValue(undefined);
    mocks.taskListStore.findTaskList.mockRejectedValue(new Error("offline"));
    const page = useTaskListPage();
    const item = { ...task };

    await page.completeTask(item);

    expect(item.doneFlag).toBe(true);
    expect(page.errorMessages.value).toEqual([
      "Taskは完了しましたが、最新の一覧を取得できませんでした。再読込してください。",
    ]);
  });

  it("完了404の回復中に401となった場合はSession失効を優先する", async () => {
    mocks.taskListStore.completeTask.mockRejectedValue(new TaskListApiError(404, null));
    mocks.taskListStore.findTaskList.mockRejectedValue(new TaskListApiError(401, null));
    const page = useTaskListPage();
    const item = { ...task };

    await page.completeTask(item);

    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("更新permissionがない場合は完了APIを呼ばない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useTaskListPage();
    const item = { ...task };

    await page.completeTask(item);

    expect(mocks.taskListStore.completeTask).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Taskを更新するpermissionがありません。"]);
  });

  it("本人更新permissionでは他人のTaskを完了できない", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "TASK_WRITE_OWN"
    );
    const page = useTaskListPage();
    const item = { ...task, userId: 8 };

    await page.completeTask(item);

    expect(page.canWriteTask(item)).toBe(false);
    expect(mocks.taskListStore.completeTask).not.toHaveBeenCalled();
  });

  it("Task詳細画面へTask ID付きで移動する", () => {
    const page = useTaskListPage();

    page.showTaskDetail(task);

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskListDetail",
      params: { id: 42 },
    });
  });
});
