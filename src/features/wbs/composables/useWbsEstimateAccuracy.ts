import { ref } from "vue";

import WbsApi from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { EstimateAccuracyResponse } from "@/features/wbs/types/wbs";
import { resolveWbsStandardErrorMessages } from "@/features/wbs/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

/**
 * WBS画面の見積もり精度（完了済み通常Taskの予定工数と実績工数の比較）の取得状態を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getEstimateAccuracy`（Project配下の`GET /wbs/estimate-accuracy`）。
 * - 誤差・中央値・許容範囲の判定はBackendの確定値を表示し、Frontendでは再計算しない。
 * - 画面の初期表示・再読込と、card上の「再集計」で取得する。日別実績等の変更では自動で再取得しない。
 * - 401では`context.handleUnauthorized`でLoginへ遷移する（このcardはDialogを持たない）。
 *
 * @param context Project IDとSession失効処理を提供する画面共通context
 */
export const useWbsEstimateAccuracy = (context: WbsPageContext) => {
  /** 最後に取得成功した見積もり精度。未取得、画面全体の取得失敗時はnull。取得失敗時は直前の値を残す。 */
  const estimateAccuracy = ref<EstimateAccuracyResponse | null>(null);
  const estimateAccuracyErrorMessages = ref<string[]>([]);
  const isLoadingEstimateAccuracy = ref(false);

  /** 見積もり精度を取得する。Project IDが不正な場合と取得中の再実行ではAPIを呼ばない。 */
  const loadEstimateAccuracy = async (): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null || isLoadingEstimateAccuracy.value) {
      return;
    }
    isLoadingEstimateAccuracy.value = true;
    estimateAccuracyErrorMessages.value = [];
    try {
      estimateAccuracy.value = await WbsApi.getEstimateAccuracy(projectId);
    } catch (error: unknown) {
      await handleEstimateAccuracyReadError(error);
    } finally {
      isLoadingEstimateAccuracy.value = false;
    }
  };

  /** 見積もり精度APIの失敗をcardの案内またはSession失効処理へ変換する。 */
  const handleEstimateAccuracyReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.estimateAccuracy.forbidden,
      notFound: DISPLAY_MESSAGES.wbs.projectNotFound,
      failed: DISPLAY_MESSAGES.wbs.estimateAccuracy.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    estimateAccuracyErrorMessages.value = result.messages;
  };

  return {
    estimateAccuracy,
    estimateAccuracyErrorMessages,
    isLoadingEstimateAccuracy,
    loadEstimateAccuracy,
  };
};
