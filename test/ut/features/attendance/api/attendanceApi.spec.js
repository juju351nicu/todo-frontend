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

  it("本人月次を取得しnullable項目と日別配列を正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accountId: 1,
        yearMonth: "2026-09",
        statusCode: "DRAFT",
        grossWorkMinutes: 0,
        breakMinutes: 0,
        netWorkMinutes: 0,
        hasIncompletePeriod: false,
        version: 0,
      }),
    });

    await expect(AttendanceApi.getMonth("2026-09")).resolves.toMatchObject({
      attendanceMonthId: null,
      submittedAt: null,
      reviewComment: null,
      days: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/months/2026-09"
    );
  });

  it("管理一覧の状態絞込みをqueryへ設定する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ yearMonth: "2026-09" }),
    });

    await expect(
      AttendanceApi.getAdministrationMonths("2026-09", "SUBMITTED")
    ).resolves.toEqual({ yearMonth: "2026-09", months: [] });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/administration/months?yearMonth=2026-09&status=SUBMITTED"
    );
  });

  it("本人月次提出と管理対象account詳細をAPI契約どおり呼び出す", async () => {
    const payload = {
      attendanceMonthId: 31,
      accountId: 21,
      yearMonth: "2026-09",
      statusCode: "SUBMITTED",
      grossWorkMinutes: 480,
      breakMinutes: 60,
      netWorkMinutes: 420,
      hasIncompletePeriod: false,
      version: 1,
      days: [],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await AttendanceApi.submitMonth("2026-09", 0);
    await AttendanceApi.getAdministrationMonth(21, "2026-09");

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/months/2026-09/submit",
      { version: 0 }
    );
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/attendance/administration/accounts/21/months/2026-09"
    );
  });

  it("承認・差戻し・締めを最新version付きPOSTへ渡す", async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        attendanceMonthId: 31,
        accountId: 1,
        yearMonth: "2026-09",
        statusCode: "APPROVED",
        grossWorkMinutes: 480,
        breakMinutes: 60,
        netWorkMinutes: 420,
        hasIncompletePeriod: false,
        version: 2,
        days: [],
      }),
    };
    HttpClient.postRequest.mockResolvedValue(response);

    await AttendanceApi.approveMonth(31, 1, "確認済み");
    await AttendanceApi.rejectMonth(31, 1, "打刻を確認してください");
    await AttendanceApi.closeMonth(31, 2);

    expect(HttpClient.postRequest).toHaveBeenNthCalledWith(
      1,
      "/api/v1/attendance/administration/months/31/approve",
      { version: 1, reviewComment: "確認済み" }
    );
    expect(HttpClient.postRequest).toHaveBeenNthCalledWith(
      2,
      "/api/v1/attendance/administration/months/31/reject",
      { version: 1, reason: "打刻を確認してください" }
    );
    expect(HttpClient.postRequest).toHaveBeenNthCalledWith(
      3,
      "/api/v1/attendance/administration/months/31/close",
      { version: 2 }
    );
  });
});
