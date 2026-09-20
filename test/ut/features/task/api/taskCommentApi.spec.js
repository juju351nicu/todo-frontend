import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskCommentApi, {
  TaskCommentApiError,
} from "@/features/task/api/taskCommentApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

const comment = {
  commentId: 41,
  taskId: 31,
  authorAccountId: 7,
  authorDisplayName: "投稿者",
  body: "確認をお願いします。",
  createdAt: "2026-09-20T01:00:00Z",
  updatedAt: "2026-09-20T01:00:00Z",
  version: 0,
};

describe("TaskコメントAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ProjectとTask配下のコメント一覧を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([comment]),
    });

    await expect(TaskCommentApi.findComments(5, 31)).resolves.toEqual([
      comment,
    ]);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/comments"
    );
  });

  it("trim済み投稿本文をコメントAPIへ送信する", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(comment),
    });

    await expect(
      TaskCommentApi.createComment(5, 31, { body: "確認をお願いします。" })
    ).resolves.toEqual(comment);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/comments",
      { body: "確認をお願いします。" }
    );
  });

  it("更新本文と取得時点versionをコメントID配下のPUTへ送信する", async () => {
    const updated = { ...comment, body: "確認済みです。", version: 1 };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(updated),
    });

    await expect(
      TaskCommentApi.updateComment(5, 31, 41, {
        body: "確認済みです。",
        version: 0,
      })
    ).resolves.toEqual(updated);
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/comments/41",
      { body: "確認済みです。", version: 0 }
    );
  });

  it("取得時点versionをqueryへ指定してコメントを削除する", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(
      TaskCommentApi.deleteComment(5, 31, 41, 2)
    ).resolves.toBeUndefined();
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/comments/41?version=2"
    );
  });

  it("409の項目エラーを競合回復用の例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        { field: "version", message: "別の操作で変更されました。" },
      ],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    const promise = TaskCommentApi.updateComment(5, 31, 41, {
      body: "競合する更新",
      version: 0,
    });

    await expect(promise).rejects.toMatchObject({
      status: 409,
      errorResponse,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(TaskCommentApiError)
    );
  });
});
