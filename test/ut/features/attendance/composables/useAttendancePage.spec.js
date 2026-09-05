import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceApiError } from "@/features/attendance/api/attendanceApi";
import { useAttendancePage } from "@/features/attendance/composables/useAttendancePage";

const mocks = vi.hoisted(() => ({
  attendanceApi: {
    getDay: vi.fn(),
    getDays: vi.fn(),
    punch: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/attendance/api/attendanceApi", async () => {
  const actual = await vi.importActual(
    "@/features/attendance/api/attendanceApi"
  );
  return { ...actual, default: mocks.attendanceApi };
});

const buildDay = (workDate, punchState = "OFF_DUTY") => ({
  attendanceDayId: punchState === "OFF_DUTY" ? null : 11,
  workDate,
  note: null,
  punchState,
  workPeriods: [],
});

describe("useAttendancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.hasPermission.mockImplementation(
      (code) => code === "ATTENDANCE_WRITE_OWN"
    );
    mocks.attendanceApi.getDays.mockImplementation((dateFrom, dateTo) =>
      Promise.resolve({ dateFrom, dateTo, days: [] })
    );
    mocks.attendanceApi.getDay.mockImplementation((workDate) =>
      Promise.resolve(buildDay(workDate))
    );
  });

  it("初期表示で東京の当日詳細と表示月一覧を並列取得する", async () => {
    const page = useAttendancePage();

    await page.initialize();

    expect(mocks.attendanceApi.getDays).toHaveBeenCalledWith(
      `${page.selectedMonth.value}-01`,
      expect.stringMatching(new RegExp(`^${page.selectedMonth.value}-`))
    );
    expect(mocks.attendanceApi.getDay).toHaveBeenCalledWith(page.today);
    expect(page.selectedDay.value.workDate).toBe(page.today);
    expect(page.canClockIn.value).toBe(true);
  });

  it("表示月変更時は月初日を選択して月内全日を組み立てる", async () => {
    const page = useAttendancePage();

    await page.changeMonth("2028-02");

    expect(mocks.attendanceApi.getDays).toHaveBeenCalledWith(
      "2028-02-01",
      "2028-02-29"
    );
    expect(mocks.attendanceApi.getDay).toHaveBeenCalledWith("2028-02-01");
    expect(page.monthRows.value).toHaveLength(29);
    expect(page.selectedWorkDate.value).toBe("2028-02-01");
    expect(page.canClockIn.value).toBe(false);
  });

  it("月一覧の日付選択時は対象日詳細だけを再取得する", async () => {
    const page = useAttendancePage();
    await page.changeMonth("2026-09");

    await page.selectWorkDate("2026-09-10");

    expect(mocks.attendanceApi.getDay).toHaveBeenLastCalledWith("2026-09-10");
    expect(page.selectedWorkDate.value).toBe("2026-09-10");
  });

  it("打刻成功後はBackendが返した勤務日へ同期して月一覧を更新する", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.punch.mockResolvedValue(
      buildDay(page.today, "WORKING")
    );

    await page.executePunch("clock-in");

    expect(mocks.attendanceApi.punch).toHaveBeenCalledWith("clock-in");
    expect(mocks.attendanceApi.getDays).toHaveBeenCalledTimes(2);
    expect(page.selectedDay.value.punchState).toBe("WORKING");
    expect(page.canClockOut.value).toBe(true);
    expect(page.canStartBreak.value).toBe(true);
    expect(page.successMessage.value).toBe("出勤を記録しました。");
  });

  it("処理中の打刻操作を二重送信しない", async () => {
    const page = useAttendancePage();
    await page.initialize();
    let resolvePunch;
    mocks.attendanceApi.punch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePunch = resolve;
        })
    );

    const first = page.executePunch("clock-in");
    const second = page.executePunch("clock-in");

    expect(mocks.attendanceApi.punch).toHaveBeenCalledOnce();
    resolvePunch(buildDay(page.today, "WORKING"));
    await Promise.all([first, second]);
  });

  it("409はBackendメッセージを表示して月一覧と選択日を再取得する", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.punch.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_ALREADY_CLOCKED_IN",
            field: "punchState",
            message: "すでに出勤しています。",
          },
        ],
      })
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual(["すでに出勤しています。"]);
    expect(mocks.attendanceApi.getDays).toHaveBeenCalledTimes(2);
    expect(mocks.attendanceApi.getDay).toHaveBeenCalledTimes(2);
  });

  it("401はSessionを破棄してログイン画面へ戻す", async () => {
    mocks.attendanceApi.getDays.mockRejectedValue(
      new AttendanceApiError(401, null)
    );
    const page = useAttendancePage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
