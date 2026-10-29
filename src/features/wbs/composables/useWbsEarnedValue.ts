import { ref } from "vue";

import WbsApi from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type { EarnedValueResponse } from "@/features/wbs/types/wbs";
import { resolveWbsStandardErrorMessages } from "@/features/wbs/utils/apiErrors";
import { validateEarnedValueStatusDate } from "@/features/wbs/utils/earnedValue";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * EVM cardの「集計」ボタンに付ける`data-earned-value-control`属性の値。
 * 集計中は「集計」がdisabledになりフォーカスがbodyへ外れるため、利用者が押した後はここへ戻す
 * （動作確認/20_baseline_EVM_Excel帳票 G-3）。
 */
export const EARNED_VALUE_SUBMIT_CONTROL = "submit";

/**
 * WBS画面のEVM（Earned Value Management）指標の取得状態を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getEarnedValueMetrics`（Project配下の`GET /wbs/metrics`）。
 * - 指標はactive baselineを基準にBackendが計算・丸めた確定値で、Frontendでは再計算しない。
 * - baselineの作成・有効化で基準計画が変わった場合、画面側は`clearEarnedValue`で古い指標を破棄する。
 * - 基準日`earnedValueStatusDate`はExcel帳票と共有する。
 *
 * @param context Project IDとSession失効処理を提供する画面共通context
 */
export const useWbsEarnedValue = (context: WbsPageContext) => {
  /** 最後に取得成功したEVM。未取得、取得失敗、基準計画の変更後はnull。 */
  const earnedValue = ref<EarnedValueResponse | null>(null);
  const earnedValueErrorMessages = ref<string[]>([]);
  /** EVMとExcel帳票の共通基準日（yyyy-MM-dd）。初期値はブラウザーの今日。 */
  const earnedValueStatusDate = ref(getBusinessToday());
  const isLoadingEarnedValue = ref(false);

  /**
   * 基準日を検証してactive baseline基準のEVMを取得する。
   * 計算式と丸めはBackendへ委ね、FrontendではResponseをそのまま確定値として保持する。
   * 取得中の再実行と基準日不正ではAPIを呼ばない。
   *
   * @param statusDate 集計対象に含めるyyyy-MM-dd形式の業務日
   */
  const loadEarnedValueMetrics = async (statusDate: string): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null || isLoadingEarnedValue.value) {
      return;
    }
    const validationMessages = validateEarnedValueStatusDate(statusDate);
    if (validationMessages.length > 0) {
      earnedValueErrorMessages.value = validationMessages;
      return;
    }

    isLoadingEarnedValue.value = true;
    earnedValueErrorMessages.value = [];
    earnedValueStatusDate.value = statusDate;
    try {
      earnedValue.value = await WbsApi.getEarnedValueMetrics(
        projectId,
        statusDate
      );
    } catch (error: unknown) {
      earnedValue.value = null;
      await handleEarnedValueReadError(error);
    } finally {
      isLoadingEarnedValue.value = false;
    }
  };

  /**
   * 「集計」を押したときの処理。EVMを取得してから「集計」へフォーカスを戻す。
   *
   * @param statusDate 集計対象に含めるyyyy-MM-dd形式の業務日
   */
  const submitEarnedValueMetrics = async (statusDate: string): Promise<void> => {
    await loadEarnedValueMetrics(statusDate);
    if (!context.isSessionInvalidated()) {
      await focusFirstEnabledElement([
        `[data-earned-value-control="${EARNED_VALUE_SUBMIT_CONTROL}"]`,
      ]);
    }
  };

  /** EVM参照APIの失敗を検索欄の案内またはSession失効処理へ変換する。409はactive baselineがないことを表す。 */
  const handleEarnedValueReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.earnedValue.forbidden,
      notFound: DISPLAY_MESSAGES.wbs.projectNotFound,
      conflict: DISPLAY_MESSAGES.wbs.earnedValue.activeBaselineRequired,
      failed: DISPLAY_MESSAGES.wbs.earnedValue.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    earnedValueErrorMessages.value = result.messages;
  };

  /**
   * 取得済み指標とエラーを破棄する。基準日は利用者の入力として残す。
   * 画面の再読込時と、baselineの作成・有効化で基準計画が変わったときに呼ぶ。
   */
  const clearEarnedValue = (): void => {
    earnedValue.value = null;
    earnedValueErrorMessages.value = [];
  };

  return {
    clearEarnedValue,
    earnedValue,
    earnedValueErrorMessages,
    earnedValueStatusDate,
    isLoadingEarnedValue,
    loadEarnedValueMetrics,
    submitEarnedValueMetrics,
  };
};
