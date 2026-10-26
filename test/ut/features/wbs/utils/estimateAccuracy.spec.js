import { describe, expect, it } from "vitest";

import {
  buildEstimateAccuracyChart,
  describeEstimateBias,
  formatEstimateAccuracyTaskLabel,
  formatOptionalSignedEffortMinutes,
  formatWithinToleranceRate,
  isEstimateAccuracyReferenceOnly,
  sortByAbsoluteErrorDescending,
} from "@/features/wbs/utils/estimateAccuracy";

/** 散布図の計算に必要な項目だけを持つTask行。 */
const buildTask = (taskId, plannedEffortMinutes, actualEffortMinutes, overrides = {}) => ({
  taskId,
  wbsCode: null,
  title: `Task ${taskId}`,
  plannedEffortMinutes,
  actualEffortMinutes,
  signedVarianceMinutes: actualEffortMinutes - plannedEffortMinutes,
  absoluteErrorMinutes: Math.abs(actualEffortMinutes - plannedEffortMinutes),
  withinTolerance: false,
  ...overrides,
});

/** 見積もり精度Response。既定は誤差を計算したTaskが0件。 */
const buildResponse = (overrides = {}) => ({
  projectId: 7,
  completedTaskCount: 0,
  missingPlanTaskCount: 0,
  missingActualTaskCount: 0,
  sampleCount: 0,
  minimumSampleCount: 10,
  tolerancePercent: 20,
  withinToleranceTaskCount: 0,
  medianAbsoluteErrorMinutes: null,
  medianSignedVarianceMinutes: null,
  tasks: [],
  ...overrides,
});

describe("見積もり精度の散布図", () => {
  it("誤差を計算したTaskがなければ散布図を作らない", () => {
    expect(buildEstimateAccuracyChart(buildResponse())).toBeNull();
  });

  it("予定・実績の最大値に1割の余白を足し、目盛り6本以下の間隔で両軸を揃える", () => {
    const chart = buildEstimateAccuracyChart(
      buildResponse({ tasks: [buildTask(1, 480, 600), buildTask(2, 120, 60)] })
    );

    // 最大600分×1.1=660分。2時間間隔なら6本で収まり、上限は720分になる。
    expect(chart.axisMaxMinutes).toBe(720);
    expect(chart.ticks.map((tick) => tick.minutes)).toEqual([0, 120, 240, 360, 480, 600, 720]);
    expect(chart.ticks[1]).toEqual({ minutes: 120, ratio: 120 / 720, label: "2時間" });
    expect(chart.points.map((point) => [point.task.taskId, point.x, point.y])).toEqual([
      [1, 480 / 720, 600 / 720],
      [2, 120 / 720, 60 / 720],
    ]);
  });

  it("小さい工数は30分間隔の目盛りにする", () => {
    const chart = buildEstimateAccuracyChart(buildResponse({ tasks: [buildTask(1, 30, 45)] }));

    expect(chart.axisMaxMinutes).toBe(60);
    expect(chart.ticks.map((tick) => tick.label)).toEqual(["0分", "30分", "1時間"]);
  });

  it("候補の間隔で収まらない極端な工数でも目盛りを6本以下にする", () => {
    const chart = buildEstimateAccuracyChart(buildResponse({ tasks: [buildTask(1, 100000, 200000)] }));

    expect(chart.ticks.length).toBeLessThanOrEqual(7);
    expect(chart.axisMaxMinutes).toBeGreaterThanOrEqual(220000);
  });

  it("許容範囲の帯は予定の±許容割合の2本の線で囲む", () => {
    const chart = buildEstimateAccuracyChart(buildResponse({ tasks: [buildTask(1, 60, 60)] }));

    expect(chart.toleranceBand).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0.8 },
      { x: 1, y: 1 },
      { x: 1 / 1.2, y: 1 },
    ]);
  });
});

describe("見積もり精度の表示", () => {
  it.each([
    [9, true],
    [10, false],
  ])("誤差を計算したTaskが%i件なら参考値扱いは%s", (sampleCount, expected) => {
    expect(isEstimateAccuracyReferenceOnly(buildResponse({ sampleCount }))).toBe(expected);
  });

  it("見積もりどおりの件数と割合を四捨五入して表示し、対象0件は—にする", () => {
    expect(formatWithinToleranceRate(buildResponse({ sampleCount: 3, withinToleranceTaskCount: 2 }))).toBe(
      "2 / 3件（67%）"
    );
    expect(formatWithinToleranceRate(buildResponse())).toBe("—");
  });

  it.each([
    [60, "予定より多くかかる傾向（見積もりが少なめ）"],
    [-30, "予定より早く終わる傾向（見積もりが多め）"],
    [0, "偏りなし"],
    [null, "—"],
  ])("符号付き誤差の中央値%sを偏りの向きとして説明する", (median, expected) => {
    expect(describeEstimateBias(median)).toBe(expected);
  });

  it("符号付き工数は正負記号付き、nullは—にする", () => {
    expect(formatOptionalSignedEffortMinutes(90)).toBe("+1時間30分");
    expect(formatOptionalSignedEffortMinutes(-30)).toBe("-30分");
    expect(formatOptionalSignedEffortMinutes(null)).toBe("—");
  });

  it("Task名はWBSコードを前置し、タイトルがなければTask IDで示す", () => {
    expect(formatEstimateAccuracyTaskLabel(buildTask(2, 1, 1, { wbsCode: "1.1", title: "実装" }))).toBe("1.1 実装");
    expect(formatEstimateAccuracyTaskLabel(buildTask(2, 1, 1, { wbsCode: " ", title: "実装" }))).toBe("実装");
    expect(formatEstimateAccuracyTaskLabel(buildTask(15, 1, 1, { title: null }))).toBe("Task ID: 15");
  });

  it("一覧は誤差の大きい順、同じ誤差はTask ID順にし元の配列を変えない", () => {
    const tasks = [buildTask(3, 60, 90), buildTask(1, 60, 120), buildTask(2, 60, 30)];

    expect(sortByAbsoluteErrorDescending(tasks).map((task) => task.taskId)).toEqual([1, 2, 3]);
    expect(tasks.map((task) => task.taskId)).toEqual([3, 1, 2]);
  });
});
