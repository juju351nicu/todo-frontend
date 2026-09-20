import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTaskSavedView,
  deleteTaskSavedView,
  getTaskSavedViews,
  getTaskSearchOptions,
  searchTasks,
  updateTaskSavedView,
} from "@/features/task/api/taskSearchApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
    deleteRequest: vi.fn(),
  },
}));

const filters = {
  keyword: "設計 レビュー",
  projectId: 7,
  assigneeAccountId: 11,
  statusCode: "IN_PROGRESS",
  dueFrom: "2026-09-01",
  dueTo: "2026-09-30",
  priority: 3,
};

describe("Task search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nullを除外し全検索条件をcamelCase query parameterへ変換する", async () => {
    const payload = { businessDate: "2026-09-20", truncated: false, tasks: [] };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(searchTasks(filters)).resolves.toEqual(payload);

    const requestPath = HttpClient.getRequest.mock.calls[0][0];
    const [path, queryString] = requestPath.split("?");
    const query = new URLSearchParams(queryString);
    expect(path).toBe(API_PATHS.TASK_SEARCH);
    expect(Object.fromEntries(query.entries())).toEqual({
      keyword: "設計 レビュー",
      projectId: "7",
      assigneeAccountId: "11",
      statusCode: "IN_PROGRESS",
      dueFrom: "2026-09-01",
      dueTo: "2026-09-30",
      priority: "3",
    });
  });

  it("Project指定付きで検索候補を取得する", async () => {
    const payload = { projects: [], assignees: [], statuses: [] };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(getTaskSearchOptions(7)).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      `${API_PATHS.TASK_SEARCH_OPTIONS}?projectId=7`
    );
  });

  it("Backendの非2xxとエラー本文をTaskSearchApiErrorで通知する", async () => {
    const errorResponse = {
      fieldErrors: [{ field: "dueTo", message: "期限の範囲が不正です。" }],
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(searchTasks(filters)).rejects.toMatchObject({
      name: "TaskSearchApiError",
      status: 400,
      errorResponse,
    });
  });

  it("Saved Viewの一覧・登録・更新・削除を専用pathへ送る", async () => {
    const savedView = {
      savedViewId: 3,
      name: "今月",
      filters,
      visibleColumns: ["PROJECT", "DUE_DATE"],
      updatedAt: "2026-09-20T01:00:00Z",
      version: 1,
    };
    const jsonResponse = () => ({
      ok: true,
      json: vi.fn().mockResolvedValue(savedView),
    });
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([savedView]),
    });
    HttpClient.postRequest.mockResolvedValue(jsonResponse());
    HttpClient.putRequest.mockResolvedValue(jsonResponse());
    HttpClient.deleteRequest.mockResolvedValue({ ok: true });
    const createRequest = {
      name: "今月",
      filters,
      visibleColumns: ["PROJECT", "DUE_DATE"],
    };

    await expect(getTaskSavedViews()).resolves.toEqual([savedView]);
    await expect(createTaskSavedView(createRequest)).resolves.toEqual(savedView);
    await expect(
      updateTaskSavedView(3, { ...createRequest, version: 1 })
    ).resolves.toEqual(savedView);
    await expect(deleteTaskSavedView(3, 1)).resolves.toBeUndefined();

    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.TASK_SAVED_VIEWS);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      API_PATHS.TASK_SAVED_VIEWS,
      createRequest
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      `${API_PATHS.TASK_SAVED_VIEWS}/3`,
      { ...createRequest, version: 1 }
    );
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      `${API_PATHS.TASK_SAVED_VIEWS}/3?version=1`
    );
  });
});
