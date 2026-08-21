<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { Gantt, type GanttStatic } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

import type { WbsTreeRow } from "@/features/wbs/types/wbs";
import {
  addGanttRangePadding,
  buildWbsGanttData,
} from "@/features/wbs/utils/wbsGantt";

const props = defineProps<{
  /** 階層表と同じ並び・Task IDを持つGantt描画元。 */
  rows: readonly WbsTreeRow[];
}>();

const ganttContainer = ref<HTMLElement | null>(null);
const ganttInstance = shallowRef<GanttStatic | null>(null);
const ganttData = computed(() => buildWbsGanttData(props.rows));

/** 読取り専用MVPに必要なtree、日付scale、操作無効化だけをGanttへ設定する。 */
const configureGantt = (instance: GanttStatic): void => {
  instance.config.readonly = true;
  instance.config.date_format = "%Y-%m-%d";
  instance.config.row_height = 34;
  instance.config.scale_height = 56;
  instance.config.min_column_width = 42;
  instance.config.grid_width = 360;
  instance.config.columns = [
    {
      name: "text",
      label: "WBS / Task",
      tree: true,
      width: "*",
      resize: true,
    },
  ];
  instance.config.scales = [
    { unit: "month", step: 1, format: "%Y年 %m月" },
    { unit: "day", step: 1, format: "%d" },
  ];
  instance.config.show_progress = true;
  instance.config.show_links = false;
  instance.config.drag_move = false;
  instance.config.drag_progress = false;
  instance.config.drag_resize = false;
  instance.config.drag_links = false;
  instance.config.drag_project = false;
  instance.config.order_branch = false;
};

/** API再読込で予定期間が変わっても、全Taskを含むtimeline範囲へ更新する。 */
const updateGanttRange = (instance: GanttStatic): void => {
  const rangeStart = ganttData.value.rangeStart;
  const rangeEnd = ganttData.value.rangeEnd;
  instance.config.start_date =
    rangeStart === null ? undefined : addGanttRangePadding(rangeStart, -3);
  instance.config.end_date =
    rangeEnd === null ? undefined : addGanttRangePadding(rangeEnd, 7);
};

/** 最新のWBS行を既存Gantt instanceへ再投入し、Frontendだけの確定状態を残さない。 */
const renderGantt = async (): Promise<void> => {
  await nextTick();
  const container = ganttContainer.value;
  if (container === null) {
    return;
  }

  if (ganttInstance.value === null) {
    const instance = Gantt.getGanttInstance();
    configureGantt(instance);
    updateGanttRange(instance);
    instance.init(container);
    ganttInstance.value = instance;
  }

  updateGanttRange(ganttInstance.value);
  ganttInstance.value.clearAll();
  ganttInstance.value.parse({ data: ganttData.value.tasks, links: [] });
  ganttInstance.value.render();
};

onMounted(renderGantt);
watch(() => props.rows, renderGantt, { deep: true });
onBeforeUnmount(() => {
  ganttInstance.value?.destructor();
  ganttInstance.value = null;
});
</script>

<template>
  <div>
    <v-alert
      v-if="ganttData.unscheduledTaskIds.length"
      type="warning"
      variant="tonal"
      density="compact"
      class="ma-4"
    >
      予定日の不正なTask {{ ganttData.unscheduledTaskIds.length }}件は、
      左のtreeだけに表示しています。
    </v-alert>
    <div
      ref="ganttContainer"
      class="wbs-gantt"
      aria-label="WBSガントチャート"
    />
  </div>
</template>

<style scoped>
.wbs-gantt {
  width: 100%;
  min-width: 900px;
  height: min(68vh, 720px);
  min-height: 440px;
}

:deep(.gantt_task_line) {
  border-radius: 4px;
}

:deep(.gantt_task_progress) {
  opacity: 0.8;
}
</style>
