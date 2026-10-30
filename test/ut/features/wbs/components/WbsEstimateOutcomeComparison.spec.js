// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import WbsEstimateOutcomeComparison from "@/features/wbs/components/WbsEstimateOutcomeComparison.vue";
import { mountWithUi } from "../../../support/mountWithUi";

/** 最新評価revision比較の表示fixture。 */
const buildComparison = (overrides = {}) => ({
  evaluatedTaskCount: 3,
  pairedSampleCount: 2,
  missingHumanEstimateTaskCount: 1,
  minimumSampleCount: 10,
  tolerancePercent: 20,
  earliestActualEndDate: "2026-10-20",
  latestActualEndDate: "2026-10-31",
  humanEstimate: {
    withinToleranceTaskCount: 1,
    meanAbsoluteErrorMinutes: 75,
    medianAbsoluteErrorMinutes: 90,
    medianSignedVarianceMinutes: 30,
  },
  finalPlan: {
    withinToleranceTaskCount: 2,
    meanAbsoluteErrorMinutes: 25,
    medianAbsoluteErrorMinutes: 30,
    medianSignedVarianceMinutes: 0,
  },
  actualAssistanceModes: [
    { code: "NONE", count: 1 },
    { code: "CODING_AGENT", count: 2 },
  ],
  varianceReasons: [{ code: "TEST_SCOPE_INCREASED", count: 2 }],
  noVarianceTaskCount: 1,
  ...overrides,
});

describe("WbsEstimateOutcomeComparison", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  it("同じペア集合のHuman・Final指標と欠損・期間・分類分布を表示する", () => {
    wrapper = mountWithUi(WbsEstimateOutcomeComparison, {
      props: { comparison: buildComparison() },
    });

    expect(wrapper.text()).toContain("評価済み 3件");
    expect(wrapper.text()).toContain("ペア比較できたTask2件");
    expect(wrapper.text()).toContain("Human Estimate未入力1件");
    expect(wrapper.text()).toContain("2026-10-20 〜 2026-10-31");
    expect(wrapper.text()).toContain("Human Estimate");
    expect(wrapper.text()).toContain("Final Plan");
    expect(wrapper.text()).toContain("絶対誤差の平均1時間15分");
    expect(wrapper.text()).toContain("絶対誤差の平均25分");
    expect(wrapper.text()).toContain("1 / 2件（50%）");
    expect(wrapper.text()).toContain("2 / 2件（100%）");
    expect(wrapper.text()).toContain("Coding Agent 2件");
    expect(wrapper.text()).toContain("テスト範囲の増加 2件");
    expect(wrapper.text()).toContain("差なし 1件");
    expect(wrapper.text()).toContain("2件のため参考値です");
  });

  it("評価がない場合は比較値を作らず登録方法を案内する", () => {
    wrapper = mountWithUi(WbsEstimateOutcomeComparison, {
      props: {
        comparison: buildComparison({
          evaluatedTaskCount: 0,
          pairedSampleCount: 0,
          missingHumanEstimateTaskCount: 0,
          earliestActualEndDate: null,
          latestActualEndDate: null,
          actualAssistanceModes: [],
          varianceReasons: [],
          noVarianceTaskCount: 0,
        }),
      },
    });

    expect(wrapper.text()).toContain("完了Taskの評価はまだありません");
    expect(wrapper.text()).not.toContain("実際に利用したAI支援");
  });

  it("評価済みでもHuman Estimateがなければペア比較不能を明示する", () => {
    wrapper = mountWithUi(WbsEstimateOutcomeComparison, {
      props: {
        comparison: buildComparison({ pairedSampleCount: 0, missingHumanEstimateTaskCount: 3 }),
      },
    });

    expect(wrapper.text()).toContain("HumanとFinalの精度をまだ比較できません");
  });
});
