import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceApiError } from "@/features/attendance/api/attendanceApi";
import { useAttendanceAdministrationPage } from "@/features/attendance/composables/useAttendanceAdministrationPage";

const mocks = vi.hoisted(() => ({
  attendanceApi: {
    approveMonth: vi.fn(),
    closeMonth: vi.fn(),
    getAdministrationMonth: vi.fn(),
    getAdministrationMonths: vi.fn(),
    rejectMonth: vi.fn(),
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

const listItem = {
  attendanceMonthId: 31,
  accountId: 21,
  loginId: "attendance-month-browser",
  displayName: "勤怠 月次",
  yearMonth: "2026-09",
  statusCode: "SUBMITTED",
  submittedAt: "2026-09-06T01:00:00Z",
  reviewedAt: null,
  reviewComment: null,
  closedAt: null,
  version: 1,
};

const buildDetail = (statusCode = "SUBMITTED", version = 1) => ({
  attendanceMonthId: 31,
  accountId: 21,
  yearMonth: "2026-09",
  statusCode,
  submittedBy: 21,
  submittedAt: "2026-09-06T01:00:00Z",
  reviewedBy: null,
  reviewedAt: null,
  reviewComment: null,
  closedBy: null,
  closedAt: null,
  grossWorkMinutes: 480,
  breakMinutes: 60,
  netWorkMinutes: 420,
  hasIncompletePeriod: false,
  version,
  days: [],
});

describe("useAttendanceAdministrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.hasPermission.mockImplementation((permission) =>
      ["ATTENDANCE_REVIEW", "ATTENDANCE_CLOSE"].includes(permission)
    );
    mocks.attendanceApi.getAdministrationMonths.mockResolvedValue({
      yearMonth: "2026-09",
      months: [listItem],
    });
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(
      buildDetail()
    );
  });

  it("対象月と状態で検索し選択accountの詳細を取得する", async () => {
    const page = useAttendanceAdministrationPage();
    page.selectedMonth.value = "2026-09";
    page.selectedStatus.value = "SUBMITTED";

    await page.search();
    await page.selectMonth(listItem);

    expect(mocks.attendanceApi.getAdministrationMonths).toHaveBeenCalledWith(
      "2026-09",
      "SUBMITTED"
    );
    expect(mocks.attendanceApi.getAdministrationMonth).toHaveBeenCalledWith(
      21,
      "2026-09"
    );
    expect(page.canApproveOrReject.value).toBe(true);
  });

  it("空白だけの差戻し理由ではAPIを呼ばない", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    page.rejectReason.value = "   ";

    await page.reject();

    expect(mocks.attendanceApi.rejectMonth).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "差戻し理由を入力してください。",
    ]);
  });

  it("提出済み月を理由付きで差し戻して一覧を再取得する", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    page.rejectReason.value = "退勤時刻を確認してください";
    mocks.attendanceApi.rejectMonth.mockResolvedValue(
      buildDetail("REJECTED", 2)
    );

    await page.reject();

    expect(mocks.attendanceApi.rejectMonth).toHaveBeenCalledWith(
      31,
      1,
      "退勤時刻を確認してください"
    );
    expect(page.selectedDetail.value.statusCode).toBe("REJECTED");
    expect(page.successMessage.value).toBe("勤怠月を差し戻しました。");
    expect(mocks.attendanceApi.getAdministrationMonths).toHaveBeenCalledOnce();
  });

  it("ATTENDANCE_CLOSEがある管理者だけAPPROVED月を締められる", async () => {
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(
      buildDetail("APPROVED", 2)
    );
    mocks.attendanceApi.closeMonth.mockResolvedValue(
      buildDetail("CLOSED", 3)
    );
    const page = useAttendanceAdministrationPage();
    await page.selectMonth({ ...listItem, statusCode: "APPROVED", version: 2 });

    await page.close();

    expect(mocks.attendanceApi.closeMonth).toHaveBeenCalledWith(31, 2);
    expect(page.selectedDetail.value.statusCode).toBe("CLOSED");
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.attendanceApi.getAdministrationMonths.mockRejectedValue(
      new AttendanceApiError(401, null)
    );
    const page = useAttendanceAdministrationPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409時は古いversionを維持せず詳細と一覧を再取得する", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    mocks.attendanceApi.approveMonth.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            field: "version",
            errorCode: "ATTENDANCE_VERSION_CONFLICT",
            message: "ほかの利用者が更新しました。",
          },
        ],
      })
    );
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(
      buildDetail("APPROVED", 2)
    );

    await page.approve();

    expect(mocks.attendanceApi.getAdministrationMonth).toHaveBeenCalledTimes(2);
    expect(mocks.attendanceApi.getAdministrationMonths).toHaveBeenCalledOnce();
    expect(page.selectedDetail.value.version).toBe(2);
    expect(page.errorMessages.value).toEqual([
      "ほかの利用者が更新しました。",
    ]);
  });
});
