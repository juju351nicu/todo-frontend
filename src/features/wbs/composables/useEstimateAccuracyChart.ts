import { computed, ref } from "vue";

import type { EstimateAccuracyResponse } from "@/features/wbs/types/wbs";
import {
  buildEstimateAccuracyChart,
  sortByAbsoluteErrorDescending,
  type EstimateAccuracyChartPoint,
} from "@/features/wbs/utils/estimateAccuracy";

/**
 * 見積もり精度cardの散布図・一覧の表示状態（描画データ、並べ替え、hover・focus中の点）を管理する。
 * APIは呼ばず、親から渡された確定済みResponseだけを表示用に変換する。
 *
 * @param estimateAccuracy 表示する見積もり精度。未取得の場合はnull
 */
export const useEstimateAccuracyChart = (
  estimateAccuracy: () => EstimateAccuracyResponse | null
) => {
  /** tooltipを表示中の点のTask ID。表示していない場合はnull。 */
  const activeTaskId = ref<number | null>(null);

  /** 散布図の描画データ。未取得または誤差を計算したTaskが0件の場合はnull。 */
  const chart = computed(() => {
    const response = estimateAccuracy();
    return response === null ? null : buildEstimateAccuracyChart(response);
  });
  /** 一覧表の行。誤差の大きいTask順。 */
  const tasksByAbsoluteError = computed(() =>
    sortByAbsoluteErrorDescending(estimateAccuracy()?.tasks ?? [])
  );
  /** tooltipを表示する点。再集計で対象Taskが消えた場合はnullになる。 */
  const activePoint = computed<EstimateAccuracyChartPoint | null>(
    () => chart.value?.points.find((point) => point.task.taskId === activeTaskId.value) ?? null
  );

  /**
   * pointer hoverまたはkeyboard focusで、指定Taskの点のtooltipを表示する。
   *
   * @param taskId 点のTask ID
   */
  const showPoint = (taskId: number): void => {
    activeTaskId.value = taskId;
  };

  /**
   * 指定Taskの点からpointer・focusが外れたときにtooltipを閉じる。
   * 別の点へ移った直後のleaveで新しいtooltipを消さないよう、表示中の点と一致する場合だけ閉じる。
   *
   * @param taskId 点のTask ID
   */
  const hidePoint = (taskId: number): void => {
    if (activeTaskId.value === taskId) {
      activeTaskId.value = null;
    }
  };

  return {
    activePoint,
    chart,
    hidePoint,
    showPoint,
    tasksByAbsoluteError,
  };
};
