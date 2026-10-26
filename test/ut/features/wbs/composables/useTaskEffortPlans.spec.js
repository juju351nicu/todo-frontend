import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useTaskEffortPlans } from "@/features/wbs/composables/useTaskEffortPlans";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  project,
  effortPlanList,
  updatedEffortPlanList,
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

describe("useTaskEffortPlans", () => {
  beforeEach(resetWbsPageMocks);

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
        fieldErrors: [
          {
            errorCode: "TASK_EFFORT_PLAN_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
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

  describe("contextを直接渡した場合", () => {
    const form = { planDate: "2026-08-23", plannedEffortMinutes: 60, assigneeAccountId: 2 };

    /** 通常Task 2の日別予定Dialogを開いた通常member（accountId 2）の状態を作る。workload再取得はmockにする。 */
    const openEffortPlans = async (contextOverrides = {}) => {
      const context = buildWbsPageContext(contextOverrides);
      const options = { reloadWorkload: vi.fn(async () => {}) };
      const state = useTaskEffortPlans(context, options);
      await state.openEffortPlanDialog(2);
      return { context, options, state };
    };

    it("存在しないTaskでは日別予定APIを呼ばず画面上部へ理由を表示する", async () => {
      const context = buildWbsPageContext();
      const state = useTaskEffortPlans(context, { reloadWorkload: vi.fn() });

      await state.openEffortPlanDialog(99);

      expect(mocks.wbsApi.getTaskEffortPlans).not.toHaveBeenCalled();
      expect(state.isEffortPlanDialogOpen.value).toBe(false);
      expect(context.errorMessages.value).toEqual(["予定工数を参照するTaskが見つかりません。"]);
    });

    it("一覧の読込中はDialogを閉じず、別Taskの読込も開始しない", async () => {
      let resolveEffortPlans;
      mocks.wbsApi.getTaskEffortPlans.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveEffortPlans = resolve;
        })
      );
      const state = useTaskEffortPlans(buildWbsPageContext(), { reloadWorkload: vi.fn() });

      const opening = state.openEffortPlanDialog(2);
      state.closeEffortPlanDialog();
      await state.openEffortPlanDialog(2);
      expect(state.isEffortPlanDialogOpen.value).toBe(true);
      resolveEffortPlans(structuredClone(effortPlanList));
      await opening;

      expect(mocks.wbsApi.getTaskEffortPlans).toHaveBeenCalledOnce();
      expect(state.effortPlanList.value).toEqual(effortPlanList);
    });

    it("TASK_UPDATEがなければ登録APIを呼ばず権限不足を表示する", async () => {
      const { options, state } = await openEffortPlans({ canEditWbs: computed(() => false) });

      await state.saveEffortPlan(form);

      expect(state.canEditSelectedEffortPlanTask.value).toBe(false);
      expect(mocks.wbsApi.createTaskEffortPlan).not.toHaveBeenCalled();
      expect(state.effortPlanEditorErrorMessages.value).toEqual([
        "このTaskの日別予定を更新する権限がありません。",
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("編集中の日別予定を削除すると編集Formも新規登録へ戻す", async () => {
      const { options, state } = await openEffortPlans();
      state.editEffortPlan(51);
      state.requestEffortPlanDelete(51);

      await state.confirmEffortPlanDelete();

      expect(state.editingEffortPlan.value).toBeNull();
      expect(state.effortPlanList.value).toEqual(
        expect.objectContaining({
          totalDailyPlannedEffortMinutes: 0,
          unallocatedEffortMinutes: 480,
          effortPlans: [],
        })
      );
      expect(options.reloadWorkload).toHaveBeenCalledOnce();
    });

    it("複数の日別予定から1件削除すると残りの合計で未配賦工数を算出し、別予定の編集は残す", async () => {
      mocks.wbsApi.getTaskEffortPlans.mockResolvedValue({
        ...structuredClone(effortPlanList),
        totalDailyPlannedEffortMinutes: 420,
        unallocatedEffortMinutes: 60,
        effortPlans: [
          ...structuredClone(effortPlanList.effortPlans),
          {
            ...structuredClone(effortPlanList.effortPlans[0]),
            effortPlanId: 52,
            planDate: "2026-08-23",
            plannedEffortMinutes: 120,
          },
        ],
      });
      const { state } = await openEffortPlans();
      state.editEffortPlan(52);
      state.requestEffortPlanDelete(51);

      await state.confirmEffortPlanDelete();

      expect(state.effortPlanList.value).toEqual(
        expect.objectContaining({
          taskPlannedEffortMinutes: 480,
          totalDailyPlannedEffortMinutes: 120,
          unallocatedEffortMinutes: 360,
        })
      );
      expect(state.effortPlanList.value?.effortPlans.map((plan) => plan.effortPlanId)).toEqual([52]);
      expect(state.editingEffortPlan.value?.effortPlanId).toBe(52);
    });

    it("削除APIの403では確認対象を残し権限不足を表示する", async () => {
      mocks.wbsApi.deleteTaskEffortPlan.mockRejectedValue(new WbsApiError(403, null));
      const { options, state } = await openEffortPlans();
      state.requestEffortPlanDelete(51);

      await state.confirmEffortPlanDelete();

      expect(state.effortPlanPendingDelete.value?.effortPlanId).toBe(51);
      expect(state.effortPlanEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.effortPlan.deleteForbidden,
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("保存中は編集の取消を受け付けない", async () => {
      let resolveUpdate;
      mocks.wbsApi.updateTaskEffortPlan.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );
      const { state } = await openEffortPlans();
      state.editEffortPlan(51);

      const saving = state.saveEffortPlan({ ...form, planDate: "2026-08-22" });
      state.cancelEffortPlanEdit();
      expect(state.editingEffortPlan.value?.effortPlanId).toBe(51);
      resolveUpdate(structuredClone(updatedEffortPlanList));
      await saving;

      expect(state.editingEffortPlan.value).toBeNull();
      expect(state.effortPlanSuccessMessage.value).toBe("Task日別予定を更新しました。");
    });

    it("競合後の一覧再取得が500なら競合理由を残して再読込案内を追加する", async () => {
      mocks.wbsApi.updateTaskEffortPlan.mockRejectedValue(new WbsApiError(409, null));
      const { options, state } = await openEffortPlans();
      state.editEffortPlan(51);
      mocks.wbsApi.getTaskEffortPlans.mockRejectedValue(new WbsApiError(500, null));

      await state.saveEffortPlan({ ...form, planDate: "2026-08-22" });

      expect(state.editingEffortPlan.value).toBeNull();
      expect(state.effortPlanEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.effortPlan.conflict,
        DISPLAY_MESSAGES.wbs.effortPlan.reloadFailed,
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("競合後の一覧再取得が401ならDialogを閉じ、workloadを再取得せずSession失効処理を呼ぶ", async () => {
      mocks.wbsApi.deleteTaskEffortPlan.mockRejectedValue(new WbsApiError(409, null));
      const { context, options, state } = await openEffortPlans();
      state.requestEffortPlanDelete(51);
      mocks.wbsApi.getTaskEffortPlans.mockRejectedValue(new WbsApiError(401, null));

      await state.confirmEffortPlanDelete();

      expect(state.isEffortPlanDialogOpen.value).toBe(false);
      expect(state.effortPlanEditorErrorMessages.value).toEqual([]);
      expect(context.handleUnauthorized).toHaveBeenCalledOnce();
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("削除確認dialogを閉じたときだけ確認対象を破棄する", async () => {
      const { state } = await openEffortPlans();
      state.requestEffortPlanDelete(51);

      state.handleEffortPlanDeleteDialogVisibility(true);
      expect(state.effortPlanPendingDelete.value).not.toBeNull();
      state.handleEffortPlanDeleteDialogVisibility(false);
      expect(state.effortPlanPendingDelete.value).toBeNull();
    });
  });
});
