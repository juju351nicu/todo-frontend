import type {
  EstimateAccuracyMetric,
  EstimateAccuracyResponse,
  EstimateAccuracyTask,
  TaskEstimateOutcomeComparison,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes, formatSignedEffortMinutes } from "@/features/wbs/utils/effort";

/**
 * 散布図の目盛り間隔の候補（分）。30分から始め、1・2・4・8時間…と倍にして5本前後の目盛りに収める。
 */
const TICK_STEP_CANDIDATES_MINUTES = [30, 60, 120, 240, 480, 960, 1920, 3840, 7680, 15360] as const;

/** 1軸あたりの目盛り本数の上限。これを超えない最小の間隔を採用する。 */
const MAX_TICK_COUNT = 6;

/** 最大値の点が枠に接しないよう、軸の上限を最大値より広げる割合。 */
const AXIS_HEADROOM_RATIO = 1.1;

/** 散布図の1点。座標は描画領域の左下を原点とする0〜1の割合で、画面のpixelへの変換はComponentが行う。 */
export interface EstimateAccuracyChartPoint {
  /** 元のTask行。tooltipと一覧で使う。 */
  task: EstimateAccuracyTask;
  /** 予定工数の位置（0〜1、左端が0）。 */
  x: number;
  /** 実績工数の位置（0〜1、下端が0）。 */
  y: number;
}

/** 散布図の目盛り。 */
export interface EstimateAccuracyChartTick {
  /** 目盛りの値（分）。 */
  minutes: number;
  /** 目盛りの位置（0〜1）。 */
  ratio: number;
  /** 目盛りの表示文字列（例: `2時間`）。 */
  label: string;
}

/**
 * 予定工数を横軸、実績工数を縦軸にした散布図の描画データ。両軸は同じ尺度で、対角線が「予定どおり」を表す。
 */
export interface EstimateAccuracyChart {
  /** 両軸共通の上限（分）。 */
  axisMaxMinutes: number;
  /** 両軸共通の目盛り。0を含む昇順。 */
  ticks: EstimateAccuracyChartTick[];
  /** Task ID順の点。 */
  points: EstimateAccuracyChartPoint[];
  /**
   * 「見積もりどおり」とみなす帯（実績が予定の±許容割合以内）の頂点。0〜1の割合で、左下原点。
   * 原点から下側の線・右上・上側の線の順に並ぶ。
   */
  toleranceBand: { x: number; y: number }[];
}

/**
 * 最大値を含み、目盛りが`MAX_TICK_COUNT`本以下になる間隔で、両軸共通の上限と目盛りを決める。
 *
 * @param maxMinutes 予定・実績の最大値（分）。1以上
 * @returns 上限（分）と0からの目盛り
 */
const buildAxis = (maxMinutes: number): Pick<EstimateAccuracyChart, "axisMaxMinutes" | "ticks"> => {
  const paddedMax = maxMinutes * AXIS_HEADROOM_RATIO;
  const step =
    TICK_STEP_CANDIDATES_MINUTES.find(
      (candidate) => Math.ceil(paddedMax / candidate) <= MAX_TICK_COUNT
    ) ??
    // 候補の上限（256時間間隔）でも収まらない極端な値は、目盛り本数を優先して間隔を広げる。
    Math.ceil(paddedMax / MAX_TICK_COUNT);
  const axisMaxMinutes = Math.ceil(paddedMax / step) * step;
  const ticks: EstimateAccuracyChartTick[] = [];
  for (let minutes = 0; minutes <= axisMaxMinutes; minutes += step) {
    ticks.push({
      minutes,
      ratio: minutes / axisMaxMinutes,
      label: formatEffortMinutes(minutes),
    });
  }
  return { axisMaxMinutes, ticks };
};

/**
 * 見積もり精度Responseを散布図の描画データへ変換する。
 *
 * @param response Backendが確定した見積もり精度
 * @returns 描画データ。誤差を計算したTaskが0件の場合はnull（散布図を表示しない）
 */
export const buildEstimateAccuracyChart = (
  response: Readonly<EstimateAccuracyResponse>
): EstimateAccuracyChart | null => {
  if (response.tasks.length === 0) {
    return null;
  }
  const maxMinutes = Math.max(
    ...response.tasks.flatMap((task) => [task.plannedEffortMinutes, task.actualEffortMinutes])
  );
  const { axisMaxMinutes, ticks } = buildAxis(maxMinutes);
  const toleranceRatio = response.tolerancePercent / 100;
  return {
    axisMaxMinutes,
    ticks,
    points: response.tasks.map((task) => ({
      task,
      x: task.plannedEffortMinutes / axisMaxMinutes,
      y: task.actualEffortMinutes / axisMaxMinutes,
    })),
    // 下側の線（実績 = 予定 × (1 - 許容割合)）と上側の線（実績 = 予定 × (1 + 許容割合)）で囲む。
    // 上側の線は右端より先に上端へ達するため、上端との交点を頂点にする。
    toleranceBand: [
      { x: 0, y: 0 },
      { x: 1, y: 1 - toleranceRatio },
      { x: 1, y: 1 },
      { x: 1 / (1 + toleranceRatio), y: 1 },
    ],
  };
};

/**
 * 誤差を計算したTaskが最低件数に満たず、傾向として読めない（参考値として表示する）かを返す。
 *
 * @param response Backendが確定した見積もり精度
 * @returns 参考値として扱う場合はtrue
 */
