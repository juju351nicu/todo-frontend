import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "vue";
import { useTaskExecutionComparison } from "@/features/wbs/composables/useTaskExecutionComparison";
import {
  getExecutionComparison,
  recordExecutionSetting,
} from "@/features/wbs/api/taskExecutionApi";
import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { createExecutionSettingForm } from "@/features/wbs/utils/taskExecution";
import { buildWbsPageContext, resetWbsPageMocks } from "./wbsPageTestSupport";

vi.mock("@/features/auth/stores/user", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useUserStore: () => mocks.userStore };
});
vi.mock("@/features/wbs/api/taskExecutionApi", () => ({
  getExecutionComparison: vi.fn(),
  recordExecutionSetting: vi.fn(),
}));

const comparison = () => ({
  projectId: 7,
  taskId: 2,
  workerAccountId: 2,
  groups: [],
  days: [],
  measurements: [],
  sessions: [
    {
      timerSessionId: 12,
      startedAt: "2026-11-23T01:00:00Z",
      stoppedAt: "2026-11-23T02:00:00Z",
      settings: null,
      progressMeasurementId: null,
    },
  ],
});
const form = () => ({
  ...createExecutionSettingForm(),
  timerSessionId: 12,
  assistanceMode: "CODING_AGENT",
});

describe("本人の設定別実績画面", () => {
  beforeEach(() => {
    resetWbsPageMocks();
    vi.mocked(getExecutionComparison).mockReset().mockResolvedValue(comparison());
    vi.mocked(recordExecutionSetting).mockReset().mockResolvedValue({});
  });
  it("初期状態・Summary・Milestoneでは参照せず通常Taskを開いたときだけ取得する", async () => {
    const state = useTaskExecutionComparison(buildWbsPageContext());
    await state.openExecutionComparison(1);
    await state.openExecutionComparison(3);
    expect(getExecutionComparison).not.toHaveBeenCalled();
    await state.openExecutionComparison(2);
    expect(getExecutionComparison).toHaveBeenCalledOnce();
    expect(state.executionComparison.value.taskId).toBe(2);
  });
  it("逆順・存在しない日付を入力するとAPIを送信しない", async () => {
    const state = useTaskExecutionComparison(buildWbsPageContext());
    await state.openExecutionComparison(2);
    state.executionDateFrom.value = "2026-02-30";
    await state.loadExecutionComparison();
    expect(getExecutionComparison).toHaveBeenCalledOnce();
    expect(state.executionErrorMessages.value).toEqual([
      "開始日と終了日を正しく指定してください。",
    ]);
  });
  it("close後や新しい期間読込の後に届く古い成功・失敗を反映しない", async () => {
    let rejectOld;
    getExecutionComparison.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject;
        })
    );
    const state = useTaskExecutionComparison(buildWbsPageContext());
    const oldLoad = state.openExecutionComparison(2);
    await state.loadExecutionComparison();
    rejectOld(new WbsApiError(401, null));
    await oldLoad;
    expect(state.executionComparison.value.taskId).toBe(2);
    expect(state.executionErrorMessages.value).toEqual([]);
    let resolveOld;
    getExecutionComparison.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    const closedLoad = state.loadExecutionComparison();
    state.closeExecutionComparison();
    resolveOld(comparison());
    await closedLoad;
    expect(state.executionComparison.value).toBeNull();
  });
  it("読込中に日付を不正へ変えた場合も以前の期間の応答を復元しない", async () => {
    let resolveOld;
    getExecutionComparison.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    const state = useTaskExecutionComparison(buildWbsPageContext());
    const loading = state.openExecutionComparison(2);
    state.executionDateTo.value = "2026-02-30";
    await state.loadExecutionComparison();
    resolveOld(comparison());
    await loading;
    expect(state.executionComparison.value).toBeNull();
    expect(state.isLoadingExecutionComparison.value).toBe(false);
    expect(state.executionErrorMessages.value).toHaveLength(1);
  });
  it("保存中は二重送信・close・Task切替を抑止し保存後に正本を読む", async () => {
    let resolveSave;
    recordExecutionSetting.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    const state = useTaskExecutionComparison(buildWbsPageContext());
    await state.openExecutionComparison(2);
    const saving = state.saveExecutionSetting(form());
    await state.saveExecutionSetting(form());
    state.closeExecutionComparison();
    await state.openExecutionComparison(1);
    expect(recordExecutionSetting).toHaveBeenCalledOnce();
    expect(state.isExecutionComparisonOpen.value).toBe(true);
    resolveSave({});
    await saving;
    expect(getExecutionComparison).toHaveBeenCalledTimes(2);
    expect(state.executionSuccessMessage.value).toContain("記録しました");
  });
  it.each(["readOnly", "otherAssignee", "archived", "recorded", "unknownSession"])(
    "%sでは設定保存を送信しない",
    async (condition) => {
      const context = buildWbsPageContext();
      if (condition === "readOnly") context.canEditWbs = computed(() => false);
      if (condition === "otherAssignee")
        context.wbs.value.tasks.find((t) => t.taskId === 2).assigneeAccountId = 1;
      if (condition === "archived") context.project.value.status = "ARCHIVED";
      const data = comparison();
      if (condition === "recorded") data.sessions[0].settings = { assistanceMode: "NONE" };
      if (condition === "unknownSession") data.sessions = [];
      getExecutionComparison.mockResolvedValue(data);
      const state = useTaskExecutionComparison(context);
      await state.openExecutionComparison(2);
      await state.saveExecutionSetting(form());
      expect(recordExecutionSetting).not.toHaveBeenCalled();
    }
  );
  it("409では正本を再取得しても競合の案内を残し、自動再送しない", async () => {
    recordExecutionSetting.mockRejectedValueOnce(new WbsApiError(409, null));
    const state = useTaskExecutionComparison(buildWbsPageContext());
    await state.openExecutionComparison(2);
    await state.saveExecutionSetting(form());
    expect(getExecutionComparison).toHaveBeenCalledTimes(2);
    expect(recordExecutionSetting).toHaveBeenCalledOnce();
    expect(state.executionErrorMessages.value.join()).toContain("記録済み");
  });
  it("401は共通Session処理へ委ね、破棄後の保存応答を復元しない", async () => {
    const context = buildWbsPageContext();
    const state = useTaskExecutionComparison(context);
    context.handleUnauthorized.mockImplementation(async () => state.discardExecutionComparison());
    await state.openExecutionComparison(2);
    recordExecutionSetting.mockRejectedValueOnce(new WbsApiError(401, null));
    await state.saveExecutionSetting(form());
    expect(context.handleUnauthorized).toHaveBeenCalledOnce();
    expect(getExecutionComparison).toHaveBeenCalledOnce();
    expect(state.executionComparison.value).toBeNull();
    expect(state.isSavingExecutionSetting.value).toBe(false);
  });
});
