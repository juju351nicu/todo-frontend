import { isValidIsoLocalDate } from "@/features/wbs/utils/effort";
import type { SemanticColor } from "@/shared/types/color";

const DECIMAL_MINUTES_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});
const SIGNED_DECIMAL_MINUTES_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
  signDisplay: "always",
});
const RATIO_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 4,
});
const PERCENT_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});

/** EVM基準日がBackend契約の実在するyyyy-MM-ddかを検証する。 */
export const validateEarnedValueStatusDate = (statusDate: string): string[] =>
  isValidIsoLocalDate(statusDate) ? [] : ["EVM基準日を入力してください。"];

/** Backendが算出した分単位EVM値を再計算せず、小数第2位まで表示する。 */
export const formatEarnedValueMinutes = (minutes: number): string =>
  Number.isFinite(minutes) ? `${DECIMAL_MINUTES_FORMATTER.format(minutes)}分` : "—";

/** Backendが算出したSV・CVを正負方向が分かる分表示へ変換する。 */
export const formatSignedEarnedValueMinutes = (minutes: number): string =>
  Number.isFinite(minutes) ? `${SIGNED_DECIMAL_MINUTES_FORMATTER.format(minutes)}分` : "—";

/** nullableなSPI・CPIをBackendの小数第4位精度を保って表示する。 */
export const formatEarnedValueRatio = (ratio: number | null): string =>
  ratio === null || !Number.isFinite(ratio) ? "算出対象外" : RATIO_FORMATTER.format(ratio);

/** nullableなBackend確定済み進捗率を小数第2位までの百分率表示へ変換する。 */
export const formatEarnedValuePercent = (percent: number | null): string =>
  percent === null || !Number.isFinite(percent)
    ? "算出対象外"
    : `${PERCENT_FORMATTER.format(percent)}%`;

/** 1以上を健全とするSPI・CPIをEVM表示の注意色へ変換する。 */
export const getEarnedValueRatioColor = (ratio: number | null): SemanticColor | undefined => {
  if (ratio === null || !Number.isFinite(ratio)) {
    return undefined;
  }
  return ratio >= 1 ? "success" : "error";
};

/** 0以上を健全とするSV・CVをEVM表示の注意色へ変換する。 */
export const getEarnedValueVarianceColor = (variance: number): SemanticColor | undefined => {
  if (!Number.isFinite(variance)) {
    return undefined;
  }
  return variance >= 0 ? "success" : "error";
};

/**
 * EVMを集計する前（結果がなく、エラーも出ていないとき）に出す案内を選ぶ。
 * baselineの有無で次にすることが違うため、状況に合った案内だけを出す。
 *
 * @param state 有効なbaselineの有無と、利用者がbaselineを保存できるか
 * @returns 案内文
 */
export const resolveEarnedValueGuidance = (state: {
  hasActiveBaseline: boolean;
  canManageBaselines: boolean;
}): string => {
  if (state.hasActiveBaseline) {
    return "基準日を指定して集計してください。";
  }
  return state.canManageBaselines
    ? "EVMの集計には有効なbaselineが必要です。先に上のbaselineで現在計画を保存してください。"
    : "有効なbaselineがないため集計できません。baselineの保存はProjectのOWNERまたはMANAGERが行います。";
};
