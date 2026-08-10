import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodoCalendarPage } from "@/features/task/composables/useTodoCalendarPage";

const mocks = vi.hoisted(() => ({
  todoStore: {
    findCalendarList: vi.fn(),
  },
}));

vi.mock("@/features/task/stores/task", () => ({
  useTodoStore: () => mocks.todoStore,
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
  });

  it("初期条件でTodoカレンダーを取得する", async () => {
    mocks.todoStore.findCalendarList.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ todoList: [todo] }),
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
      ok: true,
      json: vi.fn().mockResolvedValue({ todoList: [] }),
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
    mocks.todoStore.findCalendarList.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        fieldErrors: [{ field: "search_title", message: "タイトルが不正です" }],
      }),
    });
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
});
