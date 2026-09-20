import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskChecklistApi from "@/features/task/api/taskChecklistApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

const item = {
  checklistItemId: 41,
  taskId: 31,
  content: "仕様を確認する",
  completed: false,
  position: 1000,
  createdBy: 7,
  createdAt: "2026-09-21T01:00:00Z",
  updatedBy: 7,
  updatedAt: "2026-09-21T01:00:00Z",
  version: 0,
};

describe("Task checklist API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Project・Task配下のchecklist一覧を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([item]),
    });

    await expect(TaskChecklistApi.findItems(5, 31)).resolves.toEqual([item]);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/checklist-items"
    );
  });

  it("trim済み本文をTask末尾への追加APIへ送信する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(item),
    });

    await TaskChecklistApi.createItem(5, 31, { content: "仕様を確認する" });

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/checklist-items",
      { content: "仕様を確認する" }
    );
  });

  it("本文・完了状態・versionをitem更新APIへ送信する", async () => {
    const request = {
      content: "仕様を確認済み",
      completed: true,
      version: 0,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ...item, ...request, version: 1 }),
    });

    await TaskChecklistApi.updateItem(5, 31, 41, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/checklist-items/41",
      request
    );
  });

  it("全itemのID・versionを配列順で並び替えAPIへ送信する", async () => {
    const request = {
      items: [
        { checklistItemId: 42, version: 2 },
        { checklistItemId: 41, version: 1 },
      ],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await TaskChecklistApi.reorderItems(5, 31, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/checklist-items/order",
      request
    );
  });

  it("取得時点versionをqueryへ指定してitemを削除する", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await TaskChecklistApi.deleteItem(5, 31, 41, 3);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/checklist-items/41?version=3"
    );
  });

  it("409の項目エラーを競合回復用の例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [{ field: "version", message: "変更されています。" }],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      TaskChecklistApi.updateItem(5, 31, 41, {
        content: "古い更新",
        completed: false,
        version: 0,
      })
    ).rejects.toMatchObject({ status: 409, errorResponse });
  });
});
