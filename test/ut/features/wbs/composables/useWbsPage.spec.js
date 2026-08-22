import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";

const mocks = vi.hoisted(() => ({
  permissions: new Set(),
  route: { params: { projectId: "7" } },
  router: { push: vi.fn() },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn((code) => mocks.permissions.has(code)),
    hasRole: vi.fn((code) => mocks.roles.has(code)),
    memberId: 2,
  },
  roles: new Set(),
  projectApi: {
    getProject: vi.fn(),
  },
  wbsApi: {
    createTaskDependency: vi.fn(),
    createTaskEffortPlan: vi.fn(),
    createTaskWorkLog: vi.fn(),
    deleteTaskDependency: vi.fn(),
    deleteTaskEffortPlan: vi.fn(),
    deleteTaskWorkLog: vi.fn(),
    getTaskDependencies: vi.fn(),
    getTaskEffortPlans: vi.fn(),
    getTaskWorkLogs: vi.fn(),
    getTaskWorkload: vi.fn(),
    getWbs: vi.fn(),
    updateTaskEffortPlan: vi.fn(),
    updateTaskWorkLog: vi.fn(),
    updateWbsTask: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  return { ...actual, default: mocks.wbsApi };
});

const buildTask = (overrides = {}) => ({
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
  assigneeAccountId: 2,
  priority: 2,
  taskStatusId: 11,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 4,
  ...overrides,
});

const wbs = {
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

const project = {
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

const updatedWbs = {
  ...wbs,
  tasks: wbs.tasks.map((task) =>
    task.taskId === 2
      ? { ...task, progressPercent: 50, version: 5 }
      : task
  ),
};

const dependencyList = {
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

const updatedDependencyList = {
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

const workLogList = {
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

const updatedWorkLogList = {
  ...workLogList,
  totalActualEffortMinutes: 510,
  workLogs: workLogList.workLogs.map((workLog) => ({
    ...workLog,
    actualEffortMinutes: 510,
    version: 4,
  })),
};

const effortPlanList = {
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

const updatedEffortPlanList = {
  ...effortPlanList,
  totalDailyPlannedEffortMinutes: 360,
  unallocatedEffortMinutes: 120,
  effortPlans: effortPlanList.effortPlans.map((effortPlan) => ({
    ...effortPlan,
    plannedEffortMinutes: 360,
    version: 4,
  })),
};

const workloadResponse = {
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
    },
  ],
};

const buildEditForm = (overrides = {}) => ({
  parentTaskId: 1,
  taskType: "TASK",
  wbsCode: "1.1",
  plannedStartDate: "2026-08-22",
  plannedEndDate: "2026-08-24",
  plannedEffortMinutes: 480,
  progressPercent: 50,
  version: 4,
  ...overrides,
});

describe("useWbsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.clear();
    mocks.roles.clear();
    mocks.permissions.add("TASK_UPDATE");
    mocks.userStore.memberId = 2;
    mocks.route.params.projectId = "7";
    mocks.router.push.mockResolvedValue(undefined);
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    mocks.wbsApi.createTaskDependency.mockResolvedValue(
      structuredClone(updatedDependencyList)
    );
    mocks.wbsApi.createTaskEffortPlan.mockResolvedValue(
      structuredClone(effortPlanList)
    );
    mocks.wbsApi.createTaskWorkLog.mockResolvedValue(
      structuredClone(workLogList)
    );
    mocks.wbsApi.deleteTaskDependency.mockResolvedValue(undefined);
    mocks.wbsApi.deleteTaskEffortPlan.mockResolvedValue(undefined);
    mocks.wbsApi.deleteTaskWorkLog.mockResolvedValue(undefined);
    mocks.wbsApi.getTaskDependencies.mockResolvedValue(
      structuredClone(dependencyList)
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
    mocks.wbsApi.getWbs.mockResolvedValue(structuredClone(wbs));
    mocks.wbsApi.updateTaskEffortPlan.mockResolvedValue(
      structuredClone(updatedEffortPlanList)
    );
    mocks.wbsApi.updateWbsTask.mockResolvedValue(structuredClone(updatedWbs));
    mocks.wbsApi.updateTaskWorkLog.mockResolvedValue(
      structuredClone(updatedWorkLogList)
    );
  });

  it("初期表示でProject WBSと依存関係を取得して階層行と種別件数を作る", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledWith(7);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledWith(7);
    expect(page.rows.value.map((row) => [row.taskId, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
    ]);
    expect(page.taskCount.value).toBe(1);
    expect(page.summaryCount.value).toBe(1);
    expect(page.milestoneCount.value).toBe(1);
    expect(page.dependencyRows.value).toEqual([
      expect.objectContaining({
        dependencyId: 31,
        predecessorLabel: "1 Phase 1",
        successorLabel: "1.1 実装",
      }),
    ]);
  });

  it("不正なProject IDではAPIを呼ばず画面へ理由を表示する", async () => {
    mocks.route.params.projectId = "invalid";
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["Project IDが不正です。"]);
  });

  it("読込中の再実行ではWBS APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.getWbs.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();

    const firstLoad = page.initialize();
    const secondLoad = page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledOnce();
    resolveRequest(wbs);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("参照APIの401はSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.getWbs.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("参照APIの403と404をpermission不足・未参加Projectとして区別する", async () => {
    mocks.wbsApi.getWbs.mockRejectedValueOnce(new WbsApiError(403, null));
    const forbiddenPage = useWbsPage();
    await forbiddenPage.initialize();

    mocks.wbsApi.getWbs.mockRejectedValueOnce(new WbsApiError(404, null));
    const missingPage = useWbsPage();
    await missingPage.initialize();

    expect(forbiddenPage.errorMessages.value).toEqual([
      "WBSを参照するpermissionがありません。",
    ]);
    expect(missingPage.errorMessages.value).toEqual([
      "Projectが見つからないか、このProjectへ参加していません。",
    ]);
  });

  it("現在のProject IDを保持してBoardへ戻る", async () => {
    const page = useWbsPage();

    await page.openBoard();

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 7 },
    });
  });

  it("取得済みTaskから編集Dialogと循環しない親候補を開く", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.openTaskEditor(2);

    expect(page.isEditorOpen.value).toBe(true);
    expect(page.editingTask.value).toMatchObject({ taskId: 2, version: 4 });
    expect(page.parentOptions.value).toEqual([
      { title: "最上位", value: null },
      { title: "1 Phase 1", value: 1 },
    ]);
  });

  it("TASK_UPDATEがなければ編集Dialogを開かない", async () => {
    mocks.permissions.delete("TASK_UPDATE");
    const page = useWbsPage();
    await page.initialize();

    page.openTaskEditor(2);

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "WBSを更新するpermissionがありません。",
    ]);
  });

  it("取得時点のversion付きRequestを送りResponse全体でWBSを更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(mocks.wbsApi.updateWbsTask).toHaveBeenCalledWith(7, 2, {
      parentTaskId: 1,
      taskType: "TASK",
      wbsCode: "1.1",
      plannedStartDate: "2026-08-22",
      plannedEndDate: "2026-08-24",
      plannedEffortMinutes: 480,
      progressPercent: 50,
      version: 4,
    });
    expect(page.wbs.value).toEqual(updatedWbs);
    expect(page.isEditorOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("WBS Taskを更新しました。");
  });

  it("入力不正では更新APIを呼ばずDialogへ理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(
      buildEditForm({
        plannedStartDate: "2026-08-24",
        plannedEndDate: "2026-08-22",
      })
    );

    expect(mocks.wbsApi.updateWbsTask).not.toHaveBeenCalled();
    expect(page.editorErrorMessages.value).toEqual([
      "予定終了日は予定開始日以降にしてください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("400の項目エラーをDialogへ表示して入力を保持する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          { field: "parentTaskId", message: "親Taskが不正です。" },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual(["親Taskが不正です。"]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("409競合ではDialogを閉じて最新WBSを再取得する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          { field: "version", message: "他の操作で更新されています。" },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockResolvedValueOnce(structuredClone(updatedWbs));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "他の操作で更新されています。",
    ]);
    expect(mocks.wbsApi.getWbs).toHaveBeenCalledTimes(2);
    expect(page.wbs.value).toEqual(updatedWbs);
  });

  it("保存中の再実行では更新APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.updateWbsTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    const firstSave = page.saveWbsTask(buildEditForm());
    const secondSave = page.saveWbsTask(buildEditForm());

    expect(mocks.wbsApi.updateWbsTask).toHaveBeenCalledOnce();
    resolveRequest(updatedWbs);
    await Promise.all([firstSave, secondSave]);
  });

  it("更新APIの401は古いDialogとSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("TASK_UPDATEと2件以上のTaskがあれば依存関係追加Dialogを開く", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.openDependencyEditor();

    expect(page.isDependencyEditorOpen.value).toBe(true);
    expect(page.dependencyTaskOptions.value).toEqual([
      { title: "1 Phase 1", value: 1 },
      { title: "1.1 実装", value: 2 },
      { title: "1.2 完了判定", value: 3 },
    ]);
  });

  it("TASK_UPDATEがなければ依存関係追加Dialogを開かない", async () => {
    mocks.permissions.delete("TASK_UPDATE");
    const page = useWbsPage();
    await page.initialize();

    page.openDependencyEditor();

    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "Task依存関係を更新するpermissionがありません。",
    ]);
  });

  it("Finish-to-Startと待ち時間を送信してBackendの依存関係一覧へ差し替える", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 30,
    });

    expect(mocks.wbsApi.createTaskDependency).toHaveBeenCalledWith(7, {
      predecessorTaskId: 2,
      successorTaskId: 3,
      dependencyType: "FINISH_TO_START",
      lagMinutes: 30,
    });
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("Task依存関係を追加しました。");
  });

  it("同じTask・負の待ち時間・重複方向では作成APIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 1,
      successorTaskId: 1,
      lagMinutes: -1,
    });
    expect(page.dependencyEditorErrorMessages.value).toEqual([
      "先行Taskと後続Taskには別のTaskを選択してください。",
      "待ち時間は0以上の整数で入力してください。",
    ]);

    await page.saveDependency({
      predecessorTaskId: 1,
      successorTaskId: 2,
      lagMinutes: 0,
    });
    expect(page.dependencyEditorErrorMessages.value).toEqual([
      "同じ向きのTask依存関係はすでに登録されています。",
    ]);
    expect(mocks.wbsApi.createTaskDependency).not.toHaveBeenCalled();
  });

  it("作成APIの400項目エラーをDialogへ表示して入力を保持する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          { field: "successorTaskId", message: "循環するため登録できません。" },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(page.dependencyEditorErrorMessages.value).toEqual([
      "循環するため登録できません。",
    ]);
    expect(page.isDependencyEditorOpen.value).toBe(true);
  });

  it("作成APIの403と404をpermission不足・対象なしとして区別する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValueOnce(
      new WbsApiError(403, null)
    );
    const forbiddenPage = useWbsPage();
    await forbiddenPage.initialize();
    forbiddenPage.openDependencyEditor();
    await forbiddenPage.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    mocks.wbsApi.createTaskDependency.mockRejectedValueOnce(
      new WbsApiError(404, null)
    );
    const missingPage = useWbsPage();
    await missingPage.initialize();
    missingPage.openDependencyEditor();
    await missingPage.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(forbiddenPage.dependencyEditorErrorMessages.value).toEqual([
      "Task依存関係を更新するpermissionがありません。",
    ]);
    expect(missingPage.dependencyEditorErrorMessages.value).toEqual([
      "対象のProjectまたはTaskが見つかりません。",
    ]);
    expect(forbiddenPage.isDependencyEditorOpen.value).toBe(true);
    expect(missingPage.isDependencyEditorOpen.value).toBe(true);
  });

  it("作成APIの409ではDialogを閉じてWBSと依存関係を再取得する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [{ field: "taskId", message: "Taskが更新されています。" }],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockResolvedValueOnce(structuredClone(updatedWbs));
    mocks.wbsApi.getTaskDependencies
      .mockResolvedValueOnce(structuredClone(dependencyList))
      .mockResolvedValueOnce(structuredClone(updatedDependencyList));
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual(["Taskが更新されています。"]);
    expect(mocks.wbsApi.getWbs).toHaveBeenCalledTimes(2);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledTimes(2);
    expect(page.wbs.value).toEqual(updatedWbs);
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
  });

  it("依存関係保存中の再実行では作成APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.createTaskDependency.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();
    const form = {
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    };

    const firstSave = page.saveDependency(form);
    const secondSave = page.saveDependency(form);

    expect(mocks.wbsApi.createTaskDependency).toHaveBeenCalledOnce();
    resolveRequest(updatedDependencyList);
    await Promise.all([firstSave, secondSave]);
  });

  it("取得時点versionを確認後に削除し204確定後だけ一覧から除外する", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.requestDependencyDelete(31);
    expect(page.dependencyPendingDelete.value).toMatchObject({
      dependencyId: 31,
      version: 3,
    });
    await page.confirmDependencyDelete();

    expect(mocks.wbsApi.deleteTaskDependency).toHaveBeenCalledWith(7, 31, 3);
    expect(page.dependencies.value).toEqual([]);
    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(page.successMessage.value).toBe("Task依存関係を削除しました。");
  });

  it("削除確認をキャンセルした場合はAPIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.requestDependencyDelete(31);
    page.cancelDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(mocks.wbsApi.deleteTaskDependency).not.toHaveBeenCalled();
  });

  it("削除APIの409では確認対象を破棄して最新一覧を再取得する", async () => {
    mocks.wbsApi.deleteTaskDependency.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [{ field: "version", message: "更新されています。" }],
      })
    );
    mocks.wbsApi.getTaskDependencies
      .mockResolvedValueOnce(structuredClone(dependencyList))
      .mockResolvedValueOnce(structuredClone(updatedDependencyList));
    const page = useWbsPage();
    await page.initialize();
    page.requestDependencyDelete(31);

    await page.confirmDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(page.errorMessages.value).toEqual(["更新されています。"]);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledTimes(2);
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
  });

  it("削除APIの401は確認対象とSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.deleteTaskDependency.mockRejectedValue(
      new WbsApiError(401, null)
    );
    const page = useWbsPage();
    await page.initialize();
    page.requestDependencyDelete(31);

    await page.confirmDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("通常Taskを選ぶと日別実績一覧と現在利用者の作業者候補を取得する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.openWorkLogDialog(2);

    expect(mocks.wbsApi.getTaskWorkLogs).toHaveBeenCalledWith(7, 2);
    expect(page.isWorkLogDialogOpen.value).toBe(true);
    expect(page.workLogTask.value).toMatchObject({ taskId: 2, taskType: "TASK" });
    expect(page.workLogList.value).toEqual(workLogList);
    expect(page.workLogWorkerOptions.value).toEqual([
      { title: "アカウントID: 2（MEMBER）", value: 2 },
    ]);
  });

  it("Summaryでは日別実績APIを呼ばず通常Taskだけが対象だと案内する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.openWorkLogDialog(1);

    expect(mocks.wbsApi.getTaskWorkLogs).not.toHaveBeenCalled();
    expect(page.isWorkLogDialogOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "日別実績工数を登録できるのは通常Taskだけです。",
    ]);
  });

  it("業務日・工数・作業者を送信してBackendの確定一覧へ差し替える", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);
    const form = {
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    };

    await page.saveWorkLog(form);

    expect(mocks.wbsApi.createTaskWorkLog).toHaveBeenCalledWith(7, 2, form);
    expect(page.workLogList.value).toEqual(workLogList);
    expect(page.workLogSuccessMessage.value).toBe(
      "Task日別実績を登録しました。"
    );
  });

  it("取得時点version付きで日別実績を更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);
    page.editWorkLog(41);

    await page.saveWorkLog({
      workDate: "2026-08-22",
      actualEffortMinutes: 510,
      workerAccountId: 2,
    });

    expect(mocks.wbsApi.updateTaskWorkLog).toHaveBeenCalledWith(7, 2, 41, {
      workDate: "2026-08-22",
      actualEffortMinutes: 510,
      workerAccountId: 2,
      version: 3,
    });
    expect(page.workLogList.value).toEqual(updatedWorkLogList);
    expect(page.editingWorkLog.value).toBeNull();
    expect(page.workLogSuccessMessage.value).toBe(
      "Task日別実績を更新しました。"
    );
  });

  it("入力不正では日別実績APIを呼ばずDialogへ全理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);

    await page.saveWorkLog({
      workDate: "2026-02-30",
      actualEffortMinutes: 0,
      workerAccountId: 1,
    });

    expect(mocks.wbsApi.createTaskWorkLog).not.toHaveBeenCalled();
    expect(page.workLogEditorErrorMessages.value).toEqual([
      "業務日を入力してください。",
      "実績工数は1分以上1440分以下の整数で入力してください。",
      "Projectへ参加している作業者を選択してください。",
    ]);
  });

  it("保存中の再実行では日別実績APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.createTaskWorkLog.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);
    const form = {
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    };

    const firstSave = page.saveWorkLog(form);
    const secondSave = page.saveWorkLog(form);

    expect(mocks.wbsApi.createTaskWorkLog).toHaveBeenCalledOnce();
    resolveRequest(workLogList);
    await Promise.all([firstSave, secondSave]);
  });

  it("日別実績の409競合では編集を破棄して最新一覧を再取得する", async () => {
    mocks.wbsApi.updateTaskWorkLog.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [{ field: "version", message: "更新されています。" }],
      })
    );
    mocks.wbsApi.getTaskWorkLogs
      .mockResolvedValueOnce(structuredClone(workLogList))
      .mockResolvedValueOnce(structuredClone(updatedWorkLogList));
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);
    page.editWorkLog(41);

    await page.saveWorkLog({
      workDate: "2026-08-22",
      actualEffortMinutes: 510,
      workerAccountId: 2,
    });

    expect(page.editingWorkLog.value).toBeNull();
    expect(page.workLogEditorErrorMessages.value).toEqual([
      "更新されています。",
    ]);
    expect(mocks.wbsApi.getTaskWorkLogs).toHaveBeenCalledTimes(2);
    expect(page.workLogList.value).toEqual(updatedWorkLogList);
  });

  it("取得時点versionで削除し204確定後だけ一覧と合計を更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);

    page.requestWorkLogDelete(41);
    await page.confirmWorkLogDelete();

    expect(mocks.wbsApi.deleteTaskWorkLog).toHaveBeenCalledWith(7, 2, 41, 3);
    expect(page.workLogList.value).toMatchObject({
      totalActualEffortMinutes: 0,
      workLogs: [],
    });
    expect(page.workLogPendingDelete.value).toBeNull();
    expect(page.workLogSuccessMessage.value).toBe(
      "Task日別実績を削除しました。"
    );
  });

  it("管理者はProject全memberを候補にでき、通常memberは他者実績を変更しない", async () => {
    const ownerProject = structuredClone(project);
    ownerProject.members[1].projectRole = "OWNER";
    mocks.projectApi.getProject.mockResolvedValue(ownerProject);
    const ownerPage = useWbsPage();
    await ownerPage.initialize();
    await ownerPage.openWorkLogDialog(2);

    expect(ownerPage.canManageAnyWorkLog.value).toBe(true);
    expect(ownerPage.workLogWorkerOptions.value.map((option) => option.value)).toEqual([
      1,
      2,
    ]);

    const otherWorkLogList = structuredClone(workLogList);
    otherWorkLogList.workLogs[0].workerAccountId = 1;
    mocks.wbsApi.getTaskWorkLogs.mockResolvedValue(otherWorkLogList);
    const memberPage = useWbsPage();
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    await memberPage.initialize();
    await memberPage.openWorkLogDialog(2);
    memberPage.editWorkLog(41);

    expect(memberPage.editingWorkLog.value).toBeNull();
    expect(memberPage.workLogEditorErrorMessages.value).toEqual([
      "この日別実績工数を更新する権限がありません。",
    ]);
  });

  it("通常memberは他者担当Taskを参照できても日別実績を登録しない", async () => {
    const otherAssigneeWbs = structuredClone(wbs);
    otherAssigneeWbs.tasks.find((task) => task.taskId === 2).assigneeAccountId = 1;
    mocks.wbsApi.getWbs.mockResolvedValue(otherAssigneeWbs);
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);

    await page.saveWorkLog({
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    });

    expect(page.canEditSelectedWorkLogTask.value).toBe(false);
    expect(mocks.wbsApi.createTaskWorkLog).not.toHaveBeenCalled();
    expect(page.workLogEditorErrorMessages.value).toEqual([
      "このTaskの日別実績を更新する権限がありません。",
    ]);
  });

  it("日別実績参照APIの401はDialogとSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.getTaskWorkLogs.mockRejectedValue(
      new WbsApiError(401, null)
    );
    const page = useWbsPage();
    await page.initialize();

    await page.openWorkLogDialog(2);

    expect(page.isWorkLogDialogOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("初期表示で当月workloadを取得して予定・実績・差分を保持する", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledWith(
      7,
      page.workloadDateRange.value.dateFrom,
      page.workloadDateRange.value.dateTo
    );
    expect(page.workload.value).toEqual(workloadResponse);
    expect(page.workloadErrorMessages.value).toEqual([]);
  });

  it("不正なworkload期間では再取得せず全検証理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    mocks.wbsApi.getTaskWorkload.mockClear();

    await page.loadTaskWorkload({
      dateFrom: "2026-08-31",
      dateTo: "2026-08-01",
    });

    expect(mocks.wbsApi.getTaskWorkload).not.toHaveBeenCalled();
    expect(page.workloadErrorMessages.value).toEqual([
      "集計終了日は集計開始日以降にしてください。",
    ]);
    expect(page.workload.value).toEqual(workloadResponse);
  });

  it("通常Taskを選ぶと日別予定一覧と現在利用者の予定担当者候補を取得する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.openEffortPlanDialog(2);

    expect(mocks.wbsApi.getTaskEffortPlans).toHaveBeenCalledWith(7, 2);
    expect(page.isEffortPlanDialogOpen.value).toBe(true);
    expect(page.effortPlanTask.value).toMatchObject({
      taskId: 2,
      taskType: "TASK",
    });
    expect(page.effortPlanList.value).toEqual(effortPlanList);
    expect(page.effortPlanAssigneeOptions.value).toEqual([
      { title: "アカウントID: 2（MEMBER）", value: 2 },
    ]);
  });

  it("Summaryでは日別予定APIを呼ばず通常Taskだけが対象だと案内する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.openEffortPlanDialog(1);

    expect(mocks.wbsApi.getTaskEffortPlans).not.toHaveBeenCalled();
    expect(page.isEffortPlanDialogOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "日別予定工数を登録できるのは通常Taskだけです。",
    ]);
  });

  it("予定日・予定工数・予定担当者を送信しworkloadも再取得する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openEffortPlanDialog(2);
    mocks.wbsApi.getTaskWorkload.mockClear();
    const form = {
      planDate: "2026-08-23",
      plannedEffortMinutes: 180,
      assigneeAccountId: 2,
    };

    await page.saveEffortPlan(form);

    expect(mocks.wbsApi.createTaskEffortPlan).toHaveBeenCalledWith(7, 2, form);
    expect(page.effortPlanList.value).toEqual(effortPlanList);
    expect(page.effortPlanSuccessMessage.value).toBe(
      "Task日別予定を登録しました。"
    );
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledWith(
      7,
      page.workloadDateRange.value.dateFrom,
      page.workloadDateRange.value.dateTo
    );
  });

  it("取得時点version付きでTask日別予定を更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openEffortPlanDialog(2);
    page.editEffortPlan(51);

    await page.saveEffortPlan({
      planDate: "2026-08-22",
      plannedEffortMinutes: 360,
      assigneeAccountId: 2,
    });

    expect(mocks.wbsApi.updateTaskEffortPlan).toHaveBeenCalledWith(7, 2, 51, {
      planDate: "2026-08-22",
      plannedEffortMinutes: 360,
      assigneeAccountId: 2,
      version: 3,
    });
    expect(page.effortPlanList.value).toEqual(updatedEffortPlanList);
    expect(page.editingEffortPlan.value).toBeNull();
    expect(page.effortPlanSuccessMessage.value).toBe(
      "Task日別予定を更新しました。"
    );
  });

  it("入力不正ではTask日別予定APIを呼ばずDialogへ全理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openEffortPlanDialog(2);

    await page.saveEffortPlan({
      planDate: "2026-02-30",
      plannedEffortMinutes: 0,
      assigneeAccountId: 1,
    });

    expect(mocks.wbsApi.createTaskEffortPlan).not.toHaveBeenCalled();
    expect(page.effortPlanEditorErrorMessages.value).toEqual([
      "予定日を入力してください。",
      "予定工数は1分以上1440分以下の整数で入力してください。",
      "Projectへ参加している予定担当者を選択してください。",
    ]);
  });

  it("Task日別予定の409競合では編集を破棄して最新一覧とworkloadを再取得する", async () => {
    mocks.wbsApi.updateTaskEffortPlan.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [{ field: "version", message: "更新されています。" }],
      })
    );
    mocks.wbsApi.getTaskEffortPlans
      .mockResolvedValueOnce(structuredClone(effortPlanList))
      .mockResolvedValueOnce(structuredClone(updatedEffortPlanList));
    const page = useWbsPage();
    await page.initialize();
    await page.openEffortPlanDialog(2);
    page.editEffortPlan(51);

    await page.saveEffortPlan({
      planDate: "2026-08-22",
      plannedEffortMinutes: 360,
      assigneeAccountId: 2,
    });

    expect(page.editingEffortPlan.value).toBeNull();
    expect(page.effortPlanEditorErrorMessages.value).toEqual([
      "更新されています。",
    ]);
    expect(mocks.wbsApi.getTaskEffortPlans).toHaveBeenCalledTimes(2);
    expect(page.effortPlanList.value).toEqual(updatedEffortPlanList);
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledTimes(2);
  });

  it("取得時点versionで日別予定を削除し確定後だけ配賦集計を更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openEffortPlanDialog(2);

    page.requestEffortPlanDelete(51);
    await page.confirmEffortPlanDelete();

    expect(mocks.wbsApi.deleteTaskEffortPlan).toHaveBeenCalledWith(7, 2, 51, 3);
    expect(page.effortPlanList.value).toMatchObject({
      taskPlannedEffortMinutes: 480,
      totalDailyPlannedEffortMinutes: 0,
      unallocatedEffortMinutes: 480,
      effortPlans: [],
    });
    expect(page.effortPlanPendingDelete.value).toBeNull();
    expect(page.effortPlanSuccessMessage.value).toBe(
      "Task日別予定を削除しました。"
    );
  });

  it("管理者は全Project memberを予定担当者にでき通常memberは他者予定を変更しない", async () => {
    const ownerProject = structuredClone(project);
    ownerProject.members[1].projectRole = "OWNER";
    mocks.projectApi.getProject.mockResolvedValue(ownerProject);
    const ownerPage = useWbsPage();
    await ownerPage.initialize();
    await ownerPage.openEffortPlanDialog(2);

    expect(ownerPage.canManageAnyEffortPlan.value).toBe(true);
    expect(
      ownerPage.effortPlanAssigneeOptions.value.map((option) => option.value)
    ).toEqual([1, 2]);

    const otherEffortPlanList = structuredClone(effortPlanList);
    otherEffortPlanList.effortPlans[0].assigneeAccountId = 1;
    mocks.wbsApi.getTaskEffortPlans.mockResolvedValue(otherEffortPlanList);
    mocks.projectApi.getProject.mockResolvedValue(structuredClone(project));
    const memberPage = useWbsPage();
    await memberPage.initialize();
    await memberPage.openEffortPlanDialog(2);
    memberPage.editEffortPlan(51);

    expect(memberPage.editingEffortPlan.value).toBeNull();
    expect(memberPage.effortPlanEditorErrorMessages.value).toEqual([
      "この日別予定工数を更新する権限がありません。",
    ]);
  });

  it("日別予定参照APIの401はDialogとSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.getTaskEffortPlans.mockRejectedValue(
      new WbsApiError(401, null)
    );
    const page = useWbsPage();
    await page.initialize();

    await page.openEffortPlanDialog(2);

    expect(page.isEffortPlanDialogOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
