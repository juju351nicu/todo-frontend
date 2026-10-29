import { Gantt, type GanttStatic } from "dhtmlx-gantt";
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import type { Ref } from "vue";

import type { TaskDependency, WbsTreeRow } from "@/features/wbs/types/wbs";
import {
  addGanttRangePadding,
  buildWbsGanttData,
  buildWbsGanttLinks,
  configureWbsGantt,
} from "@/features/wbs/utils/wbsGantt";

/** timelineの前後に設ける余白日数。開始前3日・終了後7日まで表示する。 */
const RANGE_PADDING_BEFORE_DAYS = -3;
const RANGE_PADDING_AFTER_DAYS = 7;

/**
 * WBS Ganttのdhtmlx-gantt instanceを管理する。
 *
 * - mount時にinstanceを作成し、WBS行・依存関係が変わるたびに全データを再投入する（Gantt上の状態を正本にしない）。
 * - unmount時に`destructor`でinstanceを破棄し、画面遷移後にlibraryのDOM・eventを残さない。
 * - Componentの`setup`内から呼び出すこと。
 *
 * @param container Ganttを描画する要素。mount前・非表示時はnull
 * @param rows 階層表と同じ並び・Task IDを持つ描画元
 * @param dependencies Project内Task間の依存関係
 */
export const useWbsGanttChart = (
  container: Readonly<Ref<HTMLElement | null>>,
  rows: () => readonly WbsTreeRow[],
  dependencies: () => readonly TaskDependency[]
) => {
  const ganttInstance = shallowRef<GanttStatic | null>(null);
  const ganttData = computed(() => buildWbsGanttData(rows()));
  const ganttLinks = computed(() => buildWbsGanttLinks(rows(), dependencies()));

  /** API再読込で予定期間が変わっても、全Taskを含むtimeline範囲へ更新する。 */
  const updateGanttRange = (instance: GanttStatic): void => {
    const { rangeStart, rangeEnd } = ganttData.value;
    instance.config.start_date =
      rangeStart === null ? undefined : addGanttRangePadding(rangeStart, RANGE_PADDING_BEFORE_DAYS);
    instance.config.end_date =
      rangeEnd === null ? undefined : addGanttRangePadding(rangeEnd, RANGE_PADDING_AFTER_DAYS);
  };

  /** 最新のWBS行と依存関係を既存Gantt instanceへ再投入する。初回はinstanceを作成して初期化する。 */
  const renderGantt = async (): Promise<void> => {
    // 描画先要素はDOM更新後に確定するため、次のtickまで待つ。
    await nextTick();
    const element = container.value;
    if (element === null) {
      return;
    }

    if (ganttInstance.value === null) {
      const instance = Gantt.getGanttInstance();
      configureWbsGantt(instance);
      updateGanttRange(instance);
      instance.init(element);
      ganttInstance.value = instance;
    }

    updateGanttRange(ganttInstance.value);
    ganttInstance.value.clearAll();
    ganttInstance.value.parse({ data: ganttData.value.tasks, links: ganttLinks.value });
    ganttInstance.value.render();
  };

  onMounted(renderGantt);
  watch([rows, dependencies], renderGantt, { deep: true });
  onBeforeUnmount(() => {
    ganttInstance.value?.destructor();
    ganttInstance.value = null;
  });

  return {
    /** Gantt描画用に変換したTaskと、予定日不正でtimelineへ描画できないTask ID。 */
    ganttData,
    renderGantt,
  };
};
