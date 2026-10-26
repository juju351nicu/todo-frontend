import { vi } from "vitest";
import { computed, ref } from "vue";

import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";

/**
 * WBS画面composableのspecで共有するmockとfixture。
 *
 * `vi.mock`はspecファイルごとにhoistされるため、各specは次のようにこのmoduleを動的importして
 * `vue-router`・user store・ProjectApi・WbsApiのmockへ`mocks`を割り当てる。
 * `resetWbsPageMocks`を`beforeEach`で呼び、spec間・test間で状態を持ち越さない。
 */
export const mocks = {
  permissions: new Set(),
  route: { params: { projectId: "7" }, query: {} },
  router: { push: vi.fn() },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
    hasRole: vi.fn((code) => mocks.roles.has(code)),
    memberId: 2,
  },
  roles: new Set(),
  createObjectUrl: vi.fn(() => "blob:wbs-report"),
  revokeObjectUrl: vi.fn(),
  clickDownloadAnchor: vi.fn(),
  appendDownloadAnchor: vi.fn(),
  removeDownloadAnchor: vi.fn(),
  projectApi: {
    getProject: vi.fn(),
  },
  wbsApi: {
    activateWbsBaseline: vi.fn(),
    createWbsBaseline: vi.fn(),
    createMemberWorkingDay: vi.fn(),
    createProjectWorkingDay: vi.fn(),
    createTaskDependency: vi.fn(),
    createTaskEffortPlan: vi.fn(),
    createTaskWorkLog: vi.fn(),
    deleteTaskDependency: vi.fn(),
    deleteTaskEffortPlan: vi.fn(),
    deleteTaskWorkLog: vi.fn(),
    deleteMemberWorkingDay: vi.fn(),
    deleteProjectWorkingDay: vi.fn(),
    downloadWbsReport: vi.fn(),
    getTaskDependencies: vi.fn(),
    getEarnedValueMetrics: vi.fn(),
    getEstimateAccuracy: vi.fn(),
    getTaskEffortPlans: vi.fn(),
    getTaskWorkLogs: vi.fn(),
    getTaskWorkload: vi.fn(),
    getWorkingCalendar: vi.fn(),
    getWbsBaseline: vi.fn(),
    getWbsBaselines: vi.fn(),
    getWbs: vi.fn(),
    updateTaskEffortPlan: vi.fn(),
    updateTaskWorkLog: vi.fn(),
    updateMemberWorkingDay: vi.fn(),
    updateProjectWorkingDay: vi.fn(),
    updateWbsTask: vi.fn(),
  },
};

/** WBS Task Responseを作る。既定はtaskId 1のSUMMARY（担当者accountId 2、version 4）。 */
export const buildTask = (overrides = {}) => ({
  taskId: 1,
  parentTaskId: null,
  taskType: "SUMMARY",
  wbsCode: "1",
  title: "Phase 1",
  detail: "開発Phase",
  plannedStartDate: "2026-08-22",
  plannedEndDate: "2026-08-24",
  plannedEffortMinutes: 480,
  progressPercent: 25,
  actualStartDate: null,
  actualEndDate: null,
  assigneeAccountId: 2,
  priority: 2,
  taskStatusId: 11,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 4,
  ...overrides,
});

/** Summary 1（taskId 1）の下に通常Task 2とMilestone 3を持つProject 7のWBS。並びは意図的に親子順と異なる。 */
export const wbs = {
  projectId: 7,
  projectName: "開発Project",
  tasks: [
    buildTask({
      taskId: 2,
      parentTaskId: 1,
      taskType: "TASK",
      wbsCode: "1.1",
      title: "実装",
    }),
    buildTask(),
    buildTask({
      taskId: 3,
      parentTaskId: 1,
      taskType: "MILESTONE",
      wbsCode: "1.2",
      title: "完了判定",
      plannedEndDate: "2026-08-22",
      plannedEffortMinutes: 0,
      position: 2000,
    }),
  ],
};

/** Project 7。accountId 1がOWNER、accountId 2（既定のログイン利用者）がMEMBER。 */
export const project = {
  projectId: 7,
  projectKey: "DEVELOPMENT",
  name: "開発Project",
  description: null,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  version: 0,
  members: [
    {
      accountId: 1,
      projectRole: "OWNER",
      joinedAt: "2026-08-01T00:00:00Z",
      assignedBy: 1,
      version: 0,
    },
    {
      accountId: 2,
      projectRole: "MEMBER",
      joinedAt: "2026-08-01T00:00:00Z",
      assignedBy: 1,
      version: 0,
    },
  ],
  taskStatuses: [],
};

