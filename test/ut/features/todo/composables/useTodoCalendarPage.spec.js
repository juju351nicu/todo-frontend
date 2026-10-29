import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoApiError } from "@/features/todo/api/todoApi";
import { useTodoCalendarPage } from "@/features/todo/composables/useTodoCalendarPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  todoStore: {
    findCalendarList: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/todo/stores/todo", () => ({
  useTodoStore: () => mocks.todoStore,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

const todo = {
  todoId: 42,
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

describe("useTodoCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
  });

  it("初期条件でTodoカレンダーを取得する", async () => {
    mocks.todoStore.findCalendarList.mockResolvedValue({
      todoList: [todo],
    });
    const page = useTodoCalendarPage();

    await page.initialize();

    expect(mocks.todoStore.findCalendarList).toHaveBeenCalledWith({
      search_title: "",
      date_range: "",
      done_flag_values: [0, 1],
    });
    expect(page.calendarOptions.events).toEqual([
      expect.objectContaining({ id: "42", title: "設計" }),
    ]);
  });

  it("入力されたタイトルと完了状態で検索する", async () => {
    mocks.todoStore.findCalendarList.mockResolvedValue({
      todoList: [],
    });
    const page = useTodoCalendarPage();
    page.searchTitle.value = "設計";
    page.selectedDoneFlag.value = ["0"];

    await page.search();

    expect(mocks.todoStore.findCalendarList).toHaveBeenCalledWith({
      search_title: "設計",
      date_range: "",
      done_flag_values: [0],
    });
  });

  it("入力エラーResponseを画面メッセージへ変換する", async () => {
    mocks.todoStore.findCalendarList.mockRejectedValue(
      new TodoApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "searchTitle",
            message: "タイトルが不正です",
          },
        ],
      })
    );
    const page = useTodoCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["タイトルが不正です"]);
  });

  it("Backend接続失敗を画面メッセージへ変換する", async () => {
    mocks.todoStore.findCalendarList.mockRejectedValue(new Error("offline"));
    const page = useTodoCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("未知codeのBackend本文を表示せず固定文言へ閉じる", async () => {
    mocks.todoStore.findCalendarList.mockRejectedValue(
      new TodoApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_INTERNAL_ERROR",
            field: "query",
            message: "secret SQL",
          },
        ],
      })
    );
    const page = useTodoCalendarPage();

    await page.search();

    expect(page.errorMessages.value).toEqual([
      "Todoカレンダーを取得できませんでした。",
    ]);
  });

  it("本文なし403ではSessionを維持して古いEventを破棄する", async () => {
    mocks.todoStore.findCalendarList
      .mockResolvedValueOnce({ todoList: [todo] })
      .mockRejectedValueOnce(new TodoApiError(403, null));
    const page = useTodoCalendarPage();
    await page.initialize();

    await page.search();

    expect(page.calendarOptions.events).toEqual([]);
    expect(page.errorMessages.value).toEqual([
      "Todoを参照するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("401ではEventとSession表示を破棄してLoginへ戻す", async () => {
    mocks.todoStore.findCalendarList.mockRejectedValue(
      new TodoApiError(401, null)
    );
    const page = useTodoCalendarPage();

    await page.search();

    expect(page.calendarOptions.events).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
