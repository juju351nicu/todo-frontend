import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import {
  EARNED_VALUE_SUBMIT_CONTROL,
  useWbsEarnedValue,
} from "@/features/wbs/composables/useWbsEarnedValue";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  earnedValueResponse,
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

describe("useWbsEarnedValue", () => {
  beforeEach(resetWbsPageMocks);

  it("指定基準日のEVMを取得しBackend確定値を画面状態へ保持する", async () => {
    const page = useWbsPage();
    await page.initialize();

    expect(mocks.wbsApi.getEarnedValueMetrics).not.toHaveBeenCalled();
    await page.loadEarnedValueMetrics("2026-08-30");

    expect(mocks.wbsApi.getEarnedValueMetrics).toHaveBeenCalledWith(
      7,
      "2026-08-30"
    );
    expect(page.earnedValueStatusDate.value).toBe("2026-08-30");
    expect(page.earnedValue.value).toEqual(earnedValueResponse);
    expect(page.earnedValueErrorMessages.value).toEqual([]);
  });

  it("不正なEVM基準日ではAPIを呼ばず入力理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();

    await page.loadEarnedValueMetrics("2026-02-29");

    expect(mocks.wbsApi.getEarnedValueMetrics).not.toHaveBeenCalled();
    expect(page.earnedValueErrorMessages.value).toEqual([
      "EVM基準日を入力してください。",
    ]);
  });

  it("active baselineがない409では古いEVMを破棄して作成案内を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    await page.loadEarnedValueMetrics("2026-08-30");
    mocks.wbsApi.getEarnedValueMetrics.mockRejectedValueOnce(
      new WbsApiError(409, null)
    );

    await page.loadEarnedValueMetrics("2026-08-31");

    expect(page.earnedValue.value).toBeNull();
    expect(page.earnedValueErrorMessages.value).toEqual([
      "EVMを集計するにはactive baselineが必要です。",
    ]);
  });

  it("EVM取得の401ではSessionを破棄してログイン画面へ遷移する", async () => {
    mocks.wbsApi.getEarnedValueMetrics.mockRejectedValue(
      new WbsApiError(401, null)
    );
    const page = useWbsPage();
    await page.initialize();

    await page.loadEarnedValueMetrics("2026-08-30");

    expect(mocks.userStore.clearSession).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.earnedValue.value).toBeNull();
  });

  it.each([
    ["baseline作成", (page) => page.saveWbsBaseline({ name: "9月計画", description: "" })],
    ["baseline有効化", (page) => page.activateWbsBaseline(page.baselineList.value.baselines[1])],
  ])("%sに成功すると基準計画が変わるため取得済みEVMを破棄する", async (_label, mutate) => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();
    await page.loadEarnedValueMetrics("2026-08-30");
    expect(page.earnedValue.value).toEqual(earnedValueResponse);
    page.openBaselineCreateDialog();

    await mutate(page);

    expect(page.earnedValue.value).toBeNull();
    expect(page.earnedValueErrorMessages.value).toEqual([]);
    expect(page.earnedValueStatusDate.value).toBe("2026-08-30");
  });

  describe("contextを直接渡した場合", () => {
    it("Project IDがなければEVM APIを呼ばない", async () => {
      const state = useWbsEarnedValue(
        buildWbsPageContext({ projectId: { value: null } })
      );

      await state.loadEarnedValueMetrics("2026-08-30");

      expect(mocks.wbsApi.getEarnedValueMetrics).not.toHaveBeenCalled();
    });

    it("取得中の再実行ではEVM APIを二重送信しない", async () => {
      let resolveMetrics;
      mocks.wbsApi.getEarnedValueMetrics.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMetrics = resolve;
        })
      );
      const state = useWbsEarnedValue(buildWbsPageContext());

      const first = state.loadEarnedValueMetrics("2026-08-30");
      await state.loadEarnedValueMetrics("2026-08-31");
      resolveMetrics(structuredClone(earnedValueResponse));
      await first;

      expect(mocks.wbsApi.getEarnedValueMetrics).toHaveBeenCalledOnce();
      expect(state.earnedValueStatusDate.value).toBe("2026-08-30");
      expect(state.isLoadingEarnedValue.value).toBe(false);
    });

    it.each([
      [new WbsApiError(403, null), DISPLAY_MESSAGES.wbs.earnedValue.forbidden],
      [new WbsApiError(404, null), DISPLAY_MESSAGES.wbs.projectNotFound],
      [new WbsApiError(500, null), DISPLAY_MESSAGES.wbs.earnedValue.loadFailed],
      [new TypeError("Failed to fetch"), DISPLAY_MESSAGES.common.connectionFailed],
    ])("取得失敗%sでは古い指標を破棄して案内を表示する", async (error, message) => {
      const context = buildWbsPageContext();
      const state = useWbsEarnedValue(context);
      await state.loadEarnedValueMetrics("2026-08-30");
      mocks.wbsApi.getEarnedValueMetrics.mockRejectedValue(error);

      await state.loadEarnedValueMetrics("2026-08-31");

      expect(state.earnedValue.value).toBeNull();
      expect(state.earnedValueErrorMessages.value).toEqual([message]);
      expect(context.handleUnauthorized).not.toHaveBeenCalled();
    });

    it("「集計」を押した後は「集計」へフォーカスを戻す", async () => {
      const state = useWbsEarnedValue(buildWbsPageContext());

      await state.submitEarnedValueMetrics("2026-08-31");

      expect(mocks.focusedControls).toEqual([EARNED_VALUE_SUBMIT_CONTROL]);
    });

    it("clearEarnedValueは基準日を残して指標とエラーだけを破棄する", async () => {
      const state = useWbsEarnedValue(buildWbsPageContext());
      await state.loadEarnedValueMetrics("2026-08-30");
      state.earnedValueErrorMessages.value = ["古いエラー"];

      state.clearEarnedValue();

      expect(state.earnedValue.value).toBeNull();
      expect(state.earnedValueErrorMessages.value).toEqual([]);
      expect(state.earnedValueStatusDate.value).toBe("2026-08-30");
    });
  });
});