export const isEstimateAccuracyReferenceOnly = (
  response: Readonly<EstimateAccuracyResponse>
): boolean => response.sampleCount < response.minimumSampleCount;

/**
 * 「見積もりどおり」に収まったTaskの件数と割合を表示用に整形する。
 *
 * @param response Backendが確定した見積もり精度
 * @returns `2 / 3件（67%）`の形式。対象が0件の場合は`—`
 */
export const formatWithinToleranceRate = (response: Readonly<EstimateAccuracyResponse>): string => {
  return formatAccuracyMetricWithinToleranceRate(
    response.withinToleranceTaskCount,
    response.sampleCount
  );
};

/**
 * 最新評価revisionのHumanまたはFinal指標について、許容割合内の件数と割合を整形する。
 *
 * @param metric Backendが同じペア集合で確定した精度指標
 * @param sampleCount Human Estimateがあるペア比較対象件数
 * @returns `2 / 3件（67%）`の形式。対象が0件の場合は`—`
 */
export const formatOutcomeWithinToleranceRate = (
  metric: Readonly<EstimateAccuracyMetric>,
  sampleCount: number
): string => formatAccuracyMetricWithinToleranceRate(metric.withinToleranceTaskCount, sampleCount);

/**
 * 最新評価revisionのペア比較が最低件数未満で、参考値として扱うかを返す。
 *
 * @param comparison Backendが確定した最新評価revision比較
 * @returns 1件以上かつ最低件数未満の場合はtrue
 */
export const isOutcomeComparisonReferenceOnly = (
  comparison: Readonly<TaskEstimateOutcomeComparison>
): boolean =>
  comparison.pairedSampleCount > 0 && comparison.pairedSampleCount < comparison.minimumSampleCount;

/**
 * 最新評価revisionが表すTask実績終了日の範囲を表示する。
 *
 * @param comparison Backendが確定した最新評価revision比較
 * @returns 単日の場合はその日、範囲がある場合は`開始日 〜 終了日`、評価0件では`—`
 */
export const formatOutcomeActualEndDateRange = (
  comparison: Readonly<TaskEstimateOutcomeComparison>
): string => {
  const earliestDate = comparison.earliestActualEndDate;
  const latestDate = comparison.latestActualEndDate;
  if (earliestDate === null || latestDate === null) {
    return "—";
  }
  return earliestDate === latestDate ? earliestDate : `${earliestDate} 〜 ${latestDate}`;
};

/** 許容割合内の件数と母数から表示用の件数・割合を作る。 */
const formatAccuracyMetricWithinToleranceRate = (
  withinToleranceTaskCount: number,
  sampleCount: number
): string => {
  if (sampleCount === 0) {
    return "—";
  }
  const percent = Math.round((withinToleranceTaskCount / sampleCount) * 100);
  return `${withinToleranceTaskCount} / ${sampleCount}件（${percent}%）`;
};

/**
 * 符号付きの工数を表示用に整形する。比較対象がない（null）場合は`—`にする。
 *
 * @param minutes `実績 - 予定`等の符号付き工数（分）。対象がない場合はnull
 * @returns `+1時間`、`-30分`、`0分`、または`—`
 */
export const formatOptionalSignedEffortMinutes = (minutes: number | null): string =>
  minutes === null ? "—" : formatSignedEffortMinutes(minutes);

/**
 * 符号付き誤差の中央値から、見積もりの偏りの向きを文章にする。
 *
 * @param medianSignedVarianceMinutes `実績 - 予定`の中央値（分）。対象がない場合はnull
 * @returns 偏りの説明。対象がない場合は`—`
 */
export const describeEstimateBias = (medianSignedVarianceMinutes: number | null): string => {
  if (medianSignedVarianceMinutes === null) {
    return "—";
  }
  if (medianSignedVarianceMinutes > 0) {
    return "予定より多くかかる傾向（見積もりが少なめ）";
  }
  if (medianSignedVarianceMinutes < 0) {
    return "予定より早く終わる傾向（見積もりが多め）";
  }
  return "偏りなし";
};

/**
 * Taskの表示名を、階層表と同じくWBSコードがあれば前置して作る。
 *
 * @param task 誤差を計算したTask
 * @returns `"1.1 実装"`、`"実装"`、またはタイトルがない場合は`"Task ID: 15"`
 */
export const formatEstimateAccuracyTaskLabel = (task: Readonly<EstimateAccuracyTask>): string => {
  const title =
    task.title === null || task.title.trim() === "" ? `Task ID: ${task.taskId}` : task.title;
  return task.wbsCode === null || task.wbsCode.trim() === "" ? title : `${task.wbsCode} ${title}`;
};

/**
 * 一覧表を、誤差の大きい（振り返る価値が高い）Task順に並べる。同じ誤差ではTask ID順にする。
 *
 * @param tasks 誤差を計算したTask
 * @returns 並べ替えた新しい配列。元の配列は変更しない
 */
export const sortByAbsoluteErrorDescending = (
  tasks: readonly EstimateAccuracyTask[]
): EstimateAccuracyTask[] =>
  [...tasks].sort(
    (left, right) =>
      right.absoluteErrorMinutes - left.absoluteErrorMinutes || left.taskId - right.taskId
  );
