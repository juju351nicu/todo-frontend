import { beforeEach, describe, expect, it, vi } from "vitest";

import TodoApi from "@/features/todo/api/todoApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

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

    await expect(TodoApi.findDetail(42)).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(`${API_PATHS.TODO_DETAIL}/42`);
  });

  it("Todo詳細取得のHTTPエラーを通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(TodoApi.findDetail(999)).rejects.toMatchObject({
      name: "TodoApiError",
      status: 404,
      errorResponse: null,
    });
  });

  it("一覧検索条件をTodo一覧APIへ渡す", async () => {
    const request = {
      search_title: "設計",
      date_range: "",
      done_flag_values: [0, 1],
    };
    const payload = { todoList: [] };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(TodoApi.findList(request)).resolves.toEqual(payload);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(API_PATHS.TODO_LIST, request);
  });

  it("Todo一覧の既知Validationエラーをstatusと本文付きで通知する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "INVALID_REQUEST_BODY",
          field: "searchTitle",
          message: "タイトルが長すぎます。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      TodoApi.findList({
        search_title: "x",
        date_range: "",
        done_flag_values: [0],
      })
    ).rejects.toMatchObject({
      name: "TodoApiError",
      status: 400,
      errorResponse,
    });
  });

  it("Todo IDをBackendと一致するparameter名で完了APIへ渡す", async () => {
    HttpClient.postRequest.mockResolvedValue({ ok: true });

    await expect(TodoApi.complete(42)).resolves.toBeUndefined();

    expect(HttpClient.postRequest).toHaveBeenCalledWith(`${API_PATHS.TODO_DONE}?todo_id=42`, null);
  });

  it("Todo完了の本文なし404を安全なTaskApiErrorへ変換する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(TodoApi.complete(999)).rejects.toMatchObject({
      name: "TodoApiError",
      status: 404,
      errorResponse: null,
    });
  });

  it("Todo保存の非JSON 409を安全なTaskApiErrorへ変換する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockRejectedValue(new SyntaxError("not json")),
    });

    await expect(TodoApi.upsert({ todo_id: 42 })).rejects.toMatchObject({
      name: "TodoApiError",
      status: 409,
      errorResponse: null,
    });
  });
});
