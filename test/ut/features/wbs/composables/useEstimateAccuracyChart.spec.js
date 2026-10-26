import { describe, expect, it } from "vitest";
import { ref } from "vue";

import { useEstimateAccuracyChart } from "@/features/wbs/composables/useEstimateAccuracyChart";

import { estimateAccuracyResponse } from "./wbsPageTestSupport";

describe("useEstimateAccuracyChart", () => {
  it("未取得の間は散布図と一覧を空にする", () => {
    const state = useEstimateAccuracyChart(() => null);

    expect(state.chart.value).toBeNull();
    expect(state.tasksByAbsoluteError.value).toEqual([]);
    expect(state.activePoint.value).toBeNull();
  });

  it("hover・focusした点だけをtooltip対象にし、別の点のleaveでは閉じない", () => {
    const state = useEstimateAccuracyChart(() => structuredClone(estimateAccuracyResponse));

    state.showPoint(2);
    expect(state.activePoint.value?.task.taskId).toBe(2);
    state.showPoint(4);
    // 点2から点4へ移った直後に点2のleaveが届いても、点4のtooltipを消さない。
    state.hidePoint(2);
    expect(state.activePoint.value?.task.taskId).toBe(4);
    state.hidePoint(4);
    expect(state.activePoint.value).toBeNull();
  });

  it("再集計で対象Taskが消えた場合はtooltipを表示しない", () => {
    const response = ref(structuredClone(estimateAccuracyResponse));
    const state = useEstimateAccuracyChart(() => response.value);
    state.showPoint(4);

    response.value = {
      ...response.value,
      sampleCount: 1,
      tasks: response.value.tasks.filter((task) => task.taskId !== 4),
    };

    expect(state.activePoint.value).toBeNull();
    expect(state.chart.value?.points).toHaveLength(1);
  });
});
