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

import type {
  TaskDependency,
  WbsTreeRow,
} from "@/features/wbs/types/wbs";
import {
  addGanttRangePadding,
  buildWbsGanttData,
  buildWbsGanttLinks,
  configureWbsGantt,
} from "@/features/wbs/utils/wbsGantt";

const props = defineProps<{
  /** 階層表と同じ並び・Task IDを持つGantt描画元。 */
  rows: readonly WbsTreeRow[];
  /** Project内Task間の依存線を描画するBackend依存関係。 */
  dependencies: readonly TaskDependency[];
}>();

const ganttContainer = ref<HTMLElement | null>(null);
const ganttInstance = shallowRef<GanttStatic | null>(null);
const ganttData = computed(() => buildWbsGanttData(props.rows));
const ganttLinks = computed(() =>
  buildWbsGanttLinks(props.rows, props.dependencies)
);

/** API再読込で予定期間が変わっても、全Taskを含むtimeline範囲へ更新する。 */
const updateGanttRange = (instance: GanttStatic): void => {
  const rangeStart = ganttData.value.rangeStart;
  const rangeEnd = ganttData.value.rangeEnd;
  instance.config.start_date =
    rangeStart === null ? undefined : addGanttRangePadding(rangeStart, -3);
  instance.config.end_date =
    rangeEnd === null ? undefined : addGanttRangePadding(rangeEnd, 7);
};

/** 最新のWBS行と依存関係を既存Gantt instanceへ再投入し、Frontendだけの確定状態を残さない。 */
const renderGantt = async (): Promise<void> => {
  await nextTick();
  const container = ganttContainer.value;
  if (container === null) {
    return;
  }

  if (ganttInstance.value === null) {
    const instance = Gantt.getGanttInstance();
    configureWbsGantt(instance);
    updateGanttRange(instance);
    instance.init(container);
    ganttInstance.value = instance;
  }

  updateGanttRange(ganttInstance.value);
  ganttInstance.value.clearAll();
  ganttInstance.value.parse({
    data: ganttData.value.tasks,
    links: ganttLinks.value,
  });
  ganttInstance.value.render();
};

onMounted(renderGantt);
watch([() => props.rows, () => props.dependencies], renderGantt, {
  deep: true,
});
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
