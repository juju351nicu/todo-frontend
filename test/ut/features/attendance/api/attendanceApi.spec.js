import { beforeEach, describe, expect, it, vi } from "vitest";

import AttendanceApi, {
  AttendanceApiError,
} from "@/features/attendance/api/attendanceApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

const attendanceDay = {
  attendanceDayId: 11,
  workDate: "2026-09-06",
  note: null,
  punchState: "WORKING",
  workPeriods: [
    {
      attendanceWorkPeriodId: 21,
      startedAt: "2026-09-06T00:00:00Z",
      endedAt: null,
      entrySource: "SELF_PUNCH",
      breakPeriods: [],
    },
  ],
};

describe("本人勤怠API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("日付範囲をqueryへ設定し登録済み勤怠一覧を正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30",
        days: [{ ...attendanceDay, workPeriods: undefined }],
      }),
    });

    await expect(
      AttendanceApi.getDays("2026-09-01", "2026-09-30")
    ).resolves.toEqual({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      days: [{ ...attendanceDay, workPeriods: [] }],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/days?dateFrom=2026-09-01&dateTo=2026-09-30"
    );
  });

  it("未打刻日のnullable値と勤務・休憩配列を確定して返す", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        workDate: "2026-09-06",
        punchState: "OFF_DUTY",
      }),
    });

    await expect(AttendanceApi.getDay("2026-09-06")).resolves.toEqual({
      attendanceDayId: null,
      workDate: "2026-09-06",
      note: null,
      punchState: "OFF_DUTY",
      workPeriods: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/days/2026-09-06"
    );
  });

  it("打刻操作をbodyなしのCSRF付きPOST境界へ渡す", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(attendanceDay),
    });

    await expect(AttendanceApi.punch("clock-in")).resolves.toEqual(
      attendanceDay
    );
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/punches/clock-in",
      null
    );
  });

  it("409本文をstatus付きAttendanceApiErrorへ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "ATTENDANCE_ALREADY_CLOCKED_IN",
          field: "punchState",
          message: "すでに出勤しています。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    const promise = AttendanceApi.punch("clock-in");

    await expect(promise).rejects.toMatchObject({
      status: 409,
      errorResponse,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(AttendanceApiError)
    );
  });
});
