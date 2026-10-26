import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useTaskWorkLogs } from "@/features/wbs/composables/useTaskWorkLogs";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  wbs,
  project,
  workLogList,
  updatedWorkLogList,
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

describe("useTaskWorkLogs", () => {
  beforeEach(resetWbsPageMocks);

  it("BoardのTask詳細導線では対象Taskの日別実績Dialogを初期表示する", async () => {
    mocks.route.query = { taskId: "2", panel: "work-logs" };
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getTaskWorkLogs).toHaveBeenCalledWith(7, 2);
    expect(page.workLogTask.value?.taskId).toBe(2);
    expect(page.isWorkLogDialogOpen.value).toBe(true);
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
        fieldErrors: [
          {
            errorCode: "TASK_WORK_LOG_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
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

  describe("contextを直接渡した場合", () => {
    /** 通常Task 2の日別実績Dialogを開いた通常member（accountId 2）の状態を作る。workload再取得はmockにする。 */
    const openWorkLogs = async (contextOverrides = {}) => {
      const context = buildWbsPageContext(contextOverrides);
      const options = { reloadWorkload: vi.fn(async () => {}) };
      const state = useTaskWorkLogs(context, options);
      await state.openWorkLogDialog(2);
      return { context, options, state };
    };

    it("存在しないTaskでは日別実績APIを呼ばず画面上部へ理由を表示する", async () => {
      const context = buildWbsPageContext();
      const state = useTaskWorkLogs(context, { reloadWorkload: vi.fn() });

      await state.openWorkLogDialog(99);

      expect(mocks.wbsApi.getTaskWorkLogs).not.toHaveBeenCalled();
      expect(state.isWorkLogDialogOpen.value).toBe(false);
      expect(context.errorMessages.value).toEqual(["実績工数を参照するTaskが見つかりません。"]);
    });

    it("複数の日別実績から1件削除すると残りの合計を表示し、別実績の編集は残す", async () => {
      mocks.wbsApi.getTaskWorkLogs.mockResolvedValue({
        ...structuredClone(workLogList),
        totalActualEffortMinutes: 600,
        workLogs: [
          ...structuredClone(workLogList.workLogs),
          {
            ...structuredClone(workLogList.workLogs[0]),
            workLogId: 42,
            workDate: "2026-08-23",
            actualEffortMinutes: 120,
          },
        ],
      });
      const { options, state } = await openWorkLogs();
      state.editWorkLog(42);
      state.requestWorkLogDelete(41);

      await state.confirmWorkLogDelete();

      expect(state.workLogList.value?.totalActualEffortMinutes).toBe(120);
      expect(state.workLogList.value?.workLogs.map((workLog) => workLog.workLogId)).toEqual([42]);
      expect(state.editingWorkLog.value?.workLogId).toBe(42);
      expect(options.reloadWorkload).toHaveBeenCalledOnce();
    });

    it("削除APIの403では確認対象を残し権限不足を表示する", async () => {
      mocks.wbsApi.deleteTaskWorkLog.mockRejectedValue(new WbsApiError(403, null));
      const { options, state } = await openWorkLogs();
      state.requestWorkLogDelete(41);

      await state.confirmWorkLogDelete();

      expect(state.workLogPendingDelete.value?.workLogId).toBe(41);
      expect(state.workLogEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.workLog.deleteForbidden,
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("競合後の一覧再取得が500なら競合理由に再読込案内を追加する", async () => {
      mocks.wbsApi.updateTaskWorkLog.mockRejectedValue(new WbsApiError(409, null));
      const { options, state } = await openWorkLogs();
      state.editWorkLog(41);
      mocks.wbsApi.getTaskWorkLogs.mockRejectedValue(new WbsApiError(500, null));

      await state.saveWorkLog({ workDate: "2026-08-22", actualEffortMinutes: 510, workerAccountId: 2 });

      expect(state.editingWorkLog.value).toBeNull();
      expect(state.workLogEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.workLog.conflict,
        DISPLAY_MESSAGES.wbs.workLog.reloadFailed,
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("競合後の一覧再取得が401ならDialogを閉じてSession失効処理を呼ぶ", async () => {
      mocks.wbsApi.deleteTaskWorkLog.mockRejectedValue(new WbsApiError(404, null));
      const { context, state } = await openWorkLogs({ canManageProject: computed(() => true) });
      state.requestWorkLogDelete(41);
      mocks.wbsApi.getTaskWorkLogs.mockRejectedValue(new WbsApiError(401, null));

      await state.confirmWorkLogDelete();

      expect(state.isWorkLogDialogOpen.value).toBe(false);
      expect(state.workLogEditorErrorMessages.value).toEqual([]);
      expect(context.handleUnauthorized).toHaveBeenCalledOnce();
    });

    it("読込中はDialogを閉じず、保存中は編集の取消を受け付けない", async () => {
      let resolveWorkLogs;
      mocks.wbsApi.getTaskWorkLogs.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveWorkLogs = resolve;
        })
      );
      const state = useTaskWorkLogs(buildWbsPageContext(), { reloadWorkload: vi.fn() });
      const opening = state.openWorkLogDialog(2);
      state.closeWorkLogDialog();
      expect(state.isWorkLogDialogOpen.value).toBe(true);
      resolveWorkLogs(structuredClone(workLogList));
      await opening;

      let resolveUpdate;
      mocks.wbsApi.updateTaskWorkLog.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );
      state.editWorkLog(41);
      const saving = state.saveWorkLog({ workDate: "2026-08-22", actualEffortMinutes: 510, workerAccountId: 2 });
      state.cancelWorkLogEdit();
      expect(state.editingWorkLog.value?.workLogId).toBe(41);
      resolveUpdate(structuredClone(updatedWorkLogList));
      await saving;

      expect(state.editingWorkLog.value).toBeNull();
    });

    it("削除確認dialogを閉じたときだけ確認対象を破棄する", async () => {
      const { state } = await openWorkLogs();
      state.requestWorkLogDelete(41);

      state.handleWorkLogDeleteDialogVisibility(true);
      expect(state.workLogPendingDelete.value).not.toBeNull();
      state.handleWorkLogDeleteDialogVisibility(false);
      expect(state.workLogPendingDelete.value).toBeNull();
    });
  });
});
