import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useTaskEstimates } from "@/features/wbs/composables/useTaskEstimates";

import {
  buildWbsPageContext,
  decidedTaskEstimateList,
  evaluatedTaskEstimateList,
  mocks,
  project,
  resetWbsPageMocks,
  taskEstimateList,
  updatedTaskEstimateList,
  updatedWbs,
} from "./wbsPageTestSupport";

vi.mock("@/features/auth/stores/user", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useUserStore: () => mocks.userStore };
});
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.wbsApi };
});

describe("useTaskEstimates", () => {
  beforeEach(resetWbsPageMocks);

  const openEstimates = async (contextOverrides = {}) => {
    const context = buildWbsPageContext(contextOverrides);
    const options = {
      reloadPageSnapshot: vi.fn(async () => {}),
      handleReadApiError: vi.fn(async () => {}),
    };
    const state = useTaskEstimates(context, options);
    await state.openEstimateDialog(2);
    return { context, options, state };
  };

  const openEvaluableEstimates = async () => {
    const context = buildWbsPageContext();
    context.wbs.value.tasks = context.wbs.value.tasks.map((task) =>
      task.taskId === 2 ? { ...task, actualEndDate: "2026-08-24" } : task
    );
    const state = useTaskEstimates(context, {
      reloadPageSnapshot: vi.fn(async () => {}),
      handleReadApiError: vi.fn(async () => {}),
    });
    await state.openEstimateDialog(2);
    return { context, state };
  };

  it("通常Taskを選ぶと見積もり履歴を遅延取得する", async () => {
    const { state } = await openEstimates();

    expect(mocks.wbsApi.getTaskEstimates).toHaveBeenCalledWith(7, 2);
    expect(state.isEstimateDialogOpen.value).toBe(true);
    expect(state.estimateTask.value).toMatchObject({ taskId: 2, version: 4 });
    expect(state.estimateList.value).toEqual(taskEstimateList);
    expect(state.canCreateHumanEstimate.value).toBe(true);
    expect(state.canDecideEstimate.value).toBe(true);
  });

  it("取得時点Task versionで採否を確定しFinal PlanとWBS Taskを同じResponseへ更新する", async () => {
    const { context, state } = await openEstimates();

    await state.saveTaskEstimateDecision({
      taskEstimateSnapshotId: 61,
      decisionCode: "ADOPTED",
      adjustedPlannedEffortMinutes: null,
    });

    expect(mocks.wbsApi.createTaskEstimateDecision).toHaveBeenCalledWith(7, 2, 61, {
      decisionCode: "ADOPTED",
      adjustedPlannedEffortMinutes: null,
      taskVersion: 4,
    });
    expect(state.estimateList.value).toEqual(decidedTaskEstimateList);
    expect(state.estimateTask.value).toMatchObject({ version: 5, plannedEffortMinutes: 420 });
    expect(context.wbs.value.tasks.find((task) => task.taskId === 2)).toMatchObject({
      version: 5,
      plannedEffortMinutes: 420,
    });
    expect(state.estimateSuccessMessage.value).toBe(
      "見積もりをFinal Planへ反映し、採否履歴へ保存しました。"
    );
  });

  it("完了Taskを実利用支援方法・誤差理由・最新Task version付き評価revisionへ保存する", async () => {
    const { state } = await openEvaluableEstimates();

    expect(state.canEvaluateEstimate.value).toBe(true);
    await state.saveTaskEstimateOutcome({
      actualAssistanceMode: "CODING_AGENT",
      varianceReasonCode: "TEST_SCOPE_INCREASED",
      varianceNote: "  追加テストを実施  ",
    });

    expect(mocks.wbsApi.createTaskEstimateOutcome).toHaveBeenCalledWith(7, 2, {
      actualAssistanceMode: "CODING_AGENT",
      varianceReasonCode: "TEST_SCOPE_INCREASED",
      varianceNote: "追加テストを実施",
      taskVersion: 4,
    });
    expect(state.estimateList.value).toEqual(evaluatedTaskEstimateList);
    expect(state.estimateSuccessMessage.value).toBe("完了Taskの見積もり評価を保存しました。");
  });

  it("Final PlanとActualに差があるのに理由がなければ評価APIを呼ばない", async () => {
    const { state } = await openEvaluableEstimates();

    await state.saveTaskEstimateOutcome({
      actualAssistanceMode: "NONE",
      varianceReasonCode: null,
      varianceNote: "",
    });

    expect(mocks.wbsApi.createTaskEstimateOutcome).not.toHaveBeenCalled();
    expect(state.estimateEditorErrorMessages.value).toEqual([
      "Final PlanとActualに差があるため、誤差理由を選択してください。",
    ]);
  });

  it("実績終了日がないTaskでは評価APIを呼ばず完了条件を案内する", async () => {
    const { state } = await openEstimates();

    expect(state.canEvaluateEstimate.value).toBe(false);
    await state.saveTaskEstimateOutcome({
      actualAssistanceMode: "NONE",
      varianceReasonCode: "REQUIREMENTS_GAP",
      varianceNote: "",
    });

    expect(mocks.wbsApi.createTaskEstimateOutcome).not.toHaveBeenCalled();
    expect(state.estimateEditorErrorMessages.value).toEqual([
      "評価には完了Taskの実績終了日、Final Plan、Actual、更新権限が必要です。",
    ]);
  });

  it("不正な調整採用では確定APIを呼ばず理由を表示する", async () => {
    const { state } = await openEstimates();

    await state.saveTaskEstimateDecision({
      taskEstimateSnapshotId: 61,
      decisionCode: "ADJUSTED",
      adjustedPlannedEffortMinutes: 420,
    });

    expect(mocks.wbsApi.createTaskEstimateDecision).not.toHaveBeenCalled();
    expect(state.estimateEditorErrorMessages.value).toEqual([
      "最頻値を変更せず採用する場合は「そのまま採用」を選択してください。",
    ]);
  });

  it("見積もりResponseの最新Task versionと正式予定工数を選択Taskへ反映する", async () => {
    mocks.wbsApi.getTaskEstimates.mockResolvedValue({
      ...structuredClone(taskEstimateList),
      taskVersion: 8,
      finalPlannedEffortMinutes: 600,
    });

    const { state } = await openEstimates();

    expect(state.estimateTask.value).toMatchObject({
      taskId: 2,
      version: 8,
      plannedEffortMinutes: 600,
    });
    await state.saveHumanEstimate({
      assistanceMode: "NONE",
      estimateLowMinutes: null,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: null,
    });
    expect(mocks.wbsApi.createHumanEstimate).toHaveBeenCalledWith(
      7,
      2,
      expect.objectContaining({ taskVersion: 8 })
    );
  });

  it("Summaryでは見積もりAPIを呼ばず通常Taskだけが対象だと案内する", async () => {
    const context = buildWbsPageContext();
    const state = useTaskEstimates(context, {
      reloadPageSnapshot: vi.fn(),
      handleReadApiError: vi.fn(),
    });

    await state.openEstimateDialog(1);

    expect(mocks.wbsApi.getTaskEstimates).not.toHaveBeenCalled();
    expect(state.isEstimateDialogOpen.value).toBe(false);
    expect(context.errorMessages.value).toEqual([
      "Human Estimateを登録できるのは通常Taskだけです。",
    ]);
  });

  it("取得時点Task version付きで3点見積もりを追記する", async () => {
    const { state } = await openEstimates();

    await state.saveHumanEstimate({
      assistanceMode: "CODING_AGENT",
      estimateLowMinutes: 300,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: 480,
    });

    expect(mocks.wbsApi.createHumanEstimate).toHaveBeenCalledWith(7, 2, {
      assistanceMode: "CODING_AGENT",
      estimateLowMinutes: 300,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: 480,
      taskVersion: 4,
    });
    expect(state.estimateList.value).toEqual(updatedTaskEstimateList);
    expect(state.estimateSuccessMessage.value).toBe("Human Estimateを保存しました。");
  });

  it("不正な3点見積もりでは登録APIを呼ばず理由を表示する", async () => {
    const { state } = await openEstimates();

    await state.saveHumanEstimate({
      assistanceMode: "NONE",
      estimateLowMinutes: 480,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: 300,
    });

    expect(mocks.wbsApi.createHumanEstimate).not.toHaveBeenCalled();
    expect(state.estimateEditorErrorMessages.value).toEqual([
      "3点見積もりは楽観値、最頻値、悲観値の順に入力してください。",
    ]);
  });

  it("通常memberは他者担当TaskへHuman Estimateを追加しない", async () => {
    const context = buildWbsPageContext();
    context.wbs.value.tasks = context.wbs.value.tasks.map((task) =>
      task.taskId === 2 ? { ...task, assigneeAccountId: 1 } : task
    );
    const state = useTaskEstimates(context, {
      reloadPageSnapshot: vi.fn(),
      handleReadApiError: vi.fn(),
    });
    await state.openEstimateDialog(2);

    await state.saveHumanEstimate({
      assistanceMode: "NONE",
      estimateLowMinutes: null,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: null,
    });

    expect(state.canCreateHumanEstimate.value).toBe(false);
    expect(mocks.wbsApi.createHumanEstimate).not.toHaveBeenCalled();
  });

  it("Project管理者は他者担当TaskへHuman Estimateを追加できる", async () => {
    const ownerProject = structuredClone(project);
    ownerProject.members[1].projectRole = "OWNER";
    const { state } = await openEstimates({
      project: ref(ownerProject),
      canManageProject: computed(() => true),
    });

    await state.saveHumanEstimate({
      assistanceMode: "GENERAL_AI",
      estimateLowMinutes: null,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: null,
    });

    expect(mocks.wbsApi.createHumanEstimate).toHaveBeenCalledOnce();
  });

  it("409競合ではWBSと履歴を再取得し次回は最新Task versionを送る", async () => {
    const latestEstimateList = {
      ...structuredClone(updatedTaskEstimateList),
      taskVersion: 5,
    };
    mocks.wbsApi.createHumanEstimate
      .mockRejectedValueOnce(new WbsApiError(409, null))
      .mockResolvedValueOnce(latestEstimateList);
    mocks.wbsApi.getTaskEstimates
      .mockResolvedValueOnce(structuredClone(taskEstimateList))
      .mockResolvedValueOnce(latestEstimateList);
    const context = buildWbsPageContext();
    const options = {
      reloadPageSnapshot: vi.fn(async () => {
        context.wbs.value = structuredClone(updatedWbs);
      }),
      handleReadApiError: vi.fn(async () => {}),
    };
    const state = useTaskEstimates(context, options);
    await state.openEstimateDialog(2);
    const form = {
      assistanceMode: "NONE",
      estimateLowMinutes: null,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: null,
    };

    await state.saveHumanEstimate(form);
    await state.saveHumanEstimate(form);

    expect(options.reloadPageSnapshot).toHaveBeenCalledOnce();
    expect(state.estimateTask.value.version).toBe(5);
    expect(mocks.wbsApi.createHumanEstimate).toHaveBeenLastCalledWith(
      7,
      2,
      expect.objectContaining({ taskVersion: 5 })
    );
  });

  it("archive済みProjectでは履歴を参照できるが追加しない", async () => {
    const archivedProject = { ...structuredClone(project), status: "ARCHIVED" };
    const { state } = await openEstimates({ project: ref(archivedProject) });

    expect(state.estimateList.value).toEqual(taskEstimateList);
    expect(state.canCreateHumanEstimate.value).toBe(false);
  });

  it("見積もり参照APIの401をSession失効処理へ委ねる", async () => {
    mocks.wbsApi.getTaskEstimates.mockRejectedValue(new WbsApiError(401, null));
    const context = buildWbsPageContext();
    const state = useTaskEstimates(context, {
      reloadPageSnapshot: vi.fn(),
      handleReadApiError: vi.fn(),
    });

    await state.openEstimateDialog(2);

    expect(context.handleUnauthorized).toHaveBeenCalledOnce();
  });
});
