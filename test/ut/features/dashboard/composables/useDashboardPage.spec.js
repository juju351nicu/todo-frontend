import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardApiError } from "@/features/dashboard/api/dashboardApi";
import { useDashboardPage } from "@/features/dashboard/composables/useDashboardPage";

const mocks = vi.hoisted(() => ({
  dashboardApi: {
    getAdvancedDashboard: vi.fn(),
    getBasicDashboard: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: {
    clearSession: vi.fn(),
    displayName: "新谷 健",
    username: "ken",
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/dashboard/api/dashboardApi", async () => {
  const actual = await vi.importActual("@/features/dashboard/api/dashboardApi");
  return { ...actual, default: mocks.dashboardApi };
});

const task = {
  taskId: 15,
  projectId: 7,
  projectKey: "WM",
  projectName: "Work Management",
  taskStatusId: 2,
  statusName: "進行中",
  title: "Dashboardを作る",
  dueDate: "2026-09-21",
  dueGroup: "TODAY",
  remainingDays: 0,
  priority: 3,
  progressPercent: 50,
};

const event = {
  notificationEventId: 9,
  eventType: "TASK_ASSIGNED",
  title: "Taskが割り当てられました",
  message: "Dashboardを作る",
  navigationPath: "/projects/7/board?taskId=15",
  occurredAt: "2026-09-21T00:00:00Z",
  publisherDisplayName: "管理者",
  read: false,
};

const project = {
  projectId: 7,
  projectKey: "WM",
  projectName: "Work Management",
  projectRole: "OWNER",
  totalTaskCount: 8,
  completedTaskCount: 3,
  overdueTaskCount: 1,
  averageProgressPercent: 48.5,
};

const dashboard = {
  generatedAt: "2026-09-21T00:00:00Z",
  businessDate: "2026-09-21",
  businessZoneId: "Asia/Tokyo",
  myTasks: {
    available: true,
    totalCount: 1,
    overdueCount: 0,
    dueTodayCount: 1,
    dueThisWeekCount: 1,
    upcomingCount: 0,
    items: [task],
  },
  notifications: {
    available: true,
    unreadEventCount: 1,
    unresolvedAlertCount: 0,
    badgeCount: 1,
    recentEvents: [event],
  },
  projects: {
    available: true,
    activeProjectCount: 1,
    cards: [project],
  },
  attendance: {
    available: true,
    yearMonth: "2026-09",
    status: "DRAFT",
    grossWorkMinutes: 480,
    breakMinutes: 60,
    netWorkMinutes: 420,
    hasIncompletePeriod: false,
  },
};

const advancedDashboard = {
  statusDate: "2026-09-21",
  businessZoneId: "Asia/Tokyo",
  projectsWithoutActiveBaselineCount: 1,
  projects: [
    {
      projectId: 7,
      projectKey: "WM",
      projectName: "Work Management",
      baselineId: 3,
      baselineNumber: 1,
      baselineName: "初期計画",
      baselineDate: "2026-09-01",
      statusDate: "2026-09-21",
      valueUnit: "MINUTES",
      bac: 2400,
      pv: 1200,
      ev: 1000,
      ac: 1100,
      sv: -200,
      cv: -100,
      spi: 0.8333,
      cpi: 0.9091,
      plannedProgressPercent: 50,
      earnedProgressPercent: 41.67,
      baselineAllocationVarianceMinutes: 0,
      excludedActualEffortMinutes: 0,
      warningCodes: [],
      workloadWeekStartDate: "2026-09-21",
      workloadWeekEndDate: "2026-09-27",
      ownPlannedWorkloadMinutes: 600,
      ownOverEightHourDayCount: 0,
    },
  ],
};

describe("useDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.dashboardApi.getBasicDashboard.mockResolvedValue(dashboard);
    mocks.dashboardApi.getAdvancedDashboard.mockResolvedValue(
      advancedDashboard
    );
    mocks.userStore.displayName = "新谷 健";
    mocks.userStore.username = "ken";
  });

  it("初期表示でBasic業務日を基準に高度Dashboardも取得する", async () => {
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(mocks.dashboardApi.getBasicDashboard).toHaveBeenCalledOnce();
    expect(mocks.dashboardApi.getAdvancedDashboard).toHaveBeenCalledWith(
      "2026-09-21"
    );
    expect(page.dashboard.value).toEqual(dashboard);
    expect(page.advancedDashboard.value).toEqual(advancedDashboard);
    expect(page.advancedStatusDate.value).toBe("2026-09-21");
    expect(page.displayName.value).toBe("新谷 健");
  });

  it("TASK_READがない場合は高度Dashboard APIを呼ばず情報を保持しない", async () => {
    mocks.dashboardApi.getBasicDashboard.mockResolvedValue({
      ...dashboard,
      myTasks: { ...dashboard.myTasks, available: false, items: [] },
    });
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(mocks.dashboardApi.getAdvancedDashboard).not.toHaveBeenCalled();
    expect(page.advancedDashboard.value).toBeNull();
    expect(page.isAdvancedNotEntitled.value).toBe(false);
  });

  it("読込中の明示更新ではDashboard APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.dashboardApi.getBasicDashboard.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useDashboardPage();

    const firstLoad = page.loadDashboard();
    const secondLoad = page.loadDashboard();

    expect(mocks.dashboardApi.getBasicDashboard).toHaveBeenCalledOnce();
    resolveRequest(dashboard);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("再読込失敗時は直前のDashboardを維持して接続エラーを表示する", async () => {
    const page = useDashboardPage();
    await page.loadDashboard();
    mocks.dashboardApi.getBasicDashboard.mockRejectedValue(new Error("offline"));

    await page.loadDashboard();

    expect(page.dashboard.value).toEqual(dashboard);
    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
  });

  it("Backendの項目エラーを表示して403ではSessionを破棄しない", async () => {
    mocks.dashboardApi.getBasicDashboard.mockRejectedValue(
      new DashboardApiError(403, {
        fieldErrors: [
          {
            errorCode: "FEATURE_NOT_ENTITLED",
            field: "featureCode",
            message: "この機能は現在の契約では利用できません。",
          },
        ],
      })
    );
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(page.errorMessages.value).toEqual([
      "この機能は現在の契約では利用できません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("高度機能資格403だけをupgrade案内へ変換してSessionを維持する", async () => {
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new DashboardApiError(403, {
        fieldErrors: [
          {
            errorCode: "FEATURE_NOT_ENTITLED",
            field: "featureCode",
            message: "この機能は現在の契約では利用できません。",
          },
        ],
      })
    );
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(page.dashboard.value).toEqual(dashboard);
    expect(page.advancedDashboard.value).toBeNull();
    expect(page.isAdvancedNotEntitled.value).toBe(true);
    expect(page.advancedErrorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("高度Dashboardの一般403はupgradeへ誤変換せずBackend案内を表示する", async () => {
    const page = useDashboardPage();
    await page.loadDashboard();
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new DashboardApiError(403, {
        fieldErrors: [
          {
            errorCode: "ACCESS_DENIED",
            field: "authorization",
            message: "高度Dashboardを参照する権限がありません。",
          },
        ],
      })
    );

    await page.loadAdvancedDashboard("2026-09-22");

    expect(page.isAdvancedNotEntitled.value).toBe(false);
    expect(page.advancedDashboard.value).toBeNull();
    expect(page.advancedErrorMessages.value).toEqual([
      "高度Dashboardを参照する権限がありません。",
    ]);
  });

  it("高度Dashboardの入力不正と処理中再操作ではAPIを送信しない", async () => {
    const page = useDashboardPage();

    await page.loadAdvancedDashboard("2026-02-30");

    expect(mocks.dashboardApi.getAdvancedDashboard).not.toHaveBeenCalled();
    expect(page.advancedErrorMessages.value).toEqual([
      "EVM基準日を入力してください。",
    ]);

    let resolveRequest;
    mocks.dashboardApi.getAdvancedDashboard.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const firstLoad = page.loadAdvancedDashboard("2026-09-22");
    const secondLoad = page.loadAdvancedDashboard("2026-09-23");

    expect(mocks.dashboardApi.getAdvancedDashboard).toHaveBeenCalledOnce();
    expect(mocks.dashboardApi.getAdvancedDashboard).toHaveBeenCalledWith(
      "2026-09-22"
    );
    resolveRequest(advancedDashboard);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("高度Dashboard再集計の通信失敗では直前snapshotを維持する", async () => {
    const page = useDashboardPage();
    await page.loadDashboard();
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new Error("offline")
    );

    await page.loadAdvancedDashboard("2026-09-22");

    expect(page.advancedDashboard.value).toEqual(advancedDashboard);
    expect(page.advancedErrorMessages.value).toEqual([
      "高度Dashboardへ接続できませんでした。",
    ]);
  });

  it("高度Dashboardの404では参照不能になった以前のsnapshotを破棄する", async () => {
    const page = useDashboardPage();
    await page.loadDashboard();
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new DashboardApiError(404, {
        fieldErrors: [
          {
            errorCode: "PROJECT_NOT_FOUND",
            field: "projectId",
            message: "Projectを参照できません。",
          },
        ],
      })
    );

    await page.loadAdvancedDashboard("2026-09-22");

    expect(page.advancedDashboard.value).toBeNull();
    expect(page.advancedErrorMessages.value).toEqual([
      "Projectを参照できません。",
    ]);
  });

  it("高度Dashboardの409では直前snapshotを維持して再集計を案内する", async () => {
    const page = useDashboardPage();
    await page.loadDashboard();
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new DashboardApiError(409, {
        fieldErrors: [
          {
            errorCode: "WBS_EVM_ACTIVE_BASELINE_REQUIRED",
            field: "projectId",
            message: "active baselineが変更されました。再集計してください。",
          },
        ],
      })
    );

    await page.loadAdvancedDashboard("2026-09-22");

    expect(page.advancedDashboard.value).toEqual(advancedDashboard);
    expect(page.advancedErrorMessages.value).toEqual([
      "active baselineが変更されました。再集計してください。",
    ]);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.dashboardApi.getBasicDashboard.mockRejectedValue(
      new DashboardApiError(401, null)
    );
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("高度Dashboardの401でもSession表示を破棄してLoginへ戻す", async () => {
    mocks.dashboardApi.getAdvancedDashboard.mockRejectedValue(
      new DashboardApiError(401, null)
    );
    const page = useDashboardPage();

    await page.loadDashboard();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("表示名がない場合はlogin ID、両方ない場合は固定名へ補完する", () => {
    mocks.userStore.displayName = null;
    const usernamePage = useDashboardPage();
    expect(usernamePage.displayName.value).toBe("ken");

    mocks.userStore.username = null;
    const fallbackPage = useDashboardPage();
    expect(fallbackPage.displayName.value).toBe("利用者");
  });

  it("TaskとProjectを既存Boardへ遷移させる", async () => {
    const page = useDashboardPage();

    await page.openTask(task);
    await page.openProject(project);

    expect(mocks.router.push).toHaveBeenNthCalledWith(1, {
      name: "TaskBoard",
      params: { projectId: 7 },
      query: { taskId: "15" },
    });
    expect(mocks.router.push).toHaveBeenNthCalledWith(2, {
      name: "TaskBoard",
      params: { projectId: 7 },
    });
  });

  it("高度ProjectをWBSへ、upgrade相談を問い合わせへ遷移させる", async () => {
    const page = useDashboardPage();

    await page.openAdvancedProject(advancedDashboard.projects[0]);
    await page.openAdvancedAccessInquiry();

    expect(mocks.router.push).toHaveBeenNthCalledWith(1, {
      name: "Wbs",
      params: { projectId: 7 },
    });
    expect(mocks.router.push).toHaveBeenNthCalledWith(2, {
      name: "InquiryForm",
    });
  });

  it("通知はFrontend内の安全な絶対pathだけへ遷移する", async () => {
    const page = useDashboardPage();

    await page.openNotificationEvent(event);
    await page.openNotificationEvent({
      ...event,
      notificationEventId: 10,
      navigationPath: "https://example.com",
    });

    expect(mocks.router.push).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith(
      "/projects/7/board?taskId=15"
    );
  });

  it("各summaryから既存の一覧画面へ遷移する", async () => {
    const page = useDashboardPage();

    await page.openMyTasks();
    await page.openProjects();
    await page.openAttendance();

    expect(mocks.router.push).toHaveBeenNthCalledWith(1, { name: "MyTasks" });
    expect(mocks.router.push).toHaveBeenNthCalledWith(2, {
      name: "ProjectList",
    });
    expect(mocks.router.push).toHaveBeenNthCalledWith(3, {
      name: "Attendance",
    });
  });
});
