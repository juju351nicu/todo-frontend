import type {
  WbsBaselineComparisonRow,
  WbsBaselineComparisonStatus,
  WbsBaselineCreateForm,
  WbsBaselineCreateRequest,
  WbsBaselineTask,
  WbsTask,
} from "@/features/wbs/types/wbs";
import type { SemanticColor } from "@/shared/types/color";

/** baseline作成Formをtrimし、Backend DTOのnullable説明へ変換する。 */
export const buildWbsBaselineCreateRequest = (
  form: Readonly<WbsBaselineCreateForm>
): WbsBaselineCreateRequest => {
  const description = form.description.trim();
  return {
    name: form.name.trim(),
    description: description === "" ? null : description,
  };
};

/** baseline名・説明をBackendと同じ文字数境界で検査する。 */
export const validateWbsBaselineCreateForm = (
  form: Readonly<WbsBaselineCreateForm>
): string[] => {
  const messages: string[] = [];
  const name = form.name.trim();
  const description = form.description.trim();
  if (name === "") {
    messages.push("baseline名を入力してください。");
  } else if (name.length > 100) {
    messages.push("baseline名は100文字以内で入力してください。");
  }
  if (description.length > 1000) {
    messages.push("説明は1000文字以内で入力してください。");
  }
  return messages;
};

/** 同じTask IDに対する現在計画とbaselineの予定値を比較状態へ変換する。 */
const resolveComparisonStatus = (
  currentTask: Readonly<WbsTask> | undefined,
  baselineTask: Readonly<WbsBaselineTask> | undefined
): WbsBaselineComparisonStatus => {
  if (baselineTask === undefined) {
    return "CURRENT_ONLY";
  }
  if (currentTask === undefined) {
    return "BASELINE_ONLY";
  }
  return currentTask.plannedStartDate === baselineTask.plannedStartDate &&
    currentTask.plannedEndDate === baselineTask.plannedEndDate &&
    currentTask.plannedEffortMinutes === baselineTask.plannedEffortMinutes
    ? "UNCHANGED"
    : "CHANGED";
};

/** 現在計画とbaseline Taskから比較画面の1行を組み立てる。 */
const buildComparisonRow = (
  sourceTaskId: number,
  currentTask: Readonly<WbsTask> | undefined,
  baselineTask: Readonly<WbsBaselineTask> | undefined
): WbsBaselineComparisonRow => ({
  sourceTaskId,
  wbsCode: currentTask?.wbsCode ?? baselineTask?.wbsCode ?? null,
  title: currentTask?.title ?? baselineTask?.title ?? `Task ID: ${sourceTaskId}`,
  status: resolveComparisonStatus(currentTask, baselineTask),
  baselinePlannedStartDate: baselineTask?.plannedStartDate ?? null,
  baselinePlannedEndDate: baselineTask?.plannedEndDate ?? null,
  baselinePlannedEffortMinutes: baselineTask?.plannedEffortMinutes ?? null,
  currentPlannedStartDate: currentTask?.plannedStartDate ?? null,
  currentPlannedEndDate: currentTask?.plannedEndDate ?? null,
  currentPlannedEffortMinutes: currentTask?.plannedEffortMinutes ?? null,
  plannedEffortDifferenceMinutes:
    (currentTask?.plannedEffortMinutes ?? 0) -
    (baselineTask?.plannedEffortMinutes ?? 0),
});

/**
 * 現在WBSとactive baselineをTask IDで突合し、現在の表示順を優先した比較行を返す。
 * baseline後にarchiveされたTaskも末尾へ残し、計画から消えた事実を非表示にしない。
 */
export const buildWbsBaselineComparisonRows = (
  currentTasks: readonly WbsTask[],
  baselineTasks: readonly WbsBaselineTask[]
): WbsBaselineComparisonRow[] => {
  const currentById = new Map(currentTasks.map((task) => [task.taskId, task]));
  const baselineById = new Map(
    baselineTasks.map((task) => [task.sourceTaskId, task])
  );
  const currentRows = currentTasks.map((task) =>
    buildComparisonRow(task.taskId, task, baselineById.get(task.taskId))
  );
  const baselineOnlyRows = baselineTasks
    .filter((task) => !currentById.has(task.sourceTaskId))
    .map((task) => buildComparisonRow(task.sourceTaskId, undefined, task));
  return currentRows.concat(baselineOnlyRows);
};

const BASELINE_CREATED_AT_FORMATTER = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });

/** baseline作成日時（ISO）を日本語の短い日時へ変換する。解釈できない値は元の文字列を返す。 */
export const formatBaselineCreatedAt = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : BASELINE_CREATED_AT_FORMATTER.format(date);
};

const COMPARISON_STATUS_LABELS: Readonly<Record<WbsBaselineComparisonStatus, string>> = {
  UNCHANGED: "変更なし",
  CHANGED: "予定変更",
  CURRENT_ONLY: "baseline後に追加",
  BASELINE_ONLY: "現在計画から除外",
};

const COMPARISON_STATUS_COLORS: Readonly<Record<WbsBaselineComparisonStatus, SemanticColor>> = {
  UNCHANGED: "success",
  CHANGED: "warning",
  CURRENT_ONLY: "primary",
  BASELINE_ONLY: "error",
};

/** baseline比較状態を、計画変更の種類として判断できる日本語へ変換する。 */
export const getBaselineComparisonStatusLabel = (status: WbsBaselineComparisonStatus): string =>
  COMPARISON_STATUS_LABELS[status];

/** baseline比較状態を表示色へ変換する。 */
export const getBaselineComparisonStatusColor = (status: WbsBaselineComparisonStatus): SemanticColor =>
  COMPARISON_STATUS_COLORS[status];

/** 開始日・終了日のどちらかが比較対象にない場合は`—`、それ以外は`開始 ～ 終了`で表す。 */
export const formatBaselinePeriod = (dateFrom: string | null, dateTo: string | null): string =>
  dateFrom === null || dateTo === null ? "—" : `${dateFrom} ～ ${dateTo}`;

/**
 * baselineが1件もないときに出す案内を選ぶ。
 * archive済みProjectや保存できない利用者には「現在計画を保存してください」と出さない（できない操作を促さないため）。
 *
 * @param state 利用者がbaselineを保存できるかと、Projectが利用中か
 * @returns 案内文
 */
export const resolveEmptyBaselineGuidance = (state: {
  canManage: boolean;
  isProjectActive: boolean;
}): string => {
  if (!state.isProjectActive) {
    return "baselineはありません。archive済みのProjectでは保存できません。";
  }
  return state.canManage
    ? "baselineはまだありません。重要な計画変更の前に現在計画を保存してください。"
    : "baselineはまだありません。保存はProjectのOWNERまたはMANAGERが行います。";
};
