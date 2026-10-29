import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceApiError } from "@/features/attendance/api/attendanceApi";
import {
  ATTENDANCE_CONTROL,
  useAttendancePage,
} from "@/features/attendance/composables/useAttendancePage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

const mocks = vi.hoisted(() => ({
  attendanceApi: {
    cancelCorrectionRequest: vi.fn(),
    createCorrectionRequest: vi.fn(),
    getDay: vi.fn(),
    getDays: vi.fn(),
    getMonth: vi.fn(),
    getOwnCorrectionRequests: vi.fn(),
    punch: vi.fn(),
    submitMonth: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: {
    clearSession: vi.fn(),
    displayName: "テスト利用者",
    hasPermission: vi.fn(),
    username: "test-user",
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
  version: punchState === "OFF_DUTY" ? null : 0,
  workDate,
  note: null,
  punchState,
  netWorkMinutes: 0,
  taskActualMinutes: 0,
  unallocatedMinutes: 0,
  allocationStatus: "BALANCED",
  workPeriods: [],
});

const buildMonth = (yearMonth, statusCode = "DRAFT", overrides = {}) => ({
  attendanceMonthId: statusCode === "DRAFT" ? null : 31,
  accountId: 1,
  yearMonth,
  statusCode,
  submittedBy: null,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewComment: null,
  closedBy: null,
  closedAt: null,
  grossWorkMinutes: 480,
  breakMinutes: 60,
  netWorkMinutes: 420,
  hasIncompletePeriod: false,
  version: 0,
  days: [],
  ...overrides,
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
    mocks.attendanceApi.getMonth.mockImplementation((yearMonth) =>
      Promise.resolve(buildMonth(yearMonth))
    );
    mocks.attendanceApi.getOwnCorrectionRequests.mockResolvedValue({
      correctionRequests: [],
    });
  });

  it("初期表示で東京の当日詳細と表示月一覧を並列取得する", async () => {
    const page = useAttendancePage();

    await page.initialize();

    expect(mocks.attendanceApi.getDays).toHaveBeenCalledWith(
      `${page.selectedMonth.value}-01`,
      expect.stringMatching(new RegExp(`^${page.selectedMonth.value}-`))
    );
    expect(mocks.attendanceApi.getDay).toHaveBeenCalledWith(page.today);
    expect(mocks.attendanceApi.getMonth).toHaveBeenCalledWith(
      page.selectedMonth.value
    );
    expect(mocks.attendanceApi.getOwnCorrectionRequests).toHaveBeenCalledWith(
      page.today
    );
    expect(page.selectedDay.value.workDate).toBe(page.today);
    expect(page.currentUserDisplayName.value).toBe("テスト利用者");
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

  describe("打刻の後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // 出勤ボタンだけがdisabled（打刻後）で、ほかは押せる状態にする。
    const stubDocument = () => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => {
          const action = selector.match(/data-attendance-punch="([^"]+)"/)?.[1];
          return { focus: () => focused.push(action), matches: () => action === "clock-in" };
        },
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("押したボタンが押せなくなったら、画面の並び順で次に押せるボタンへ移す", async () => {
      const page = useAttendancePage();
      await page.initialize();
      mocks.attendanceApi.punch.mockResolvedValue(buildDay(page.today, "WORKING"));
      const focused = stubDocument();

      await page.executePunch("clock-in");

      expect(focused).toEqual(["clock-out"]);
    });

    it("提出の後は、消えた「提出」の代わりに「表示月」へ戻す", async () => {
      const page = useAttendancePage();
      await page.initialize();
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) =>
          selector.includes(ATTENDANCE_CONTROL.submitMonth)
            ? null
            : { focus: () => focused.push(selector), matches: () => false },
      });

      await page.submitMonth();

      expect(focused).toEqual([`[data-attendance-control="${ATTENDANCE_CONTROL.month}"]`]);
    });
  });

  it("修正申請APIの失敗は、開いているDialogの中へ出す", async () => {
    mocks.attendanceApi.getMonth.mockImplementation((yearMonth) =>
      Promise.resolve(buildMonth(yearMonth, "APPROVED"))
    );
    mocks.attendanceApi.createCorrectionRequest.mockRejectedValue(
      new AttendanceApiError(400, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_CORRECTION_PERIOD_INVALID",
            field: "workPeriods",
            message: "勤務区間の時刻を確認してください。",
          },
        ],
      })
    );
    const page = useAttendancePage();
    await page.initialize();
    page.openCorrectionDialog();
    page.correctionForm.value.reason = "打刻漏れ";

    await page.submitCorrectionRequest();

    expect(page.isCorrectionDialogOpen.value).toBe(true);
    expect(page.correctionErrorMessages.value).toEqual(["勤務区間の時刻を確認してください。"]);
    expect(page.errorMessages.value).toEqual([]);
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

  it("DRAFT月を最新versionで提出しBackend確定状態へ同期する", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.submitMonth.mockResolvedValue(
      buildMonth(page.selectedMonth.value, "SUBMITTED", {
        attendanceMonthId: 31,
        submittedAt: "2026-09-06T01:00:00Z",
        version: 1,
      })
    );

    await page.submitMonth();

    expect(mocks.attendanceApi.submitMonth).toHaveBeenCalledWith(
      page.selectedMonth.value,
      0
    );
    expect(page.monthSummary.value.statusCode).toBe("SUBMITTED");
    expect(page.canSubmitMonth.value).toBe(false);
    expect(page.successMessage.value).toBe("月次勤怠を提出しました。");
  });

  it("未終了区間がある月は提出APIを呼ばない", async () => {
    mocks.attendanceApi.getMonth.mockImplementation((yearMonth) =>
      Promise.resolve(
        buildMonth(yearMonth, "DRAFT", { hasIncompletePeriod: true })
      )
    );
    const page = useAttendancePage();
    await page.initialize();

    await page.submitMonth();

    expect(page.canSubmitMonth.value).toBe(false);
    expect(mocks.attendanceApi.submitMonth).not.toHaveBeenCalled();
  });

  it("承認済み月の現在勤怠を初期値にして東京時刻の全置換snapshotを申請する", async () => {
    mocks.attendanceApi.getMonth.mockImplementation((yearMonth) =>
      Promise.resolve(buildMonth(yearMonth, "APPROVED"))
    );
    const page = useAttendancePage();
    await page.initialize();
    page.openCorrectionDialog();
    page.addCorrectionWorkPeriod();
    page.correctionForm.value.reason = "打刻漏れを修正";
    mocks.attendanceApi.createCorrectionRequest.mockResolvedValue({
      attendanceCorrectionRequestId: 41,
      statusCode: "PENDING",
      version: 0,
    });

    await page.submitCorrectionRequest();

    expect(mocks.attendanceApi.createCorrectionRequest).toHaveBeenCalledWith(
      page.today,
      {
        baseDayVersion: null,
        note: null,
        reason: "打刻漏れを修正",
        workPeriods: [
          {
            startedAt: `${page.today}T09:00:00+09:00`,
            endedAt: `${page.today}T18:00:00+09:00`,
            breakPeriods: [],
          },
        ],
      }
    );
    expect(page.isCorrectionDialogOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("勤怠修正を申請しました。");
  });

  it("必須理由がない修正入力はAPIへ送らずPENDING申請は最新versionで取り消す", async () => {
    const pending = {
      attendanceCorrectionRequestId: 41,
      accountId: 1,
      workDate: "2026-09-06",
      reason: "訂正",
      statusCode: "PENDING",
      requestedBy: 1,
      requestedAt: "2026-09-07T00:00:00Z",
      version: 3,
      workPeriods: [],
    };
    mocks.attendanceApi.getMonth.mockImplementation((yearMonth) =>
      Promise.resolve(buildMonth(yearMonth, "APPROVED"))
    );
    mocks.attendanceApi.getOwnCorrectionRequests.mockResolvedValueOnce({
      correctionRequests: [],
    });
    const page = useAttendancePage();
    await page.initialize();
    page.openCorrectionDialog();

    await page.submitCorrectionRequest();

    expect(mocks.attendanceApi.createCorrectionRequest).not.toHaveBeenCalled();
    // Dialogを開いている間は画面上部が隠れるため、理由はDialogの中へ出す。
    expect(page.correctionErrorMessages.value).toEqual(["修正理由を入力してください。"]);
    expect(page.errorMessages.value).toEqual([]);
    mocks.attendanceApi.getOwnCorrectionRequests.mockResolvedValue({
      correctionRequests: [{ ...pending, workDate: page.today }],
    });
    await page.selectWorkDate(page.today);
    mocks.attendanceApi.cancelCorrectionRequest.mockResolvedValue({
      ...pending,
      workDate: page.today,
      statusCode: "CANCELLED",
      version: 4,
    });

    await page.cancelCorrectionRequest({ ...pending, workDate: page.today });

    expect(mocks.attendanceApi.cancelCorrectionRequest).toHaveBeenCalledWith(
      41,
      3
    );
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
    expect(mocks.attendanceApi.getMonth).toHaveBeenCalledTimes(2);
    expect(mocks.attendanceApi.getOwnCorrectionRequests).toHaveBeenCalledTimes(2);
  });

  it("打刻の競合（409）で取り直せたときは、Backendの「読み直してください」の後ろに取り直し済みの案内を添える", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.punch.mockRejectedValue(
      new AttendanceApiError(409, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_PUNCH_CONFLICT",
            field: "punchState",
            message: "勤怠打刻が競合しました。最新状態を読み直してください。",
          },
        ],
      })
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual([
      "勤怠打刻が競合しました。最新状態を読み直してください。",
      DISPLAY_MESSAGES.attendance.conflictReloaded,
    ]);
  });

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.submitMonth.mockRejectedValue(
      new AttendanceApiError(400, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_YEAR_MONTH_REQUIRED",
            field: "yearMonth",
            message: " 対象月を入力してください。 ",
          },
          {
            errorCode: "ATTENDANCE_VERSION_REQUIRED",
            field: "version",
            message: "versionを確認してください。",
          },
        ],
      })
    );

    await page.submitMonth();

    expect(page.errorMessages.value).toEqual([
      "対象月を入力してください。",
      "versionを確認してください。",
    ]);
  });

  it("未知codeのBackend messageを表示せず本人操作のfallbackへ閉じる", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.punch.mockRejectedValue(
      new AttendanceApiError(400, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_ATTENDANCE_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual([
      "打刻を確定できませんでした。",
    ]);
    expect(mocks.attendanceApi.getDays).toHaveBeenCalledOnce();
  });

  it("本文なし403ではSessionを維持して本人勤怠の権限不足を表示する", async () => {
    const page = useAttendancePage();
    await page.initialize();
    mocks.attendanceApi.punch.mockRejectedValue(
      new AttendanceApiError(403, null)
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual([
      "本人勤怠を操作するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("404ではBackend本文に依存せず勤怠対象accountなしを表示する", async () => {
    mocks.attendanceApi.getDays.mockRejectedValue(
      new AttendanceApiError(404, {
        fieldErrors: [
          {
            errorCode: "ATTENDANCE_ACCOUNT_NOT_FOUND",
            field: "accountId",
            message: "localeで変化する対象なし文言",
          },
        ],
      })
    );
    const page = useAttendancePage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual([
      "勤怠対象のアカウントが見つかりません。",
    ]);
  });

  it("409後の再取得で401になった場合は競合案内を残さずSessionを破棄する", async () => {
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
    mocks.attendanceApi.getDays.mockRejectedValueOnce(
      new AttendanceApiError(401, null)
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409後の再取得が通信失敗した場合は最初の競合案内を維持する", async () => {
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
    mocks.attendanceApi.getDays.mockRejectedValueOnce(
      new TypeError("network error")
    );

    await page.executePunch("clock-in");

    expect(page.errorMessages.value).toEqual(["すでに出勤しています。"]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
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

  it.each([
    ["BALANCED", "success"],
    ["OVER_ALLOCATED", "error"],
    ["UNALLOCATED", "warning"],
    ["INCOMPLETE", "warning"],
  ])("照合状態%sをalert種別%sへ対応させる", (allocationStatus, alertType) => {
    const page = useAttendancePage();
    page.selectedDay.value = { ...buildDay("2026-10-01", "WORKING"), allocationStatus };

    expect(page.selectedDayAllocationAlertType.value).toBe(alertType);
  });

  it.each([
    ["DRAFT", "OFF_DUTY", [], "提出前の月は、打刻で直してから提出してください。修正申請は承認・締めの後に使えます。"],
    ["REJECTED", "OFF_DUTY", [], "提出前の月は、打刻で直してから提出してください。修正申請は承認・締めの後に使えます。"],
    ["SUBMITTED", "OFF_DUTY", [], "提出した月は審査中です。修正申請は承認の後に使えます。"],
    ["APPROVED", "OFF_DUTY", ["PENDING"], "この日には審査待ちの修正申請があります。結果が出るまで新しい申請はできません。"],
    ["APPROVED", "WORKING", [], "勤務・休憩が終わっていない日は修正申請できません。"],
    ["APPROVED", "OFF_DUTY", [], ""],
  ])("月次%s・選択日%s・申請%jのとき、修正申請できない理由は「%s」", (monthStatus, punchState, requestStatuses, expected) => {
    const page = useAttendancePage();
    page.monthSummary.value = buildMonth("2026-10", monthStatus);
    page.selectedDay.value =
      punchState === "WORKING"
        ? {
            ...buildDay("2026-10-01", punchState),
            // 退勤していない勤務区間（終了時刻なし）がある日
            workPeriods: [{ startedAt: "2026-10-01T09:00:00+09:00", endedAt: null, breakPeriods: [] }],
          }
        : buildDay("2026-10-01", punchState);
    page.correctionRequests.value = requestStatuses.map((statusCode, index) => ({
      attendanceCorrectionRequestId: index + 1,
      statusCode,
    }));

    expect(page.correctionUnavailableReason.value).toBe(expected);
    // 理由が出るときは申請ボタンを出さず、申請できるときは理由を出さない。
    expect(page.canRequestCorrection.value).toBe(expected === "");
  });

  it.each([
    ["APPROVED", "PENDING", true],
    ["CLOSED", "PENDING", true],
    ["SUBMITTED", "PENDING", false],
    ["APPROVED", "REJECTED", false],
  ])("月次%sで修正申請%sがある場合の審査待ち案内は%s", (monthStatus, requestStatus, expected) => {
    const page = useAttendancePage();
    page.monthSummary.value = buildMonth("2026-10", monthStatus);
    page.correctionRequests.value = [{ attendanceCorrectionRequestId: 1, statusCode: requestStatus }];

    expect(page.hasPendingCorrectionInReviewedMonth.value).toBe(expected);
  });
});
