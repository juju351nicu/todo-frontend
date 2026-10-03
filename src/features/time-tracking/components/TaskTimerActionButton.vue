<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";

import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";

interface Props {
  /** Timer対象Project ID。 */
  projectId: number;
  /** Board・WBSと共通の通常Task ID。 */
  taskId: number;
  /** Backend認可の事前案内として操作を無効化する場合はtrue。 */
  disabled?: boolean;
  /** 一覧内で使用する省スペース表示の場合はtrue。 */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  compact: false,
});
const timerStore = useTaskTimerStore();
const { currentTimer, initialized, isLoading, pendingMutation } =
  storeToRefs(timerStore);

const isThisTaskRunning = computed(() =>
  timerStore.isTaskRunning(props.projectId, props.taskId)
);
const isAnotherTaskRunning = computed(
  () => currentTimer.value !== null && !isThisTaskRunning.value
);
const isDisabled = computed(
  () =>
    props.disabled ||
    !initialized.value ||
    isLoading.value ||
    pendingMutation.value !== null ||
    isAnotherTaskRunning.value
);

/** 一覧項目のclickへ伝播させず、対象TaskのTimerを開始する。 */
const startTimer = async (): Promise<void> => {
  await timerStore.startTimer(props.projectId, props.taskId);
};

/** 一覧項目のclickへ伝播させず、対象Taskで実行中の現在Timerを停止する。 */
const stopTimer = async (): Promise<void> => {
  await timerStore.stopCurrentTimer();
};
</script>

<template>
  <v-btn
    v-if="isThisTaskRunning"
    color="error"
    :icon="compact ? 'mdi-stop' : undefined"
    :prepend-icon="compact ? undefined : 'mdi-stop'"
    :size="compact ? 'small' : 'default'"
    :loading="pendingMutation === 'STOP'"
    :disabled="isDisabled"
    :aria-label="compact ? 'このTaskのTimerを停止' : undefined"
    @click.stop="stopTimer"
  >
    <span v-if="!compact">Timerを停止</span>
  </v-btn>
  <v-btn
    v-else
    color="primary"
    variant="tonal"
    :icon="compact ? 'mdi-play' : undefined"
    :prepend-icon="compact ? undefined : 'mdi-play'"
    :size="compact ? 'small' : 'default'"
    :loading="pendingMutation === 'START'"
    :disabled="isDisabled"
    :aria-label="
      compact
        ? isAnotherTaskRunning
          ? '別のTaskを計測中'
          : 'このTaskのTimerを開始'
        : undefined
    "
    :title="isAnotherTaskRunning ? `「${currentTimer?.taskTitle}」を計測中です` : undefined"
    @click.stop="startTimer"
  >
    <span v-if="!compact">
      {{ isAnotherTaskRunning ? "別Taskを計測中" : "Timerを開始" }}
    </span>
  </v-btn>
</template>
