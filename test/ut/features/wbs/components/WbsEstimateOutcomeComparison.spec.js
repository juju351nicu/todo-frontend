// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import WbsEstimateOutcomeComparison from "@/features/wbs/components/WbsEstimateOutcomeComparison.vue";
import { mountWithUi } from "../../../support/mountWithUi";

/** 最新評価revision比較の表示fixture。 */
const buildComparison = (overrides = {}) => ({
  evaluatedTaskCount: 4,
  pairedSampleCount: 2,
  missingHumanEstimateTaskCount: 2,
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
  assistanceModeComparisons: [
    {
      code: "NONE",
      evaluatedTaskCount: 1,
      pairedSampleCount: 0,
      missingHumanEstimateTaskCount: 1,
      meanActualEffortMinutes: 180,
      medianActualEffortMinutes: 180,
      earliestActualEndDate: "2026-10-20",
      latestActualEndDate: "2026-10-20",
      humanEstimate: {
        withinToleranceTaskCount: 0,
        meanAbsoluteErrorMinutes: null,
        medianAbsoluteErrorMinutes: null,
        medianSignedVarianceMinutes: null,
      },
      finalPlan: {
        withinToleranceTaskCount: 0,
        meanAbsoluteErrorMinutes: null,
        medianAbsoluteErrorMinutes: null,
        medianSignedVarianceMinutes: null,
      },
    },
    {
      code: "CODING_AGENT",
      evaluatedTaskCount: 3,
      pairedSampleCount: 2,
      missingHumanEstimateTaskCount: 1,
      meanActualEffortMinutes: 150,
      medianActualEffortMinutes: 140,
      earliestActualEndDate: "2026-10-30",
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
    },
  ],
  actualAssistanceModes: [
    { code: "NONE", count: 1 },
    { code: "CODING_AGENT", count: 3 },
  ],
  varianceReasons: [{ code: "TEST_SCOPE_INCREASED", count: 2 }],
  noVarianceTaskCount: 2,
  ...overrides,
});

describe("WbsEstimateOutcomeComparison", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  it("mode別の全評価Actualと同じペア集合のHuman・Final指標を表示する", () => {
    wrapper = mountWithUi(WbsEstimateOutcomeComparison, {
      props: { comparison: buildComparison() },
    });

    expect(wrapper.text()).toContain("評価済み 4件");
    expect(wrapper.text()).toContain("ペア比較できたTask2件");
    expect(wrapper.text()).toContain("Human Estimate未入力2件");
    expect(wrapper.text()).toContain("2026-10-20 〜 2026-10-31");
    expect(wrapper.text()).toContain("Human Estimate");
    expect(wrapper.text()).toContain("Final Plan");
    expect(wrapper.text()).toContain("絶対誤差の平均1時間15分");
    expect(wrapper.text()).toContain("絶対誤差の平均25分");
    expect(wrapper.text()).toContain("1 / 2件（50%）");
    expect(wrapper.text()).toContain("2 / 2件（100%）");
    expect(wrapper.text()).toContain("支援mode別の観測Actual・精度");
    expect(wrapper.text()).toContain("因果効果は表しません");
    expect(wrapper.text()).toContain("評価 1件 / ペア 0件");
    expect(wrapper.text()).toContain("Human未入力 1件");
    expect(wrapper.text()).toContain("比較不可");
    expect(wrapper.text()).toContain("評価 3件 / ペア 2件");
    expect(wrapper.text()).toContain("参考値");
    expect(wrapper.text()).toContain("平均 1時間15分");
    expect(wrapper.text()).toContain("平均 25分");
    const [noAssistanceRow, codingAgentRow] = wrapper.findAll("tbody tr");
    expect(noAssistanceRow.text()).toContain("比較不可");
    expect(noAssistanceRow.text()).toContain("平均 3時間");
    expect(noAssistanceRow.text()).toContain("中央値 3時間");
    expect(noAssistanceRow.findAll('[aria-label="比較対象なし"]')).toHaveLength(2);
    expect(codingAgentRow.text()).toContain("Human未入力 1件");
    expect(codingAgentRow.text()).toContain("平均 2時間30分");
    expect(codingAgentRow.text()).toContain("中央値 2時間20分");
    expect(codingAgentRow.text()).toContain("±20%以内 1 / 2件（50%）");
    expect(codingAgentRow.text()).toContain("差の中央値 +30分");
    expect(codingAgentRow.text()).toContain("予定より多くかかる傾向（見積もりが少なめ）");
    expect(codingAgentRow.text()).toContain("±20%以内 2 / 2件（100%）");
    expect(codingAgentRow.text()).toContain("差の中央値 0分");
    expect(codingAgentRow.text()).toContain("偏りなし");
    expect(wrapper.text()).toContain("Coding Agent 3件");
    expect(wrapper.text()).toContain("テスト範囲の増加 2件");
    expect(wrapper.text()).toContain("差なし 2件");
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
          assistanceModeComparisons: [],
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
        comparison: buildComparison({ pairedSampleCount: 0, missingHumanEstimateTaskCount: 4 }),
      },
    });

    expect(wrapper.text()).toContain("HumanとFinalの精度をまだ比較できません");
  });
});
