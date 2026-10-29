import { beforeEach, describe, expect, it, vi } from "vitest";

import MyTaskApi from "@/features/task/api/myTaskApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

describe("My Tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("My Tasks専用APIから本人担当Taskを取得する", async () => {
    const payload = { businessDate: "2026-09-20", tasks: [] };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(MyTaskApi.findMyTasks()).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.MY_TASKS);
  });

  it("My Tasks取得のHTTPエラーを通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 403 });

    await expect(MyTaskApi.findMyTasks()).rejects.toMatchObject({
      name: "MyTaskApiError",
      status: 403,
    });
  });

  it("完了はTaskの完了APIへ取得時点のversionを渡す", async () => {
    HttpClient.postRequest.mockResolvedValue({ ok: true });

    await expect(MyTaskApi.completeMyTask(3, 15, 7)).resolves.toBeUndefined();

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      `${API_PATHS.PROJECTS}/3/tasks/15/complete`,
      { version: 7 }
    );
  });
});
