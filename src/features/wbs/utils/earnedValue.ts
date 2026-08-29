import { isValidIsoLocalDate } from "@/features/wbs/utils/effort";

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
  isValidIsoLocalDate(statusDate)
    ? []
    : ["EVM基準日を入力してください。"];

/** Backendが算出した分単位EVM値を再計算せず、小数第2位まで表示する。 */
export const formatEarnedValueMinutes = (minutes: number): string =>
  Number.isFinite(minutes)
    ? `${DECIMAL_MINUTES_FORMATTER.format(minutes)}分`
    : "—";

/** Backendが算出したSV・CVを正負方向が分かる分表示へ変換する。 */
export const formatSignedEarnedValueMinutes = (minutes: number): string =>
  Number.isFinite(minutes)
    ? `${SIGNED_DECIMAL_MINUTES_FORMATTER.format(minutes)}分`
    : "—";

/** nullableなSPI・CPIをBackendの小数第4位精度を保って表示する。 */
export const formatEarnedValueRatio = (ratio: number | null): string =>
  ratio === null || !Number.isFinite(ratio)
    ? "算出対象外"
    : RATIO_FORMATTER.format(ratio);

/** nullableなBackend確定済み進捗率を小数第2位までの百分率表示へ変換する。 */
export const formatEarnedValuePercent = (percent: number | null): string =>
  percent === null || !Number.isFinite(percent)
    ? "算出対象外"
    : `${PERCENT_FORMATTER.format(percent)}%`;
