import type {
  EstimateAssistanceMode,
  EstimateAssistanceModeOption,
  HumanEstimateCreateRequest,
  HumanEstimateForm,
  TaskEstimateSnapshot,
  TaskEstimateSource,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";

/** Human Estimateで選択できるprovider非依存のAI支援方法。 */
export const ESTIMATE_ASSISTANCE_MODE_OPTIONS: EstimateAssistanceModeOption[] = [
  { title: "AI支援なし", value: "NONE" },
  { title: "汎用AI", value: "GENERAL_AI" },
  { title: "Coding Agent", value: "CODING_AGENT" },
];

const ASSISTANCE_MODE_LABELS: Readonly<Record<EstimateAssistanceMode, string>> = {
  NONE: "AI支援なし",
  GENERAL_AI: "汎用AI",
  CODING_AGENT: "Coding Agent",
};

const ESTIMATE_SOURCE_LABELS: Readonly<Record<TaskEstimateSource, string>> = {
  HUMAN: "Human Estimate",
  AI: "AI Estimate",
};

/** 新しいHuman Estimate用の空Formを作る。 */
export const buildHumanEstimateForm = (): HumanEstimateForm => ({
  assistanceMode: "NONE",
  estimateLowMinutes: null,
  estimateLikelyMinutes: null,
  estimateHighMinutes: null,
});

/**
 * Human EstimateをBackendと同じ主要制約で検証する。
 * Task種別、archive状態、Task version、認可はBackendを最終判定とする。
 *
 * @param form Dialogから受け取った入力値
 * @returns 利用者へ表示する検証message。問題がなければ空配列
 */
export const validateHumanEstimateForm = (form: Readonly<HumanEstimateForm>): string[] => {
  const messages: string[] = [];
  const lowMinutes = form.estimateLowMinutes;
  const likelyMinutes = form.estimateLikelyMinutes;
  const highMinutes = form.estimateHighMinutes;
  if (likelyMinutes === null || !Number.isSafeInteger(likelyMinutes) || likelyMinutes < 1) {
    messages.push("最頻値は1分以上の整数で入力してください。");
  }

  if ((lowMinutes === null) !== (highMinutes === null)) {
    messages.push("3点見積もりでは楽観値と悲観値を両方入力してください。");
    return messages;
  }
  if (lowMinutes === null || highMinutes === null) {
    return messages;
  }
  if (
    !Number.isSafeInteger(lowMinutes) ||
    !Number.isSafeInteger(highMinutes) ||
    lowMinutes < 1 ||
    highMinutes < 1
  ) {
    messages.push("楽観値と悲観値は1分以上の整数で入力してください。");
    return messages;
  }
  if (likelyMinutes !== null && (lowMinutes > likelyMinutes || likelyMinutes > highMinutes)) {
    messages.push("3点見積もりは楽観値、最頻値、悲観値の順に入力してください。");
  }
  return messages;
};

/** 検証済みFormと取得時点Task versionからHuman Estimate登録Requestを作る。 */
export const buildHumanEstimateCreateRequest = (
  form: Readonly<HumanEstimateForm>,
  taskVersion: number
): HumanEstimateCreateRequest => ({
  assistanceMode: form.assistanceMode,
  estimateLowMinutes: form.estimateLowMinutes,
  estimateLikelyMinutes: form.estimateLikelyMinutes as number,
  estimateHighMinutes: form.estimateHighMinutes,
  taskVersion,
});

/** AI支援方法コードを画面表示名へ変換する。 */
export const formatEstimateAssistanceMode = (mode: EstimateAssistanceMode): string =>
  ASSISTANCE_MODE_LABELS[mode];

/** 見積もり作成主体コードを画面表示名へ変換する。 */
export const formatTaskEstimateSource = (source: TaskEstimateSource): string =>
  ESTIMATE_SOURCE_LABELS[source];

/** 単一点または3点の見積もりを分・時間の表示へ変換する。 */
export const formatTaskEstimateRange = (estimate: Readonly<TaskEstimateSnapshot>): string =>
  estimate.estimateLowMinutes === null || estimate.estimateHighMinutes === null
    ? formatEffortMinutes(estimate.estimateLikelyMinutes)
    : `${formatEffortMinutes(estimate.estimateLowMinutes)} / ${formatEffortMinutes(
        estimate.estimateLikelyMinutes
      )} / ${formatEffortMinutes(estimate.estimateHighMinutes)}`;
