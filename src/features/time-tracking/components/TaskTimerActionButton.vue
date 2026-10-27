<script setup lang="ts">
import { useTaskTimerAction } from "@/features/time-tracking/composables/useTaskTimerAction";

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

const { actionKey, currentTimer, isAnotherTaskRunning, isDisabled, isThisTaskRunning, pendingMutation, startTimer, stopTimer } =
  useTaskTimerAction({
    projectId: () => props.projectId,
    taskId: () => props.taskId,
    disabled: () => props.disabled,
  });
</script>

<template>
  <!-- 一覧項目のclickへ伝播させないよう、どちらのbuttonもclickを止める。 -->
  <UButton
    v-if="isThisTaskRunning"
    color="error"
    icon="i-mdi-stop"
    :square="compact"
    :size="compact ? 'sm' : 'md'"
    :loading="pendingMutation === 'STOP'"
    :disabled="isDisabled"
    :aria-label="compact ? 'このTaskのTimerを停止' : undefined"
    :data-task-timer-action="actionKey"
    @click.stop="stopTimer"
  >
    <span v-if="!compact">Timerを停止</span>
  </UButton>
  <UButton
    v-else
    color="primary"
    variant="soft"
    icon="i-mdi-play"
    :square="compact"
    :size="compact ? 'sm' : 'md'"
    :loading="pendingMutation === 'START'"
    :disabled="isDisabled"
    :aria-label="compact ? (isAnotherTaskRunning ? '別のTaskを計測中' : 'このTaskのTimerを開始') : undefined"
    :title="isAnotherTaskRunning ? `「${currentTimer?.taskTitle}」を計測中です` : undefined"
    :data-task-timer-action="actionKey"
    @click.stop="startTimer"
  >
    <span v-if="!compact">{{ isAnotherTaskRunning ? "別Taskを計測中" : "Timerを開始" }}</span>
  </UButton>
</template>
