import { beforeEach, describe, expect, it, vi } from "vitest";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: { getRequest: vi.fn() },
}));

describe("WBS API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Project IDを含む参照APIからBoardと共通のTaskを取得する", async () => {
    const wbs = {
      projectId: 7,
      projectName: "開発Project",
      tasks: [{ taskId: 11, parentTaskId: null, title: "設計" }],
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(wbs),
    });

    await expect(WbsApi.getWbs(7)).resolves.toEqual(wbs);
    expect(HttpClient.getRequest).toHaveBeenCalledWith("/api/v1/projects/7/wbs");
  });

  it("古いfixtureでtasksが欠けても空配列として返す", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        projectName: "空Project",
      }),
    });

    await expect(WbsApi.getWbs(7)).resolves.toEqual({
      projectId: 7,
      projectName: "空Project",
      tasks: [],
    });
  });

  it("JSON本文のない404をstatus付きWbsApiErrorへ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    const promise = WbsApi.getWbs(99);

    await expect(promise).rejects.toMatchObject({
      status: 404,
      errorResponse: null,
    });
    await promise.catch((error) => expect(error).toBeInstanceOf(WbsApiError));
  });
});
