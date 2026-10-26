import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { useWbsWorkload } from "@/features/wbs/composables/useWbsWorkload";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  workloadResponse,
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

describe("useWbsWorkload", () => {
  beforeEach(resetWbsPageMocks);

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

  it("日別実績保存後のworkload再取得が401なら日別実績Dialogを閉じてLoginへ戻す", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.openWorkLogDialog(2);
    mocks.wbsApi.getTaskWorkload.mockRejectedValue(new WbsApiError(401, null));

    await page.saveWorkLog({
      workDate: "2026-08-22",
      actualEffortMinutes: 480,
      workerAccountId: 2,
    });

    expect(page.isWorkLogDialogOpen.value).toBe(false);
    expect(page.workLogTask.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  describe("contextを直接渡した場合", () => {
    const range = { dateFrom: "2026-08-01", dateTo: "2026-08-31" };

    it("Project IDがなければworkload APIを呼ばない", async () => {
      const context = buildWbsPageContext({ projectId: { value: null } });
      const state = useWbsWorkload(context);

      await state.loadTaskWorkload(range);

      expect(mocks.wbsApi.getTaskWorkload).not.toHaveBeenCalled();
    });

    it("取得中の再実行ではworkload APIを二重送信しない", async () => {
      let resolveWorkload;
      mocks.wbsApi.getTaskWorkload.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveWorkload = resolve;
        })
      );
      const state = useWbsWorkload(buildWbsPageContext());

      const first = state.loadTaskWorkload(range);
      await state.loadTaskWorkload(range);
      resolveWorkload(structuredClone(workloadResponse));
      await first;

      expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledOnce();
      expect(state.isLoadingWorkload.value).toBe(false);
    });

    it("reloadTaskWorkloadは最後に指定した集計期間で再取得する", async () => {
      const state = useWbsWorkload(buildWbsPageContext());
      await state.loadTaskWorkload(range);
      mocks.wbsApi.getTaskWorkload.mockClear();

      await state.reloadTaskWorkload();

      expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledWith(
        7,
        "2026-08-01",
        "2026-08-31"
      );
    });

    it("401ではSession失効処理へ委ね、検索欄へ案内を出さない", async () => {
      const context = buildWbsPageContext();
      mocks.wbsApi.getTaskWorkload.mockRejectedValue(new WbsApiError(401, null));
      const state = useWbsWorkload(context);

      await state.loadTaskWorkload(range);

      expect(context.handleUnauthorized).toHaveBeenCalledOnce();
      expect(state.workloadErrorMessages.value).toEqual([]);
    });

    it.each([
      [new WbsApiError(403, null), DISPLAY_MESSAGES.wbs.workload.forbidden],
      [new WbsApiError(404, null), DISPLAY_MESSAGES.wbs.projectNotFound],
      [new WbsApiError(500, null), DISPLAY_MESSAGES.wbs.workload.loadFailed],
      [new TypeError("Failed to fetch"), DISPLAY_MESSAGES.common.connectionFailed],
    ])("取得失敗%sを検索欄の案内へ変換し直前の確定値を残す", async (error, message) => {
      const state = useWbsWorkload(buildWbsPageContext());
      await state.loadTaskWorkload(range);
      mocks.wbsApi.getTaskWorkload.mockRejectedValue(error);

      await state.reloadTaskWorkload();

      expect(state.workloadErrorMessages.value).toEqual([message]);
      expect(state.workload.value).toEqual(workloadResponse);
    });
  });
});