/** active baseline（ID 21）。比較詳細では通常Task 2の予定工数を60分少なくしてある。 */
export const baselineSummary = {
  baselineId: 21,
  baselineNumber: 1,
  name: "8月計画",
  description: "顧客合意時点",
  active: true,
  createdBy: 1,
  createdAt: "2026-08-20T01:00:00Z",
  updatedBy: 1,
  updatedAt: "2026-08-20T01:00:00Z",
  version: 0,
};

export const inactiveBaselineSummary = {
  ...baselineSummary,
  baselineId: 20,
  baselineNumber: 0,
  name: "初期計画",
  active: false,
  version: 2,
};

export const baselineList = {
  projectId: 7,
  baselines: [baselineSummary, inactiveBaselineSummary],
};

export const baselineDetail = {
  projectId: 7,
  baseline: baselineSummary,
  tasks: wbs.tasks.map((task) => ({
    sourceTaskId: task.taskId,
    parentSourceTaskId: task.parentTaskId,
    taskType: task.taskType,
    wbsCode: task.wbsCode,
    position: task.position,
    title: task.title,
    detail: task.detail,
    priority: task.priority,
    plannedStartDate: task.plannedStartDate,
    plannedEndDate: task.plannedEndDate,
    plannedEffortMinutes:
      task.taskId === 2 ? task.plannedEffortMinutes - 60 : task.plannedEffortMinutes,
    assigneeAccountId: task.assigneeAccountId,
    sourceTaskVersion: task.version,
  })),
  dependencies: [],
  effortPlans: [],
  plannedEffortMinutes: 900,
  allocatedEffortMinutes: 600,
  unallocatedEffortMinutes: 300,
};

export const baselineCreateResponse = {
  baseline: { ...baselineSummary, baselineId: 22, baselineNumber: 2 },
  taskCount: 3,
  dependencyCount: 1,
  effortPlanCount: 2,
  plannedEffortMinutes: 960,
  allocatedEffortMinutes: 600,
  unallocatedEffortMinutes: 360,
};

/**
 * 見積もり精度のResponse。完了Task 3件のうち予定未入力1件を除外し、Task 2（予定480分・実績540分）と
 * Task 4（予定60分・実績120分）の2件で誤差を計算した状態。2件のため参考値（最低10件）になる。
 */
export const estimateAccuracyResponse = {
  projectId: 7,
  completedTaskCount: 3,
  missingPlanTaskCount: 1,
  missingActualTaskCount: 0,
  sampleCount: 2,
  minimumSampleCount: 10,
  tolerancePercent: 20,
  withinToleranceTaskCount: 1,
  medianAbsoluteErrorMinutes: 60,
  medianSignedVarianceMinutes: 60,
  tasks: [
    {
      taskId: 2,
      wbsCode: "1.1",
      title: "実装",
      plannedEffortMinutes: 480,
      actualEffortMinutes: 540,
      signedVarianceMinutes: 60,
      absoluteErrorMinutes: 60,
      withinTolerance: true,
    },
    {
      taskId: 4,
      wbsCode: null,
      title: "調査",
      plannedEffortMinutes: 60,
      actualEffortMinutes: 120,
      signedVarianceMinutes: 60,
      absoluteErrorMinutes: 60,
      withinTolerance: false,
    },
  ],
};

export const earnedValueResponse = {
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
  tasks: [],
};

export const updatedWbs = {
  ...wbs,
  tasks: wbs.tasks.map((task) =>
    task.taskId === 2
      ? {
          ...task,
          progressPercent: 50,
          actualStartDate: "2026-08-22",
          actualEndDate: "2026-08-24",
          version: 5,
        }
      : task
  ),
};

export const dependencyList = {
  projectId: 7,
  dependencies: [
    {
      dependencyId: 31,
      predecessorTaskId: 1,
      successorTaskId: 2,
      dependencyType: "FINISH_TO_START",
      lagMinutes: 0,
      version: 3,
    },
  ],
};

export const updatedDependencyList = {
  projectId: 7,
  dependencies: [
    ...dependencyList.dependencies,
    {
      dependencyId: 32,
      predecessorTaskId: 2,
      successorTaskId: 3,
      dependencyType: "FINISH_TO_START",
      lagMinutes: 30,
      version: 0,
    },
  ],
};

export const workLogList = {
  projectId: 7,
  taskId: 2,
  totalActualEffortMinutes: 480,
  workLogs: [
    {
      workLogId: 41,
      taskId: 2,
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
      workerDisplayName: "担当者",
      createdBy: 2,
      createdAt: "2026-08-22T01:00:00Z",
      updatedBy: 2,
      updatedAt: "2026-08-22T01:00:00Z",
      version: 3,
    },
  ],
};

