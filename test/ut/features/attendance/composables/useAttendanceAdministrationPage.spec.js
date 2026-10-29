import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { AttendanceApiError } from "@/features/attendance/api/attendanceApi";
import {
  ATTENDANCE_ADMIN_CONTROL,
  useAttendanceAdministrationPage,
} from "@/features/attendance/composables/useAttendanceAdministrationPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

const mocks = vi.hoisted(() => ({
  attendanceApi: {
    approveCorrectionRequest: vi.fn(),
    approveMonth: vi.fn(),
    closeMonth: vi.fn(),
    downloadAdministrationMonthlyCsv: vi.fn(),
    getAdministrationMonth: vi.fn(),
    getAdministrationMonths: vi.fn(),
    getAdministrationCorrectionRequests: vi.fn(),
    rejectCorrectionRequest: vi.fn(),
    rejectMonth: vi.fn(),
  },
  /** フォーカスを戻した部品のselector。単体テストにはDOMがないため、documentの差し替えで記録する。 */
  focusedSelectors: [],
  appendDownloadAnchor: vi.fn(),
  clickDownloadAnchor: vi.fn(),
  createObjectUrl: vi.fn(() => "blob:attendance-export"),
  removeDownloadAnchor: vi.fn(),
  revokeObjectUrl: vi.fn(),
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
  const actual = await vi.importActual("@/features/attendance/api/attendanceApi");
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

const correctionRequest = {
  attendanceCorrectionRequestId: 41,
  accountId: 21,
  loginId: "attendance-user",
  displayName: "勤怠 利用者",
  workDate: "2026-09-05",
  attendanceDayId: 51,
  baseDayVersion: 0,
  requestedBy: 21,
  proposedNote: "修正後",
  reason: "退勤時刻訂正",
  statusCode: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  reviewComment: null,
  requestedAt: "2026-09-06T00:00:00Z",
  version: 2,
  workPeriods: [],
};

describe("useAttendanceAdministrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.hasPermission.mockImplementation((permission) =>
      ["ATTENDANCE_REVIEW", "ATTENDANCE_CLOSE", "ATTENDANCE_EXPORT"].includes(permission)
    );
    mocks.attendanceApi.getAdministrationMonths.mockResolvedValue({
      yearMonth: "2026-09",
      months: [listItem],
    });
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(buildDetail());
    mocks.attendanceApi.getAdministrationCorrectionRequests.mockResolvedValue({
      correctionRequests: [correctionRequest],
    });
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockResolvedValue({
      content: new Blob(["attendance-csv"]),
      fileName: "work-management-attendance-2026-09.csv",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: mocks.createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: mocks.revokeObjectUrl,
    });
    mocks.focusedSelectors = [];
    vi.stubGlobal("document", {
      body: { appendChild: mocks.appendDownloadAnchor },
      querySelector: (selector) => ({
        focus: () => mocks.focusedSelectors.push(selector),
        matches: () => false,
      }),
      createElement: vi.fn(() => ({
        click: mocks.clickDownloadAnchor,
        download: "",
        href: "",
        remove: mocks.removeDownloadAnchor,
        style: { display: "" },
      })),
    });
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
    expect(mocks.attendanceApi.getAdministrationMonth).toHaveBeenCalledWith(21, "2026-09");
    expect(page.canApproveOrReject.value).toBe(true);
  });

  it("状態ですべてを選んだ場合は状態条件なしで検索する", async () => {
    const page = useAttendanceAdministrationPage();
    page.selectedMonth.value = "2026-09";

    await page.search();

    expect(page.selectedStatus.value).toBe("ALL");
    expect(mocks.attendanceApi.getAdministrationMonths).toHaveBeenCalledWith("2026-09", null);
  });

  it("空白だけの差戻し理由ではAPIを呼ばない", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    page.rejectReason.value = "   ";

    await page.reject();

    expect(mocks.attendanceApi.rejectMonth).not.toHaveBeenCalled();
    // 画面上部では押した位置から見えないため、入力欄の下へ出して入力欄へ移す。
    expect(page.monthRejectReasonError.value).toBe("差戻し理由を入力してください。");
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.focusedSelectors).toEqual([
      `[data-attendance-admin-control="${ATTENDANCE_ADMIN_CONTROL.rejectReason}"]`,
    ]);
  });

  it("差戻し理由を入力すると、入力欄の下の案内を消す", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    await page.reject();

    page.rejectReason.value = "休憩を確認";
    await nextTick();

    expect(page.monthRejectReasonError.value).toBe("");
  });

  it("承認の後は、消えたボタンの代わりに一覧の同じ行へフォーカスを戻す", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    mocks.focusedSelectors.length = 0;

    await page.approve();

    // 単体テストのdocumentは常に要素を返すため、候補の先頭（押したボタン）へ戻したことだけを確かめる。
    expect(mocks.focusedSelectors).toEqual(['[data-attendance-admin-control="approve"]']);
  });

  it("提出済み月を理由付きで差し戻して一覧を再取得する", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    page.rejectReason.value = "退勤時刻を確認してください";
    mocks.attendanceApi.rejectMonth.mockResolvedValue(buildDetail("REJECTED", 2));

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
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(buildDetail("APPROVED", 2));
    mocks.attendanceApi.closeMonth.mockResolvedValue(buildDetail("CLOSED", 3));
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

  it("修正審査permissionがない利用者は初期表示で修正申請APIを呼ばない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useAttendanceAdministrationPage();

    await page.initialize();

    expect(page.canReview.value).toBe(false);
    expect(mocks.attendanceApi.getAdministrationCorrectionRequests).not.toHaveBeenCalled();
  });

  it("修正申請と現在勤怠を比較し最新versionで承認して一覧を更新する", async () => {
    const currentDay = {
      attendanceDayId: 51,
      version: 0,
      workDate: "2026-09-05",
      note: null,
      punchState: "OFF_DUTY",
      workPeriods: [],
    };
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue({
      ...buildDetail(),
      days: [currentDay],
    });
    mocks.attendanceApi.approveCorrectionRequest.mockResolvedValue({
      ...correctionRequest,
      statusCode: "APPROVED",
      version: 3,
    });
    const page = useAttendanceAdministrationPage();
    await page.initialize();
    await page.selectCorrectionRequest(correctionRequest);
    page.correctionReviewComment.value = "確認済み";

    await page.approveCorrectionRequest();

    expect(mocks.attendanceApi.approveCorrectionRequest).toHaveBeenCalledWith(41, 2, "確認済み");
    expect(page.successMessage.value).toBe("勤怠修正申請を承認しました。");
    expect(mocks.attendanceApi.getAdministrationCorrectionRequests).toHaveBeenCalledTimes(2);
    expect(page.selectedCorrectionCurrentDay.value).toEqual(currentDay);
  });

  it("空白の却下理由では修正申請APIを呼ばない", async () => {
    const page = useAttendanceAdministrationPage();
    await page.initialize();
    await page.selectCorrectionRequest(correctionRequest);
    page.correctionRejectReason.value = "   ";

    await page.rejectCorrectionRequest();

    expect(mocks.attendanceApi.rejectCorrectionRequest).not.toHaveBeenCalled();
    expect(page.correctionRejectReasonError.value).toBe("却下理由を入力してください。");
    expect(page.errorMessages.value).toEqual([]);
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
    mocks.attendanceApi.getAdministrationMonth.mockResolvedValue(buildDetail("APPROVED", 2));

    await page.approve();

    expect(mocks.attendanceApi.getAdministrationMonth).toHaveBeenCalledTimes(2);
    expect(mocks.attendanceApi.getAdministrationMonths).toHaveBeenCalledOnce();
    expect(page.selectedDetail.value.version).toBe(2);
    // 取り直し済みなので、Backendの「最新状態を読み直してください」の後ろに取り直し済みの案内を添える。
    expect(page.errorMessages.value).toEqual([
      "ほかの利用者が更新しました。",
      DISPLAY_MESSAGES.attendance.conflictReloaded,
    ]);
  });

  it("月の状態の409は、取り直しても同じなので取り直し済みの案内を添えない", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    mocks.attendanceApi.approveMonth.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            field: "statusCode",
            errorCode: "ATTENDANCE_MONTH_STATE_CONFLICT",
            message: "提出済みの月だけを審査できます。",
          },
        ],
      })
    );

    await page.approve();

    expect(page.errorMessages.value).toEqual(["提出済みの月だけを審査できます。"]);
  });

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    mocks.attendanceApi.getAdministrationMonths.mockRejectedValueOnce(
      new AttendanceApiError(400, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_YEAR_MONTH_REQUIRED",
            field: "yearMonth",
            message: " 対象月を入力してください。 ",
          },
          {
            errorCode: "ATTENDANCE_DATE_RANGE_INVALID",
            field: "dateTo",
            message: "対象期間を確認してください。",
          },
        ],
      })
    );
    const page = useAttendanceAdministrationPage();

    await page.search();

    expect(page.errorMessages.value).toEqual([
      "対象月を入力してください。",
      "対象期間を確認してください。",
    ]);
  });

  it("未知codeのBackend messageを表示せず管理一覧のfallbackへ閉じる", async () => {
    mocks.attendanceApi.getAdministrationMonths.mockRejectedValueOnce(
      new AttendanceApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_ATTENDANCE_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const page = useAttendanceAdministrationPage();

    await page.search();

    expect(page.errorMessages.value).toEqual(["勤怠月一覧を取得できませんでした。"]);
  });

  it("本文なし403ではSessionを維持して管理勤怠の権限不足を表示する", async () => {
    mocks.attendanceApi.getAdministrationMonth.mockRejectedValueOnce(
      new AttendanceApiError(403, null)
    );
    const page = useAttendanceAdministrationPage();

    await page.selectMonth(listItem);

    expect(page.errorMessages.value).toEqual([
      "勤怠月を参照または更新するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("404ではBackend本文に依存せず管理対象なしを表示する", async () => {
    mocks.attendanceApi.getAdministrationMonth.mockRejectedValueOnce(
      new AttendanceApiError(404, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_MONTH_NOT_FOUND",
            field: "attendanceMonthId",
            message: "localeで変化する対象なし文言",
          },
        ],
      })
    );
    const page = useAttendanceAdministrationPage();

    await page.selectMonth(listItem);

    expect(page.errorMessages.value).toEqual(["対象のアカウントまたは勤怠月が見つかりません。"]);
  });

  it("月次409後の再取得で401になった場合は競合案内を残さずSessionを破棄する", async () => {
    const page = useAttendanceAdministrationPage();
    await page.selectMonth(listItem);
    mocks.attendanceApi.approveMonth.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_MONTH_VERSION_CONFLICT",
            field: "version",
            message: "ほかの利用者が更新しました。",
          },
        ],
      })
    );
    mocks.attendanceApi.getAdministrationMonth.mockRejectedValueOnce(
      new AttendanceApiError(401, null)
    );

    await page.approve();

    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("修正審査409後の再取得で401になった場合も競合案内を残さない", async () => {
    const page = useAttendanceAdministrationPage();
    await page.initialize();
    await page.selectCorrectionRequest(correctionRequest);
    mocks.attendanceApi.approveCorrectionRequest.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_CORRECTION_VERSION_CONFLICT",
            field: "version",
            message: "ほかの利用者が審査しました。",
          },
        ],
      })
    );
    mocks.attendanceApi.getAdministrationCorrectionRequests.mockRejectedValueOnce(
      new AttendanceApiError(401, null)
    );

    await page.approveCorrectionRequest();

    expect(page.errorMessages.value).toEqual([]);
    expect(page.selectedCorrection.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("ATTENDANCE_EXPORTを持つ管理者は選択月CSVを1回保存して一時URLを解放する", async () => {
    const page = useAttendanceAdministrationPage();
    page.selectedMonth.value = "2026-09";

    await page.downloadMonthlyCsv();

    expect(page.canExport.value).toBe(true);
    expect(mocks.attendanceApi.downloadAdministrationMonthlyCsv).toHaveBeenCalledWith("2026-09");
    expect(mocks.createObjectUrl).toHaveBeenCalledOnce();
    expect(mocks.appendDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.clickDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.removeDownloadAnchor).toHaveBeenCalledOnce();
    expect(mocks.revokeObjectUrl).toHaveBeenCalledWith("blob:attendance-export");
    expect(page.successMessage.value).toBe("月次勤怠CSVをダウンロードしました。");
    expect(page.isExportingMonthlyCsv.value).toBe(false);
  });

  it("不正な対象月では月次CSV APIを呼ばず入力理由を表示する", async () => {
    const page = useAttendanceAdministrationPage();
    page.selectedMonth.value = "2026-13";

    await page.downloadMonthlyCsv();

    expect(mocks.attendanceApi.downloadAdministrationMonthlyCsv).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["実在する表示月を指定してください。"]);
  });

  it("月次CSVの出力の後は「月次CSV」へフォーカスを戻す", async () => {
    const page = useAttendanceAdministrationPage();
    mocks.focusedSelectors.length = 0;

    await page.downloadMonthlyCsv();

    expect(mocks.focusedSelectors).toEqual([
      `[data-attendance-admin-control="${ATTENDANCE_ADMIN_CONTROL.export}"]`,
    ]);
  });

  it("月次CSV生成中の再操作は無視して二重downloadを防ぐ", async () => {
    let resolveDownload;
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
    );
    const page = useAttendanceAdministrationPage();
    page.selectedMonth.value = "2026-09";

    const firstDownload = page.downloadMonthlyCsv();
    await page.downloadMonthlyCsv();

    expect(page.isExportingMonthlyCsv.value).toBe(true);
    expect(mocks.attendanceApi.downloadAdministrationMonthlyCsv).toHaveBeenCalledTimes(1);
    resolveDownload({
      content: new Blob(["attendance-csv"]),
      fileName: "work-management-attendance-2026-09.csv",
    });
    await firstDownload;
    expect(page.isExportingMonthlyCsv.value).toBe(false);
  });

  it("月次CSV取得の401はSessionを破棄してログインへ戻す", async () => {
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockRejectedValue(
      new AttendanceApiError(401, null)
    );
    const page = useAttendanceAdministrationPage();

    await page.downloadMonthlyCsv();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(mocks.createObjectUrl).not.toHaveBeenCalled();
  });

  it("月次CSVの本文なし403をSession失効にせず権限不足として表示する", async () => {
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockRejectedValue(
      new AttendanceApiError(403, null)
    );
    const page = useAttendanceAdministrationPage();

    await page.downloadMonthlyCsv();

    expect(page.errorMessages.value).toEqual(["月次勤怠CSVを出力するpermissionがありません。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("月次CSVの契約済み409 messageを表示する", async () => {
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_EXPORT_ROW_LIMIT_EXCEEDED",
            field: "yearMonth",
            message: "出力上限を超えています。",
          },
        ],
      })
    );
    const page = useAttendanceAdministrationPage();

    await page.downloadMonthlyCsv();

    expect(page.errorMessages.value).toEqual(["出力上限を超えています。"]);
  });

  it("月次CSVの未知codeは出力用fallbackへ閉じる", async () => {
    mocks.attendanceApi.downloadAdministrationMonthlyCsv.mockRejectedValue(
      new AttendanceApiError(500, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_EXPORT_ERROR",
            field: "export",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const page = useAttendanceAdministrationPage();

    await page.downloadMonthlyCsv();

    expect(page.errorMessages.value).toEqual(["月次勤怠CSVを出力できませんでした。"]);
  });

  it("ATTENDANCE_EXPORTがない利用者は月次CSV APIを呼べない", async () => {
    mocks.userStore.hasPermission.mockImplementation(
      (permission) => permission !== "ATTENDANCE_EXPORT"
    );
    const page = useAttendanceAdministrationPage();

    await page.downloadMonthlyCsv();

    expect(page.canExport.value).toBe(false);
    expect(mocks.attendanceApi.downloadAdministrationMonthlyCsv).not.toHaveBeenCalled();
  });
});
