import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskApi from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";

vi.mock("@/features/task/api/taskApi", () => ({
  default: {
    complete: vi.fn(),
    findCalendar: vi.fn(),
    findDetail: vi.fn(),
    findList: vi.fn(),
    upsert: vi.fn(),
  },
}));

describe("Todo store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("Backendと一致するURLとパラメータ名でTodoを完了にする", async () => {
    const response = { ok: true };
    TaskApi.complete.mockResolvedValue(response);
    const store = useTodoStore();

    await expect(store.completeTodo(42)).resolves.toBe(response);

    expect(TaskApi.complete).toHaveBeenCalledWith(42);
  });

  it("ID指定でTodo詳細を取得し、処理中フラグを解除する", async () => {
    const todoDetail = {
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "0",
      user_id: 1,
      priority: 2,
      version: 4,
    };
    TaskApi.findDetail.mockResolvedValue(todoDetail);
    const store = useTodoStore();

    const request = store.findTodoDetail(42);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(todoDetail);
    expect(TaskApi.findDetail).toHaveBeenCalledWith(42);
    expect(store.isLoading).toBe(false);
  });

  it("Todo詳細APIが失敗しても処理中フラグを解除する", async () => {
    TaskApi.findDetail.mockRejectedValue(
      new Error("Todo詳細の取得に失敗しました。status=404")
    );
    const store = useTodoStore();

    await expect(store.findTodoDetail(999)).rejects.toThrow(
      "Todo詳細の取得に失敗しました"
    );
    expect(store.isLoading).toBe(false);
  });
});