export const updatedWorkLogList = {
  ...workLogList,
  totalActualEffortMinutes: 510,
  workLogs: workLogList.workLogs.map((workLog) => ({
    ...workLog,
    actualEffortMinutes: 510,
    version: 4,
  })),
};

export const effortPlanList = {
  projectId: 7,
  taskId: 2,
  taskPlannedEffortMinutes: 480,
  totalDailyPlannedEffortMinutes: 300,
  unallocatedEffortMinutes: 180,
  effortPlans: [
    {
      effortPlanId: 51,
      taskId: 2,
      planDate: "2026-08-22",
      plannedEffortMinutes: 300,
      assigneeAccountId: 2,
      assigneeDisplayName: "担当者",
      createdBy: 2,
      createdAt: "2026-08-22T01:00:00Z",
      updatedBy: 2,
      updatedAt: "2026-08-22T01:00:00Z",
      version: 3,
    },
  ],
};

export const updatedEffortPlanList = {
  ...effortPlanList,
  totalDailyPlannedEffortMinutes: 360,
  unallocatedEffortMinutes: 120,
  effortPlans: effortPlanList.effortPlans.map((effortPlan) => ({
    ...effortPlan,
    plannedEffortMinutes: 360,
    version: 4,
  })),
};

export const workloadResponse = {
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

/** Project共通calendar。8/22はProject例外（ID 11、version 3）、8/23は既定の休日。 */
export const workingCalendarResponse = {
  projectId: 7,
  accountId: null,
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  days: [
    {
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 360,
      source: "PROJECT",
      projectOverride: {
        workingDayId: 11,
        accountId: null,
        workDate: "2026-08-22",
        dayType: "WORKING_DAY",
        availableMinutes: 360,
        createdBy: 1,
        createdAt: "2026-08-20T00:00:00Z",
        updatedBy: 1,
        updatedAt: "2026-08-20T00:00:00Z",
        version: 3,
      },
      memberOverride: null,
    },
    {
      workDate: "2026-08-23",
      dayType: "HOLIDAY",
      availableMinutes: 0,
      source: "DEFAULT",
      projectOverride: null,
      memberOverride: null,
    },
  ],
};

/** accountId 2の個人calendar。8/22に個人例外（ID 21、version 4）の休日を持つ。 */
export const memberWorkingCalendarResponse = {
  ...workingCalendarResponse,
  accountId: 2,
  days: workingCalendarResponse.days.map((day) =>
    day.workDate === "2026-08-22"
      ? {
          ...day,
          dayType: "HOLIDAY",
          availableMinutes: 0,
          source: "MEMBER",
          memberOverride: {
            workingDayId: 21,
            accountId: 2,
            workDate: "2026-08-22",
            dayType: "HOLIDAY",
            availableMinutes: 0,
            createdBy: 2,
            createdAt: "2026-08-21T00:00:00Z",
            updatedBy: 2,
            updatedAt: "2026-08-21T00:00:00Z",
            version: 4,
          },
        }
      : day
  ),
};

/** 通常Task 2を取得時点version 4で更新するWBS Task編集Form。 */
export const buildEditForm = (overrides = {}) => ({
  parentTaskId: 1,
  taskType: "TASK",
  wbsCode: "1.1",
  plannedStartDate: "2026-08-22",
  plannedEndDate: "2026-08-24",
  plannedEffortMinutes: 480,
  progressPercent: 50,
  actualStartDate: "2026-08-22",
  actualEndDate: "2026-08-24",
  version: 4,
  ...overrides,
});

/**
 * 全mockを既定の成功Responseへ戻し、権限をTASK_UPDATEだけを持つ通常member（accountId 2）にする。
 * Excel download用に`URL.createObjectURL`と`document`をstubし、実DOMへ依存させない。
 */
export const resetWbsPageMocks = () => {
  vi.clearAllMocks();
  mocks.permissions.clear();
  mocks.roles.clear();
  mocks.permissions.add("TASK_UPDATE");
  mocks.userStore.memberId = 2;
  mocks.route.params.projectId = "7";
  mocks.route.query = {};
  mocks.router.push.mockResolvedValue(undefined);
  mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
  mocks.wbsApi.activateWbsBaseline.mockResolvedValue(
    structuredClone({ ...inactiveBaselineSummary, active: true, version: 3 })
  );
  mocks.wbsApi.createWbsBaseline.mockResolvedValue(
    structuredClone(baselineCreateResponse)
  );
  mocks.wbsApi.createTaskDependency.mockResolvedValue(
    structuredClone(updatedDependencyList)
  );
  mocks.wbsApi.createTaskEffortPlan.mockResolvedValue(
    structuredClone(effortPlanList)
  );
  mocks.wbsApi.createTaskWorkLog.mockResolvedValue(
    structuredClone(workLogList)
  );
  mocks.wbsApi.createMemberWorkingDay.mockResolvedValue(
    structuredClone(memberWorkingCalendarResponse)
  );
  mocks.wbsApi.createProjectWorkingDay.mockResolvedValue(
    structuredClone(workingCalendarResponse)
  );
  mocks.wbsApi.deleteTaskDependency.mockResolvedValue(undefined);
  mocks.wbsApi.deleteTaskEffortPlan.mockResolvedValue(undefined);
  mocks.wbsApi.deleteTaskWorkLog.mockResolvedValue(undefined);
  mocks.wbsApi.deleteMemberWorkingDay.mockResolvedValue(undefined);
  mocks.wbsApi.deleteProjectWorkingDay.mockResolvedValue(undefined);
  mocks.wbsApi.downloadWbsReport.mockResolvedValue({
    content: new Blob(["xlsx-binary"]),
    fileName: "work-management-wbs-weekly-project-7-2026-09-05.xlsx",
  });
  mocks.wbsApi.getTaskDependencies.mockResolvedValue(
    structuredClone(dependencyList)
  );
  mocks.wbsApi.getEarnedValueMetrics.mockResolvedValue(
    structuredClone(earnedValueResponse)
  );
  mocks.wbsApi.getEstimateAccuracy.mockResolvedValue(
    structuredClone(estimateAccuracyResponse)
  );
  mocks.wbsApi.getTaskEffortPlans.mockResolvedValue(
    structuredClone(effortPlanList)
  );
  mocks.wbsApi.getTaskWorkLogs.mockResolvedValue(
    structuredClone(workLogList)
  );
  mocks.wbsApi.getTaskWorkload.mockResolvedValue(
    structuredClone(workloadResponse)
  );
  mocks.wbsApi.getWorkingCalendar.mockResolvedValue(
    structuredClone(workingCalendarResponse)
  );
  mocks.wbsApi.getWbsBaseline.mockResolvedValue(
    structuredClone(baselineDetail)
  );
  mocks.wbsApi.getWbsBaselines.mockResolvedValue(
    structuredClone(baselineList)
  );
  mocks.wbsApi.getWbs.mockResolvedValue(structuredClone(wbs));
  mocks.wbsApi.updateTaskEffortPlan.mockResolvedValue(
    structuredClone(updatedEffortPlanList)
  );
  mocks.wbsApi.updateWbsTask.mockResolvedValue(structuredClone(updatedWbs));
  mocks.wbsApi.updateTaskWorkLog.mockResolvedValue(
    structuredClone(updatedWorkLogList)
  );
  mocks.wbsApi.updateMemberWorkingDay.mockResolvedValue(
    structuredClone(memberWorkingCalendarResponse)
  );
  mocks.wbsApi.updateProjectWorkingDay.mockResolvedValue(
    structuredClone(workingCalendarResponse)
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mocks.createObjectUrl,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mocks.revokeObjectUrl,
  });
  vi.stubGlobal("document", {
    body: { appendChild: mocks.appendDownloadAnchor },
    createElement: vi.fn(() => ({
      click: mocks.clickDownloadAnchor,
      download: "",
      hidden: false,
      href: "",
      remove: mocks.removeDownloadAnchor,
    })),
  });
};

/**
 * 領域別composableを`useWbsPage`を介さず検証するためのWbsPageContextを作る。
 * 既定はProject 7・通常member（更新可、Project管理不可）で、`handleUnauthorized`はmockとして呼出しだけを記録する。
 *
 * @param {Record<string, unknown>} overrides 差し替えるcontext項目
 */
export const buildWbsPageContext = (overrides = {}) => {
  const wbsRef = ref(structuredClone(wbs));
  return {
    projectId: computed(() => 7),
    project: ref(structuredClone(project)),
    wbs: wbsRef,
    rows: computed(() => buildWbsTreeRows(wbsRef.value?.tasks ?? [])),
    canEditWbs: computed(() => true),
    canManageProject: computed(() => false),
    errorMessages: ref([]),
    successMessage: ref(""),
    handleUnauthorized: vi.fn(async () => {}),
    isSessionInvalidated: vi.fn(() => false),
    ...overrides,
  };
};
