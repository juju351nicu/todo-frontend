import type {
  EstimateAssistanceMode,
  EstimateAssistanceModeOption,
  HumanEstimateCreateRequest,
  HumanEstimateForm,
  TaskEstimateDecisionCode,
  TaskEstimateDecisionCreateRequest,
  TaskEstimateDecisionForm,
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

/** 見積もり採否欄で選択できるFinal Plan反映方法。 */
export const ESTIMATE_DECISION_OPTIONS: Array<{
  title: string;
  value: TaskEstimateDecisionCode;
}> = [
  { title: "そのまま採用", value: "ADOPTED" },
  { title: "調整して採用", value: "ADJUSTED" },
  { title: "却下", value: "REJECTED" },
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

const ESTIMATE_DECISION_LABELS: Readonly<Record<TaskEstimateDecisionCode, string>> = {
  ADOPTED: "そのまま採用",
  ADJUSTED: "調整して採用",
  REJECTED: "却下",
};

/** 新しいHuman Estimate用の空Formを作る。 */
export const buildHumanEstimateForm = (): HumanEstimateForm => ({
  assistanceMode: "NONE",
  estimateLowMinutes: null,
  estimateLikelyMinutes: null,
  estimateHighMinutes: null,
});

/** 未決定revisionを初期選択した見積もり採否Formを作る。 */
export const buildTaskEstimateDecisionForm = (
  taskEstimateSnapshotId: number | null = null
): TaskEstimateDecisionForm => ({
  taskEstimateSnapshotId,
  decisionCode: "ADOPTED",
  adjustedPlannedEffortMinutes: null,
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

/**
 * 見積もり採否FormをBackendと同じ主要制約で検証する。
 * Project・Task状態、認可、採否済み状態、Task versionはBackendを最終判定とする。
 */
export const validateTaskEstimateDecisionForm = (
  form: Readonly<TaskEstimateDecisionForm>,
  estimate: Readonly<TaskEstimateSnapshot> | undefined
): string[] => {
  if (form.taskEstimateSnapshotId === null || estimate === undefined) {
    return ["採否を決める見積もりrevisionを選択してください。"];
  }
  if (form.decisionCode !== "ADJUSTED") {
    return form.adjustedPlannedEffortMinutes === null
      ? []
      : ["調整後の正式予定工数は「調整して採用」の場合だけ入力してください。"];
  }
  const adjustedMinutes = form.adjustedPlannedEffortMinutes;
  if (adjustedMinutes === null || !Number.isSafeInteger(adjustedMinutes) || adjustedMinutes < 1) {
    return ["調整後の正式予定工数は1分以上の整数で入力してください。"];
  }
  if (adjustedMinutes === estimate.estimateLikelyMinutes) {
    return ["最頻値を変更せず採用する場合は「そのまま採用」を選択してください。"];
  }
  return [];
};

/** 検証済み採否Formと取得時点Task versionから採否確定Requestを作る。 */
export const buildTaskEstimateDecisionCreateRequest = (
  form: Readonly<TaskEstimateDecisionForm>,
  taskVersion: number
): TaskEstimateDecisionCreateRequest => ({
  decisionCode: form.decisionCode,
  adjustedPlannedEffortMinutes:
    form.decisionCode === "ADJUSTED" ? form.adjustedPlannedEffortMinutes : null,
  taskVersion,
});

/** AI支援方法コードを画面表示名へ変換する。 */
export const formatEstimateAssistanceMode = (mode: EstimateAssistanceMode): string =>
  ASSISTANCE_MODE_LABELS[mode];

/** 見積もり作成主体コードを画面表示名へ変換する。 */
export const formatTaskEstimateSource = (source: TaskEstimateSource): string =>
  ESTIMATE_SOURCE_LABELS[source];

/** 見積もり採否codeを画面表示名へ変換する。 */
export const formatTaskEstimateDecision = (decision: TaskEstimateDecisionCode): string =>
  ESTIMATE_DECISION_LABELS[decision];

/** 単一点または3点の見積もりを分・時間の表示へ変換する。 */
export const formatTaskEstimateRange = (estimate: Readonly<TaskEstimateSnapshot>): string =>
  estimate.estimateLowMinutes === null || estimate.estimateHighMinutes === null
    ? formatEffortMinutes(estimate.estimateLikelyMinutes)
    : `${formatEffortMinutes(estimate.estimateLowMinutes)} / ${formatEffortMinutes(
        estimate.estimateLikelyMinutes
      )} / ${formatEffortMinutes(estimate.estimateHighMinutes)}`;
