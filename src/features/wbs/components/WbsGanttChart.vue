<script setup lang="ts">
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";
import { ref } from "vue";

import { useWbsGanttChart } from "@/features/wbs/composables/useWbsGanttChart";
import type { TaskDependency, WbsTreeRow } from "@/features/wbs/types/wbs";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = defineProps<{
  /** 階層表と同じ並び・Task IDを持つGantt描画元。 */
  rows: readonly WbsTreeRow[];
  /** Project内Task間の依存線を描画するBackend依存関係。 */
  dependencies: readonly TaskDependency[];
}>();

const ganttContainer = ref<HTMLElement | null>(null);
const { ganttData } = useWbsGanttChart(
  ganttContainer,
  () => props.rows,
  () => props.dependencies,
);
</script>

<template>
  <div>
    <StatusAlert v-if="ganttData.unscheduledTaskIds.length" type="warning" variant="soft" density="compact" class="m-4 w-auto">
      予定日の不正なTask {{ ganttData.unscheduledTaskIds.length }}件は、 左のtreeだけに表示しています。
    </StatusAlert>
    <div ref="ganttContainer" class="h-[min(68vh,720px)] min-h-110 w-full min-w-225" aria-label="WBSガントチャート" />
  </div>
</template>

<style scoped>
/* dhtmlx-ganttが生成するDOMはTailwindのclassを付けられないため、scoped CSSで角丸と進捗の透明度を指定する。 */
:deep(.gantt_task_line) {
  border-radius: 4px;
}

:deep(.gantt_task_progress) {
  opacity: 0.8;
}
</style>
