import { beforeEach, describe, expect, it, vi } from "vitest";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: { getRequest: vi.fn(), putRequest: vi.fn() },
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

  it("ProjectとTask IDを含む更新APIへversion付きWBS情報を送る", async () => {
    const request = {
      parentTaskId: 10,
      taskType: "TASK",
      wbsCode: "1.1",
      plannedStartDate: "2026-08-22",
      plannedEndDate: "2026-08-24",
      plannedEffortMinutes: 480,
      progressPercent: 37.5,
      version: 4,
    };
    const updatedWbs = {
      projectId: 7,
      projectName: "開発Project",
      tasks: [{ taskId: 11, ...request, title: "設計" }],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(updatedWbs),
    });

    await expect(WbsApi.updateWbsTask(7, 11, request)).resolves.toEqual(
      updatedWbs
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11",
      request
    );
  });

  it("更新APIの項目エラー本文をstatus付きWbsApiErrorへ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        { field: "plannedEndDate", message: "予定終了日が不正です。" },
      ],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      WbsApi.updateWbsTask(7, 11, {
        parentTaskId: null,
        taskType: "TASK",
        wbsCode: null,
        plannedStartDate: "2026-08-24",
        plannedEndDate: "2026-08-22",
        plannedEffortMinutes: 0,
        progressPercent: 0,
        version: 4,
      })
    ).rejects.toMatchObject({ status: 400, errorResponse });
  });
});
