import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodoStore } from "@/stores/todo.js";
import Fetcher from "@/utils/rest.js";

vi.mock("@/utils/rest.js", () => ({
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
    Fetcher.getRequest.mockResolvedValue(response);
    const store = useTodoStore();

    await expect(store.completeTodo(42)).resolves.toBe(response);

    expect(Fetcher.getRequest).toHaveBeenCalledWith(
      "/api/v1/todo/doneFlag?todo_id=42"
    );
  });
});
