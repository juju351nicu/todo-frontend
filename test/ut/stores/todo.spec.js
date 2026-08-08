import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import { useTodoStore } from "@/stores/todo";
import Fetcher from "@/utils/rest";

vi.mock("@/utils/rest", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    deleteRequest: vi.fn(),
  },
}));

describe("Todo store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("Backendと一致するURLとパラメータ名でTodoを完了にする", async () => {
    const response = { ok: true };
    Fetcher.postRequest.mockResolvedValue(response);
    const store = useTodoStore();

    await expect(store.completeTodo(42)).resolves.toBe(response);

    expect(Fetcher.postRequest).toHaveBeenCalledWith(
      "/api/v1/todo/doneFlag?todo_id=42",
      null
    );
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
    Fetcher.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(todoDetail),
    });
    const store = useTodoStore();

    const request = store.findTodoDetail(42);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(todoDetail);
    expect(Fetcher.getRequest).toHaveBeenCalledWith(
      `${Const.REST_PATH.TODO_DETAIL}/42`
    );
    expect(store.isLoading).toBe(false);
  });

  it("Todo詳細APIが失敗しても処理中フラグを解除する", async () => {
    Fetcher.getRequest.mockResolvedValue({ ok: false, status: 404 });
    const store = useTodoStore();

    await expect(store.findTodoDetail(999)).rejects.toThrow(
      "Todo詳細の取得に失敗しました"
    );
    expect(store.isLoading).toBe(false);
  });
});
