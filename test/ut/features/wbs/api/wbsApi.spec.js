import { beforeEach, describe, expect, it, vi } from "vitest";

import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
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

  it("Project IDを含む依存関係APIから未登録時も空配列を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projectId: 7 }),
    });

    await expect(WbsApi.getTaskDependencies(7)).resolves.toEqual({
      projectId: 7,
      dependencies: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/dependencies"
    );
  });

  it("Finish-to-Start依存関係をPOSTして確定後の一覧を返す", async () => {
    const request = {
      predecessorTaskId: 11,
      successorTaskId: 12,
      dependencyType: "FINISH_TO_START",
      lagMinutes: 30,
    };
    const response = {
      projectId: 7,
      dependencies: [
        { dependencyId: 31, ...request, version: 0 },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(WbsApi.createTaskDependency(7, request)).resolves.toEqual(
      response
    );
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/dependencies",
      request
    );
  });

  it("Task依存関係IDとversionをDELETE queryへ含めて204を確定結果にする", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(WbsApi.deleteTaskDependency(7, 31, 4)).resolves.toBeUndefined();
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/dependencies/31?version=4"
    );
  });

  it("削除競合のBackend本文をstatus付きWbsApiErrorへ保持する", async () => {
    const errorResponse = {
      fieldErrors: [{ field: "version", message: "更新されています。" }],
    };
    HttpClient.deleteRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(WbsApi.deleteTaskDependency(7, 31, 4)).rejects.toMatchObject({
      status: 409,
      errorResponse,
    });
  });

  it("Task IDを含む日別実績APIから合計と未登録時の空配列を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        taskId: 11,
        totalActualEffortMinutes: 0,
      }),
    });

    await expect(WbsApi.getTaskWorkLogs(7, 11)).resolves.toEqual({
      projectId: 7,
      taskId: 11,
      totalActualEffortMinutes: 0,
      workLogs: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/work-logs"
    );
  });

  it("業務日・工数・作業者をPOSTして確定後の日別実績一覧を返す", async () => {
    const request = {
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    };
    const response = {
      projectId: 7,
      taskId: 11,
      totalActualEffortMinutes: 480,
      workLogs: [{ workLogId: 41, taskId: 11, ...request, version: 0 }],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(WbsApi.createTaskWorkLog(7, 11, request)).resolves.toEqual(
      response
    );
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/work-logs",
      request
    );
  });

  it("日別実績IDとversionを含むRequestで登録済み実績を更新する", async () => {
    const request = {
      workDate: "2026-08-23",
      actualEffortMinutes: 510,
      workerAccountId: 2,
      version: 3,
    };
    const response = {
      projectId: 7,
      taskId: 11,
      totalActualEffortMinutes: 510,
      workLogs: [{ workLogId: 41, taskId: 11, ...request, version: 4 }],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.updateTaskWorkLog(7, 11, 41, request)
    ).resolves.toEqual(response);
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/work-logs/41",
      request
    );
  });

  it("日別実績IDとversionをDELETE queryへ含めて204を確定結果にする", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(
      WbsApi.deleteTaskWorkLog(7, 11, 41, 3)
    ).resolves.toBeUndefined();
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/work-logs/41?version=3"
    );
  });

  it("日別実績の重複競合本文をstatus付きWbsApiErrorへ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        { field: "workDate", message: "同じ日の実績が登録されています。" },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      WbsApi.createTaskWorkLog(7, 11, {
        workDate: "2026-08-22",
        actualEffortMinutes: 480,
        workerAccountId: 2,
      })
    ).rejects.toMatchObject({ status: 409, errorResponse });
  });
});
