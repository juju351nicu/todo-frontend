import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";

import {
  mocks,
  wbs,
  project,
  inactiveBaselineSummary,
  baselineList,
  earnedValueResponse,
  updatedWbs,
  dependencyList,
  updatedDependencyList,
  workLogList,
  updatedWorkLogList,
  effortPlanList,
  updatedEffortPlanList,
  workloadResponse,
  workingCalendarResponse,
  memberWorkingCalendarResponse,
  buildEditForm,
  resetWbsPageMocks,
} from "./wbsPageTestSupport";

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
      actualStartDate: "2026-08-22",
      actualEndDate: "2026-08-24",
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

  it("実績終了日だけの入力では更新APIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(
      buildEditForm({ actualStartDate: "", actualEndDate: "2026-08-24" })
    );

    expect(mocks.wbsApi.updateWbsTask).not.toHaveBeenCalled();
    expect(page.editorErrorMessages.value).toEqual([
      "実績終了日を入力する場合は実績開始日も入力してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("400の項目エラーをDialogへ表示して入力を保持する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_WBS_HIERARCHY",
            field: "parentTaskId",
            message: "親Taskが不正です。",
          },
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

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "plannedEndDate",
            message: " 予定終了日を確認してください。 ",
          },
          {
            errorCode: "INVALID_WBS_ACTUAL_PERIOD",
            field: "actualEndDate",
            message: "実績期間を確認してください。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual([
      "予定終了日を確認してください。",
      "実績期間を確認してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("未知codeのBackend messageを表示せずWBS更新fallbackへ閉じる", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_WBS_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual([
      "WBS Taskを更新できませんでした。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("409競合ではDialogを閉じて最新WBSを再取得する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。",
          },
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

  it("WBS更新409後の再取得で401になった場合は競合案内を残さない", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.errorMessages.value).toEqual([]);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
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
});
