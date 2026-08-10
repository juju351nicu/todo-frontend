import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import TaskApi from "@/features/task/api/taskApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

describe("Task API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Todo詳細を取得する", async () => {
    const payload = { todo_id: 42, title: "test" };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(TaskApi.findDetail(42)).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      `${Const.REST_PATH.TODO_DETAIL}/42`
    );
  });

  it("Todo詳細取得のHTTPエラーを通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 404 });

    await expect(TaskApi.findDetail(999)).rejects.toThrow(
      "Todo詳細の取得に失敗しました。status=404"
    );
  });

  it("一覧検索条件をTodo一覧APIへ渡す", async () => {
    const request = {
      search_title: "設計",
      date_range: "",
      done_flag_values: [0, 1],
    };
    const response = { ok: true };
    HttpClient.postRequest.mockResolvedValue(response);

    await expect(TaskApi.findList(request)).resolves.toBe(response);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      Const.REST_PATH.TODO_LIST,
      request
    );
  });

  it("Todo IDをBackendと一致するparameter名で完了APIへ渡す", async () => {
    HttpClient.postRequest.mockResolvedValue({ ok: true });

    await TaskApi.complete(42);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      `${Const.REST_PATH.TODO_DONE}?todo_id=42`,
      null
    );
  });
});
