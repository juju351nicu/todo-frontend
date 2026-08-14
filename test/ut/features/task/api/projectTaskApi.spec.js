import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectTaskApi from "@/features/task/api/projectTaskApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

describe("Project Task API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Task登録値をProject配下のAPIへ送信する", async () => {
    const request = {
      title: "設計",
      detail: "APIを設計する",
      dateFrom: "2026-08-14",
      dateTo: "2026-08-15",
      assigneeAccountId: 2,
      taskStatusId: 11,
      priority: 1,
    };
    const created = { taskId: 31, ...request, version: 1 };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(created),
    });

    await expect(ProjectTaskApi.createTask(5, request)).resolves.toEqual(created);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks",
      request
    );
  });

  it("Task編集前に詳細を取得する", async () => {
    const task = { taskId: 31, version: 4 };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(task),
    });

    await expect(ProjectTaskApi.getTask(5, 31)).resolves.toEqual(task);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31"
    );
  });

  it("Task更新値と楽観ロックversionを送信する", async () => {
    const request = {
      title: "実装",
      detail: "APIを実装する",
      dateFrom: "2026-08-15",
      dateTo: "2026-08-16",
      assigneeAccountId: 2,
      priority: 2,
      version: 4,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ taskId: 31, ...request, version: 5 }),
    });

    await ProjectTaskApi.updateTask(5, 31, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31",
      request
    );
    expect(request).not.toHaveProperty("taskStatusId");
  });

  it("Taskの移動先列・前後Task・versionを位置変更APIへ送信する", async () => {
    const request = {
      destinationStatusId: 12,
      previousTaskId: 40,
      nextTaskId: 41,
      version: 4,
    };
    const movedBoard = { projectId: 5, projectName: "開発", columns: [] };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(movedBoard),
    });

    await expect(ProjectTaskApi.moveTask(5, 31, request)).resolves.toEqual(
      movedBoard
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/position",
      request
    );
  });

  it("409の項目エラーを競合回復用の例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [{ field: "version", message: "他の操作で更新されています。" }],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      ProjectTaskApi.updateTask(5, 31, {
        title: "更新",
        detail: "競合",
        dateFrom: "2026-08-14",
        dateTo: "2026-08-14",
        assigneeAccountId: 2,
        priority: 2,
        version: 1,
      })
    ).rejects.toMatchObject({ status: 409, errorResponse });
  });
});
