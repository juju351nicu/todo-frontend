import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskListApi from "@/features/task-list/api/taskListApi";
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

  it("Task詳細を取得する", async () => {
    const payload = { task_id: 42, title: "test" };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(TaskListApi.findDetail(42)).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(`${API_PATHS.TASK_LIST_DETAIL}/42`);
  });

  it("Task詳細取得のHTTPエラーを通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(TaskListApi.findDetail(999)).rejects.toMatchObject({
      name: "TaskListApiError",
      status: 404,
      errorResponse: null,
    });
  });

  it("一覧検索条件をTask一覧APIへ渡す", async () => {
    const request = {
      search_title: "設計",
      date_range: "",
      done_flag_values: [0, 1],
    };
    const payload = { taskList: [] };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(TaskListApi.findList(request)).resolves.toEqual(payload);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(API_PATHS.TASK_LIST_SEARCH, request);
  });

  it("Task一覧の既知Validationエラーをstatusと本文付きで通知する", async () => {
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
      TaskListApi.findList({
        search_title: "x",
        date_range: "",
        done_flag_values: [0],
      })
    ).rejects.toMatchObject({
      name: "TaskListApiError",
      status: 400,
      errorResponse,
    });
  });

  it("Task IDをBackendと一致するparameter名で完了APIへ渡す", async () => {
    HttpClient.postRequest.mockResolvedValue({ ok: true });

    await expect(TaskListApi.complete(42)).resolves.toBeUndefined();

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      `${API_PATHS.TASK_LIST_DONE}?task_id=42`,
      null
    );
  });

  it("Task完了の本文なし404を安全なTaskListApiErrorへ変換する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(TaskListApi.complete(999)).rejects.toMatchObject({
      name: "TaskListApiError",
      status: 404,
      errorResponse: null,
    });
  });

  it("Task保存の非JSON 409を安全なTaskListApiErrorへ変換する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockRejectedValue(new SyntaxError("not json")),
    });

    await expect(TaskListApi.upsert({ task_id: 42 })).rejects.toMatchObject({
      name: "TaskListApiError",
      status: 409,
      errorResponse: null,
    });
  });
});
