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
  },
  wbsApi: { getWbs: vi.fn(), updateWbsTask: vi.fn() },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
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

const updatedWbs = {
  ...wbs,
  tasks: wbs.tasks.map((task) =>
    task.taskId === 2
      ? { ...task, progressPercent: 50, version: 5 }
      : task
  ),
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
    mocks.permissions.add("TASK_UPDATE");
    mocks.route.params.projectId = "7";
    mocks.router.push.mockResolvedValue(undefined);
    mocks.wbsApi.getWbs.mockResolvedValue(structuredClone(wbs));
    mocks.wbsApi.updateWbsTask.mockResolvedValue(structuredClone(updatedWbs));
  });

  it("初期表示でProject WBSを取得して階層行と種別件数を作る", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledWith(7);
    expect(page.rows.value.map((row) => [row.taskId, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
    ]);
    expect(page.taskCount.value).toBe(1);
    expect(page.summaryCount.value).toBe(1);
    expect(page.milestoneCount.value).toBe(1);
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
});
