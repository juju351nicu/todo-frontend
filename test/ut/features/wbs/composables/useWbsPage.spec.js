import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";

import { mocks, wbs, resetWbsPageMocks } from "./wbsPageTestSupport";

vi.mock("vue-router", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useRoute: () => mocks.route, useRouter: () => mocks.router };
});
vi.mock("@/features/auth/stores/user", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useUserStore: () => mocks.userStore };
});
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.wbsApi };
});

describe("useWbsPage", () => {
  beforeEach(resetWbsPageMocks);

  it("初期表示でProject WBSと依存関係を取得して階層行と種別件数を作る", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWbs).toHaveBeenCalledWith(7);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledWith(7);
    expect(mocks.wbsApi.getWbsBaselines).toHaveBeenCalledWith(7);
    expect(mocks.wbsApi.getWbsBaseline).toHaveBeenCalledWith(7, 21);
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
    expect(page.baselineChangedRows.value).toEqual([
      expect.objectContaining({
        sourceTaskId: 2,
        status: "CHANGED",
        plannedEffortDifferenceMinutes: 60,
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

  it("再読込で取得に失敗した場合は全領域の表示データを破棄する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.loadEarnedValueMetrics("2026-08-30");
    expect(page.earnedValue.value).not.toBeNull();
    mocks.projectApi.getProject.mockRejectedValue(new WbsApiError(500, null));

    await page.initialize();

    expect(page.wbs.value).toBeNull();
    expect(page.rows.value).toEqual([]);
    expect(page.dependencies.value).toEqual([]);
    expect(page.workload.value).toBeNull();
    expect(page.workingCalendar.value).toBeNull();
    expect(page.baselineList.value).toBeNull();
    expect(page.activeBaselineDetail.value).toBeNull();
    expect(page.earnedValue.value).toBeNull();
    expect(page.errorMessages.value).toEqual(["WBSを取得できませんでした。"]);
    expect(page.isLoading.value).toBe(false);
  });

  it("Session失効時は全領域のエラーを消してからLoginへ戻す", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.errorMessages.value = ["古い画面エラー"];
    page.workloadErrorMessages.value = ["古いworkloadエラー"];
    page.workingCalendarErrorMessages.value = ["古いcalendarエラー"];
    page.baselineErrorMessages.value = ["古いbaselineエラー"];
    page.reportExportErrorMessages.value = ["古い帳票エラー"];
    mocks.wbsApi.getEarnedValueMetrics.mockRejectedValue(new WbsApiError(401, null));

    await page.loadEarnedValueMetrics("2026-08-30");

    expect(page.errorMessages.value).toEqual([]);
    expect(page.workloadErrorMessages.value).toEqual([]);
    expect(page.workingCalendarErrorMessages.value).toEqual([]);
    expect(page.baselineErrorMessages.value).toEqual([]);
    expect(page.reportExportErrorMessages.value).toEqual([]);
    expect(page.earnedValueErrorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it.each([
    [{ panel: "work-logs", taskId: "abc" }, false],
    [{ panel: "work-logs", taskId: "0" }, false],
    [{ panel: "effort-plans", taskId: "2" }, false],
    [{ panel: ["work-logs", "x"], taskId: ["2", "3"] }, true],
  ])("Board導線のquery %o では日別実績Dialogを開くか: %s", async (query, expectedOpen) => {
    mocks.route.query = query;
    const page = useWbsPage();

    await page.initialize();

    expect(page.isWorkLogDialogOpen.value).toBe(expectedOpen);
    // 不正なTask IDでDialogを開こうとして「Taskが見つかりません」を表示しないことも確認する。
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.wbsApi.getTaskWorkLogs).toHaveBeenCalledTimes(expectedOpen ? 1 : 0);
  });

  it("Board導線で開いた日別実績Dialogを閉じると、panelとtaskIdだけをURLから外す", async () => {
    mocks.route.query = { panel: "work-logs", taskId: "2", view: "gantt" };
    const page = useWbsPage();
    await page.initialize();

    page.closeWorkLogDialog();

    expect(page.isWorkLogDialogOpen.value).toBe(false);
    // 再読込や戻る操作で閉じたDialogが再び開かないよう、履歴を増やさずqueryを置き換える。
    expect(mocks.router.replace).toHaveBeenCalledWith({ query: { view: "gantt" } });
  });

  it("WBS画面の行から開いた日別実績Dialogを閉じてもURLは変えない", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);

    page.closeWorkLogDialog();

    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("route paramのProject IDが配列の場合は先頭の値を使う", async () => {
    mocks.route.params.projectId = ["7", "8"];
    const page = useWbsPage();

    await page.initialize();

    expect(page.projectId.value).toBe(7);
    expect(mocks.wbsApi.getWbs).toHaveBeenCalledWith(7);
  });

  it("どの領域の401でも、開いている全領域のDialogと削除確認を閉じてからLoginへ戻す", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);
    page.openBaselineCreateDialog();
    page.openWorkingDayEditor("2026-08-22");
    page.requestDependencyDelete(31);
    await page.openEffortPlanDialog(2);
    await page.openWorkLogDialog(2);
    page.requestWorkLogDelete(41);
    mocks.wbsApi.getEarnedValueMetrics.mockRejectedValue(new WbsApiError(401, null));

    // EVMはDialogを持たない領域だが、401では画面全体の古いversionを残さない。
    await page.loadEarnedValueMetrics("2026-08-30");

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.editingTask.value).toBeNull();
    expect(page.isBaselineCreateDialogOpen.value).toBe(false);
    expect(page.isWorkingDayEditorOpen.value).toBe(false);
    expect(page.workingDayEditingDay.value).toBeNull();
    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(page.isEffortPlanDialogOpen.value).toBe(false);
    expect(page.isWorkLogDialogOpen.value).toBe(false);
    expect(page.workLogPendingDelete.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("並列の再取得が両方401でもSession破棄とLogin遷移は1回だけ行う", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();
    page.openWorkingDayEditor("2026-08-22");
    mocks.wbsApi.getWorkingCalendar.mockRejectedValue(new WbsApiError(401, null));
    mocks.wbsApi.getTaskWorkload.mockRejectedValue(new WbsApiError(401, null));

    // 保存成功後にcalendarとworkloadを並列で再取得し、両方が401になる。
    await page.saveWorkingDay({
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
    });

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("現在のProject IDを保持してBoardへ戻る", async () => {
    const page = useWbsPage();

    await page.openBoard();

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 7 },
    });
  });

  it("WBSの表示形式は階層表を既定にする", () => {
    expect(useWbsPage().activeView.value).toBe("table");
  });

  it.each([
    ["handleEffortPlanDeleteDialogVisibility", "effortPlanPendingDelete"],
    ["handleWorkLogDeleteDialogVisibility", "workLogPendingDelete"],
    ["handleWorkingDayDeleteDialogVisibility", "workingDayPendingDelete"],
  ])("%sは削除確認dialogを閉じたときだけ%sを破棄する", (handlerName, pendingName) => {
    const page = useWbsPage();
    page[pendingName].value = { id: 1 };

    page[handlerName](true);
    expect(page[pendingName].value).not.toBeNull();
    page[handlerName](false);
    expect(page[pendingName].value).toBeNull();
  });

  it("分割前と同じ名前の値・関数をすべて返す（WbsPage.vueとの契約）", () => {
    // 領域別composableへ分割する前（2026-10-26時点）のuseWbsPageが返していた全項目。
    const keysBeforeSplit = [
      "activateWbsBaseline", "activatingBaselineId", "activeBaseline",
      "activeBaselineDetail", "activeView", "baselineChangedRows", "baselineComparisonRows",
      "baselineEditorErrorMessages", "baselineErrorMessages", "baselineList",
      "baselineSuccessMessage", "canEditSelectedEffortPlanTask",
      "canEditSelectedWorkLogTask", "canEditSelectedWorkingCalendarTarget", "canEditWbs",
      "canManageAnyEffortPlan", "canManageAnyWorkLog", "canManageBaselines",
      "cancelDependencyDelete", "cancelEffortPlanDelete", "cancelEffortPlanEdit",
      "cancelWorkLogDelete", "cancelWorkLogEdit", "cancelWorkingDayDelete",
      "closeBaselineCreateDialog", "closeDependencyEditor", "closeEffortPlanDialog",
      "closeTaskEditor", "closeWorkLogDialog", "closeWorkingDayEditor",
      "confirmDependencyDelete", "confirmEffortPlanDelete", "confirmWorkLogDelete",
      "confirmWorkingDayDelete", "currentAccountId", "dependencies",
      "dependencyEditorErrorMessages", "dependencyPendingDelete",
      "dependencyPendingDeleteRow", "dependencyRows", "dependencyTaskOptions",
      "downloadWbsReport", "earnedValue", "earnedValueErrorMessages",
      "earnedValueStatusDate", "editEffortPlan", "editWorkLog", "editingEffortPlan",
      "editingTask", "editingWorkLog", "editorErrorMessages", "effortPlanAssigneeOptions",
      "effortPlanEditorErrorMessages", "effortPlanList", "effortPlanPendingDelete",
      "effortPlanSuccessMessage", "effortPlanTask", "errorMessages", "exportingReportType",
      "handleDependencyDeleteDialogVisibility", "handleEffortPlanDeleteDialogVisibility",
      "handleWorkLogDeleteDialogVisibility", "handleWorkingDayDeleteDialogVisibility",
      "initialize", "isBaselineCreateDialogOpen", "isBaselineMutating",
      "isCreatingBaseline", "isDeletingDependency", "isDeletingEffortPlan",
      "isDeletingWorkLog", "isDeletingWorkingDay", "isDependencyEditorOpen",
      "isDependencyMutating", "isEditorOpen", "isEffortPlanDialogOpen",
      "isEffortPlanMutating", "isLoading", "isLoadingEarnedValue", "isLoadingEffortPlans",
      "isLoadingWorkLogs", "isLoadingWorkingCalendar", "isLoadingWorkload", "isSaving",
      "isSavingDependency", "isSavingEffortPlan", "isSavingWorkLog", "isSavingWorkingDay",
      "isWorkLogDialogOpen", "isWorkingCalendarMutating", "isWorkingDayEditorOpen",
      "loadEarnedValueMetrics", "loadTaskWorkload", "loadWorkingCalendar", "milestoneCount",
      "openBaselineCreateDialog", "openBoard", "openDependencyEditor",
      "openEffortPlanDialog", "openTaskEditor", "openWorkLogDialog", "openWorkingDayEditor",
      "parentOptions", "projectId", "reportExportErrorMessages",
      "reportExportSuccessMessage", "requestDependencyDelete", "requestEffortPlanDelete",
      "requestWorkLogDelete", "requestWorkingDayDelete", "rows", "saveDependency",
      "saveEffortPlan", "saveWbsBaseline", "saveWbsTask", "saveWorkLog", "saveWorkingDay",
      "selectedWorkingCalendarTarget", "successMessage", "summaryCount", "taskCount", "wbs",
      "workLogEditorErrorMessages", "workLogList", "workLogPendingDelete",
      "workLogSuccessMessage", "workLogTask", "workLogWorkerOptions", "workingCalendar",
      "workingCalendarDateRange", "workingCalendarEditorErrorMessages",
      "workingCalendarErrorMessages", "workingCalendarSelectedTargetKey",
      "workingCalendarSuccessMessage", "workingCalendarTargetOptions",
      "workingDayEditingDay", "workingDayPendingDelete", "workload", "workloadDateRange",
      "workloadErrorMessages",
    ];

    const page = useWbsPage();

    expect(keysBeforeSplit.filter((key) => !(key in page))).toEqual([]);
  });
});
