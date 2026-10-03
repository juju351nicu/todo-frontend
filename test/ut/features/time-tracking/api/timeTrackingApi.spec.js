import { beforeEach, describe, expect, it, vi } from "vitest";

import TimeTrackingApi, {
  TimeTrackingApiError,
} from "@/features/time-tracking/api/timeTrackingApi";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  postRequest: vi.fn(),
}));

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: mocks.getRequest,
    postRequest: mocks.postRequest,
  },
}));

const currentResponse = {
  serverTime: "2026-10-03T10:00:00+09:00",
  timer: {
    timerSessionId: 101,
    projectId: 12,
    projectKey: "WORK",
    projectName: "Work Management",
    taskId: 345,
    taskTitle: "Timer UI",
    startedAt: "2026-10-03T09:30:00+09:00",
    elapsedSeconds: 1800,
    version: 0,
  },
};

describe("TimeTrackingApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("現在Timerを本人用pathから取得する", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(JSON.stringify(currentResponse), { status: 200 })
    );

    await expect(TimeTrackingApi.getCurrentTimer()).resolves.toEqual(
      currentResponse
    );
    expect(mocks.getRequest).toHaveBeenCalledWith(
      "/api/v1/time-tracking/current"
    );
  });

  it("指定Project Taskへbodyなしの開始Requestを送る", async () => {
    mocks.postRequest.mockResolvedValue(
      new Response(JSON.stringify(currentResponse), { status: 201 })
    );

    await TimeTrackingApi.startTimer(12, 345);

    expect(mocks.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/12/tasks/345/timer/start",
      null
    );
  });

  it("停止と取消へ現在versionだけを送る", async () => {
    const stopResponse = {
      serverTime: "2026-10-03T10:30:00+09:00",
      session: { statusCode: "STOPPED" },
      allocations: undefined,
    };
    mocks.postRequest
      .mockResolvedValueOnce(
        new Response(JSON.stringify(stopResponse), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...currentResponse, timer: null }),
          { status: 200 }
        )
      );

    const stopped = await TimeTrackingApi.stopCurrentTimer({ version: 3 });
    await TimeTrackingApi.cancelCurrentTimer({ version: 4 });

    expect(stopped.allocations).toEqual([]);
    expect(mocks.postRequest).toHaveBeenNthCalledWith(
      1,
      "/api/v1/time-tracking/current/stop",
      { version: 3 }
    );
    expect(mocks.postRequest).toHaveBeenNthCalledWith(
      2,
      "/api/v1/time-tracking/current/cancel",
      { version: 4 }
    );
  });

  it("本人履歴の期間とpagingをqueryへ設定して欠落配列を正規化する", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          page: 1,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
        { status: 200 }
      )
    );

    const result = await TimeTrackingApi.getSessions({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      page: 1,
      size: 20,
    });

    expect(result.sessions).toEqual([]);
    expect(mocks.getRequest).toHaveBeenCalledWith(
      "/api/v1/time-tracking/sessions?dateFrom=2026-09-01&dateTo=2026-09-30&page=1&size=20"
    );
  });

  it("Task工数監査をProject Taskとpaging付きで取得する", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          projectId: 12,
          taskId: 345,
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
        { status: 200 }
      )
    );

    const result = await TimeTrackingApi.getWorkLogAudits(12, 345, 0, 20);

    expect(result.audits).toEqual([]);
    expect(mocks.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/12/wbs/tasks/345/work-log-audits?page=0&size=20"
    );
  });

  it("非2xxをstatusとBackend field error付き例外へ変換する", async () => {
    mocks.postRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          fieldErrors: [
            {
              errorCode: "TASK_TIMER_ALREADY_RUNNING",
              field: "timer",
              message: "Timerはすでに実行中です。",
            },
          ],
        }),
        { status: 409 }
      )
    );

    await expect(TimeTrackingApi.startTimer(12, 345)).rejects.toMatchObject({
      status: 409,
      errorResponse: {
        fieldErrors: [
          expect.objectContaining({ errorCode: "TASK_TIMER_ALREADY_RUNNING" }),
        ],
      },
    });
    await expect(TimeTrackingApi.startTimer(12, 345)).rejects.toBeInstanceOf(
      TimeTrackingApiError
    );
  });
});
