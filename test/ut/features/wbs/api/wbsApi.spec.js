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
      tasks: [
        {
          taskId: 11,
          parentTaskId: null,
          title: "設計",
          actualStartDate: null,
          actualEndDate: null,
        },
      ],
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

  it("V6以前のTask fixtureで実績日が欠けてもnullへ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        projectName: "開発Project",
        tasks: [{ taskId: 11, title: "設計" }],
      }),
    });

    const response = await WbsApi.getWbs(7);

    expect(response.tasks[0]).toEqual(
      expect.objectContaining({
        actualStartDate: null,
        actualEndDate: null,
      })
    );
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
      actualStartDate: "2026-08-22",
      actualEndDate: null,
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
        actualStartDate: null,
        actualEndDate: null,
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

  it("Task IDを含む日別予定APIから配賦合計と未登録時の空配列を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        taskId: 11,
        taskPlannedEffortMinutes: 480,
        totalDailyPlannedEffortMinutes: 0,
        unallocatedEffortMinutes: 480,
      }),
    });

    await expect(WbsApi.getTaskEffortPlans(7, 11)).resolves.toEqual({
      projectId: 7,
      taskId: 11,
      taskPlannedEffortMinutes: 480,
      totalDailyPlannedEffortMinutes: 0,
      unallocatedEffortMinutes: 480,
      effortPlans: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/effort-plans"
    );
  });

  it("予定日・工数・担当者をPOSTして確定後の日別予定一覧を返す", async () => {
    const request = {
      planDate: "2026-08-22",
      plannedEffortMinutes: 300,
      assigneeAccountId: 2,
    };
    const response = {
      projectId: 7,
      taskId: 11,
      taskPlannedEffortMinutes: 480,
      totalDailyPlannedEffortMinutes: 300,
      unallocatedEffortMinutes: 180,
      effortPlans: [{ effortPlanId: 51, taskId: 11, ...request, version: 0 }],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(WbsApi.createTaskEffortPlan(7, 11, request)).resolves.toEqual(
      response
    );
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/effort-plans",
      request
    );
  });

  it("日別予定IDとversionを含むRequestで登録済み予定を更新する", async () => {
    const request = {
      planDate: "2026-08-23",
      plannedEffortMinutes: 360,
      assigneeAccountId: 2,
      version: 3,
    };
    const response = {
      projectId: 7,
      taskId: 11,
      taskPlannedEffortMinutes: 480,
      totalDailyPlannedEffortMinutes: 360,
      unallocatedEffortMinutes: 120,
      effortPlans: [{ effortPlanId: 51, taskId: 11, ...request, version: 4 }],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.updateTaskEffortPlan(7, 11, 51, request)
    ).resolves.toEqual(response);
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/effort-plans/51",
      request
    );
  });

  it("日別予定IDとversionをDELETE queryへ含めて204を確定結果にする", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(
      WbsApi.deleteTaskEffortPlan(7, 11, 51, 3)
    ).resolves.toBeUndefined();
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/11/effort-plans/51?version=3"
    );
  });

  it("Project workloadの検索期間をURL queryへ含め予定・実績行を取得する", async () => {
    const response = {
      projectId: 7,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      totalPlannedEffortMinutes: 300,
      totalActualEffortMinutes: 480,
      totalVarianceEffortMinutes: 180,
      workloads: [
        {
          workDate: "2026-08-22",
          accountId: 2,
          accountDisplayName: "担当者",
          plannedEffortMinutes: 300,
          actualEffortMinutes: 480,
          varianceEffortMinutes: 180,
          availableMinutes: 360,
          remainingMinutes: 60,
          overAllocated: false,
        },
      ],
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.getTaskWorkload(7, "2026-08-01", "2026-08-31")
    ).resolves.toEqual(response);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/workload?dateFrom=2026-08-01&dateTo=2026-08-31"
    );
  });

  it("Project共通calendarではaccountIdを付けず期間内の全日付を取得する", async () => {
    const response = {
      projectId: 7,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.getWorkingCalendar(7, "2026-08-01", "2026-08-31", null)
    ).resolves.toEqual({ ...response, accountId: null, days: [] });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar?dateFrom=2026-08-01&dateTo=2026-08-31"
    );
  });

  it("member calendarでは対象accountIdをqueryへ追加する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        accountId: 2,
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        days: [],
      }),
    });

    await WbsApi.getWorkingCalendar(7, "2026-08-01", "2026-08-31", 2);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar?dateFrom=2026-08-01&dateTo=2026-08-31&accountId=2"
    );
  });

  it("Project共通例外を登録しID・version付きで更新削除する", async () => {
    const createRequest = {
      workDate: "2026-08-22",
      dayType: "HOLIDAY",
      availableMinutes: 0,
    };
    const updateRequest = { ...createRequest, version: 3 };
    const response = {
      projectId: 7,
      accountId: null,
      dateFrom: "2026-08-22",
      dateTo: "2026-08-22",
      days: [],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await WbsApi.createProjectWorkingDay(7, createRequest);
    await WbsApi.updateProjectWorkingDay(7, 11, updateRequest);
    await WbsApi.deleteProjectWorkingDay(7, 11, 4);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/project-days",
      createRequest
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/project-days/11",
      updateRequest
    );
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/project-days/11?version=4"
    );
  });

  it("member固有例外を対象accountId配下へ登録しID・version付きで更新削除する", async () => {
    const createRequest = {
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 300,
    };
    const updateRequest = { ...createRequest, version: 2 };
    const response = {
      projectId: 7,
      accountId: 2,
      dateFrom: "2026-08-22",
      dateTo: "2026-08-22",
      days: [],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await WbsApi.createMemberWorkingDay(7, 2, createRequest);
    await WbsApi.updateMemberWorkingDay(7, 2, 21, updateRequest);
    await WbsApi.deleteMemberWorkingDay(7, 2, 21, 3);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/members/2/days",
      createRequest
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/members/2/days/21",
      updateRequest
    );
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/calendar/members/2/days/21?version=3"
    );
  });

  it("baseline一覧で欠けた配列を空配列へ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projectId: 7 }),
    });

    await expect(WbsApi.getWbsBaselines(7)).resolves.toEqual({
      projectId: 7,
      baselines: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/baselines"
    );
  });

  it("active baseline詳細で欠けたsnapshot配列を空配列へ正規化する", async () => {
    const response = {
      projectId: 7,
      baseline: { baselineId: 21, name: "8月計画", active: true },
      plannedEffortMinutes: 480,
      allocatedEffortMinutes: 300,
      unallocatedEffortMinutes: 180,
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(WbsApi.getWbsBaseline(7, 21)).resolves.toEqual({
      ...response,
      tasks: [],
      dependencies: [],
      effortPlans: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/baselines/21"
    );
  });

  it("現在計画のbaseline名と説明をProject配下へPOSTする", async () => {
    const request = { name: "8月計画", description: "顧客合意時点" };
    const response = {
      baseline: { baselineId: 21, name: "8月計画", active: true },
      taskCount: 3,
      dependencyCount: 1,
      effortPlanCount: 2,
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(WbsApi.createWbsBaseline(7, request)).resolves.toEqual(response);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/baselines",
      request
    );
  });

  it("保存済みbaselineを取得時点version付きでactiveへ切り替える", async () => {
    const request = { version: 4 };
    const response = {
      baselineId: 21,
      name: "8月計画",
      active: true,
      version: 5,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.activateWbsBaseline(7, 21, request)
    ).resolves.toEqual(response);
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/baselines/21/activation",
      request
    );
  });

  it("EVM基準日をqueryへ含めBackend確定済み指標と明細を取得する", async () => {
    const response = {
      projectId: 7,
      baselineId: 21,
      baselineNumber: 1,
      baselineName: "8月計画",
      baselineDate: "2026-08-20",
      statusDate: "2026-08-30",
      businessZoneId: "Asia/Tokyo",
      valueUnit: "MINUTES",
      bac: 960,
      pv: 480,
      ev: 360,
      ac: 300,
      sv: -120,
      cv: 60,
      spi: 0.75,
      cpi: 1.2,
      plannedProgressPercent: 50,
      earnedProgressPercent: 37.5,
      baselineAllocatedEffortMinutes: 960,
      baselineAllocationVarianceMinutes: 0,
      excludedActualEffortMinutes: 0,
      warnings: [],
      tasks: [{ sourceTaskId: 11, title: "実装", pv: 480, ev: 360, ac: 300 }],
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(
      WbsApi.getEarnedValueMetrics(7, "2026-08-30")
    ).resolves.toEqual(response);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/metrics?statusDate=2026-08-30"
    );
  });

  it("古いEVM fixtureで警告・Task明細が欠けても空配列へ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        projectId: 7,
        baselineId: 21,
        statusDate: "2026-08-30",
      }),
    });

    await expect(
      WbsApi.getEarnedValueMetrics(7, "2026-08-30")
    ).resolves.toEqual({
      projectId: 7,
      baselineId: 21,
      statusDate: "2026-08-30",
      warnings: [],
      tasks: [],
    });
  });
});
