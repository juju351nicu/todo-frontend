import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import { useTaskCalendarPage } from "@/features/task-list/composables/useTaskCalendarPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  taskListStore: {
    findCalendarList: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
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
  start: "2026-08-08",
  end: "2026-08-31",
  color: "#ff0000",
  url: null,
  display: null,
  description: null,
  detail: "詳細",
  doneFlag: false,
  userId: 5,
  remainingDays: 3,
  firstName: null,
  lastName: null,
  priority: 2,
};

describe("useTaskCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
  });

  it("初期条件でTaskカレンダーを取得する", async () => {
    mocks.taskListStore.findCalendarList.mockResolvedValue({
      taskList: [task],
    });
    const page = useTaskCalendarPage();

    await page.initialize();

    expect(mocks.taskListStore.findCalendarList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(page.calendarOptions.events).toEqual([
      expect.objectContaining({ id: "42", title: "設計" }),
    ]);
  });

  it("入力されたタイトルと完了状態で検索する", async () => {
    mocks.taskListStore.findCalendarList.mockResolvedValue({
      taskList: [],
    });
    const page = useTaskCalendarPage();
    page.searchTitle.value = "設計";
    page.selectedDoneFlag.value = ["0"];

    await page.search();

    expect(mocks.taskListStore.findCalendarList).toHaveBeenCalledWith({
      search_title: "設計",
      date_range: "",
      done_flag_values: [0],
    });
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.taskListStore.findCalendarList.mockRejectedValue(
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
    const page = useTaskCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["タイトルが不正です"]);
  });

  it("Backend接続失敗を画面メッセージへ変換する", async () => {
    mocks.taskListStore.findCalendarList.mockRejectedValue(new Error("offline"));
    const page = useTaskCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("未知codeのBackend本文を表示せず固定文言へ閉じる", async () => {
    mocks.taskListStore.findCalendarList.mockRejectedValue(
      new TaskListApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_INTERNAL_ERROR",
            field: "query",
            message: "secret SQL",
          },
        ],
      })
    );
    const page = useTaskCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["Taskカレンダーを取得できませんでした。"]);
  });

  it("本文なし403ではSessionを維持して古いEventを破棄する", async () => {
    mocks.taskListStore.findCalendarList
      .mockResolvedValueOnce({ taskList: [task] })
      .mockRejectedValueOnce(new TaskListApiError(403, null));
    const page = useTaskCalendarPage();
    await page.initialize();

    await page.search();

    expect(page.calendarOptions.events).toEqual([]);
    expect(page.errorMessages.value).toEqual(["Taskを参照するpermissionがありません。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("401ではEventとSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskListStore.findCalendarList.mockRejectedValue(new TaskListApiError(401, null));
    const page = useTaskCalendarPage();

    await page.search();

    expect(page.calendarOptions.events).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
