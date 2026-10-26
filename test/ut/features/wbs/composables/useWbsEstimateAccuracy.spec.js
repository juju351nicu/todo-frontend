import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsEstimateAccuracy } from "@/features/wbs/composables/useWbsEstimateAccuracy";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  estimateAccuracyResponse,
  mocks,
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

describe("useWbsEstimateAccuracy", () => {
  beforeEach(resetWbsPageMocks);

  it("初期表示でProjectの見積もり精度を取得しBackend確定値を保持する", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getEstimateAccuracy).toHaveBeenCalledWith(7);
    expect(page.estimateAccuracy.value).toEqual(estimateAccuracyResponse);
    expect(page.estimateAccuracyErrorMessages.value).toEqual([]);
  });

  it("画面全体の取得に失敗した場合は見積もり精度APIを呼ばず古い値も残さない", async () => {
    const page = useWbsPage();
    await page.initialize();
    mocks.wbsApi.getEstimateAccuracy.mockClear();
    mocks.wbsApi.getWbs.mockRejectedValue(new WbsApiError(500, null));

    await page.initialize();

    expect(mocks.wbsApi.getEstimateAccuracy).not.toHaveBeenCalled();
    expect(page.estimateAccuracy.value).toBeNull();
  });

  it("見積もり精度の401ではSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.getEstimateAccuracy.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.estimateAccuracyErrorMessages.value).toEqual([]);
  });

  describe("contextを直接渡した場合", () => {
    it("Project IDがなければ見積もり精度APIを呼ばない", async () => {
      const state = useWbsEstimateAccuracy(buildWbsPageContext({ projectId: { value: null } }));

      await state.loadEstimateAccuracy();

      expect(mocks.wbsApi.getEstimateAccuracy).not.toHaveBeenCalled();
      expect(state.estimateAccuracy.value).toBeNull();
    });

    it("取得中の再実行では見積もり精度APIを二重送信しない", async () => {
      let resolveAccuracy;
      mocks.wbsApi.getEstimateAccuracy.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveAccuracy = resolve;
        })
      );
      const state = useWbsEstimateAccuracy(buildWbsPageContext());

      const first = state.loadEstimateAccuracy();
      await state.loadEstimateAccuracy();
      expect(state.isLoadingEstimateAccuracy.value).toBe(true);
      resolveAccuracy(structuredClone(estimateAccuracyResponse));
      await first;

      expect(mocks.wbsApi.getEstimateAccuracy).toHaveBeenCalledOnce();
      expect(state.isLoadingEstimateAccuracy.value).toBe(false);
    });

    it.each([
      [new WbsApiError(403, null), DISPLAY_MESSAGES.wbs.estimateAccuracy.forbidden],
      [new WbsApiError(404, null), DISPLAY_MESSAGES.wbs.projectNotFound],
      [new WbsApiError(500, null), DISPLAY_MESSAGES.wbs.estimateAccuracy.loadFailed],
      [new TypeError("Failed to fetch"), DISPLAY_MESSAGES.common.connectionFailed],
    ])("再集計の失敗%sをcardの案内へ変換し直前の確定値を残す", async (error, message) => {
      const context = buildWbsPageContext();
      const state = useWbsEstimateAccuracy(context);
      await state.loadEstimateAccuracy();
      mocks.wbsApi.getEstimateAccuracy.mockRejectedValue(error);

      await state.loadEstimateAccuracy();

      expect(state.estimateAccuracyErrorMessages.value).toEqual([message]);
      expect(state.estimateAccuracy.value).toEqual(estimateAccuracyResponse);
      expect(context.handleUnauthorized).not.toHaveBeenCalled();
    });

    it("再集計に成功すると前回の失敗案内を消す", async () => {
      mocks.wbsApi.getEstimateAccuracy.mockRejectedValueOnce(new WbsApiError(500, null));
      const state = useWbsEstimateAccuracy(buildWbsPageContext());
      await state.loadEstimateAccuracy();
      expect(state.estimateAccuracyErrorMessages.value).toHaveLength(1);

      await state.loadEstimateAccuracy();

      expect(state.estimateAccuracyErrorMessages.value).toEqual([]);
      expect(state.estimateAccuracy.value).toEqual(estimateAccuracyResponse);
    });
  });
});
