<script setup lang="ts">
import TaskTimerHistoryDialog from "@/features/time-tracking/components/TaskTimerHistoryDialog.vue";
import { useCurrentTaskTimer } from "@/features/time-tracking/composables/useCurrentTaskTimer";
import AppSnackbar from "@/shared/components/AppSnackbar.vue";

const {
  cancelTimer,
  currentTimer,
  displayedElapsed,
  errorMessages,
  handleMessageVisibility,
  isCancelConfirmOpen,
  isLoading,
  pendingMutation,
  restoreFocusAfterCancelDialog,
  stopTimer,
  successMessage,
} = useCurrentTaskTimer();
</script>

<template>
  <div class="flex max-w-[calc(100vw-112px)] items-center gap-1 sm:max-w-[min(520px,55vw)]">
    <UIcon v-if="isLoading" name="i-mdi-loading" class="size-6 animate-spin" />
    <template v-else-if="currentTimer">
      <div
        class="max-w-30 min-w-19 leading-[1.15] sm:max-w-80 sm:min-w-35"
        :title="`${currentTimer.projectName} / ${currentTimer.taskTitle}`"
      >
        <div class="hidden truncate text-xs sm:block">{{ currentTimer.projectKey }} / {{ currentTimer.taskTitle }}</div>
        <div class="font-bold tabular-nums">{{ displayedElapsed }}</div>
      </div>
      <UButton
        icon="i-mdi-stop"
        color="error"
        size="sm"
        square
        class="shadow-none"
        :loading="pendingMutation === 'STOP'"
        :disabled="pendingMutation !== null"
        aria-label="現在Timerを停止"
        title="停止して日別実績へ反映"
        @click="stopTimer"
      />
      <UButton
        icon="i-mdi-close"
        size="sm"
        variant="ghost"
        square
        class="text-white hover:bg-white/4"
        :disabled="pendingMutation !== null"
        aria-label="現在Timerを取消"
        title="実績へ反映せず取消"
        @click="isCancelConfirmOpen = true"
      />
    </template>
    <TaskTimerHistoryDialog />
  </div>

  <UModal
    v-model:open="isCancelConfirmOpen"
    :dismissible="pendingMutation !== 'CANCEL'"
    title="Timerを取消しますか？"
    :ui="{ content: 'max-w-130' }"
    @after:leave="restoreFocusAfterCancelDialog"
  >
    <template #body>「{{ currentTimer?.taskTitle }}」の計測時間は日別実績へ反映されません。</template>
    <template #footer>
      <UButton variant="ghost" :disabled="pendingMutation === 'CANCEL'" @click="isCancelConfirmOpen = false">戻る</UButton>
      <UButton color="error" variant="ghost" :loading="pendingMutation === 'CANCEL'" @click="cancelTimer">取消する</UButton>
    </template>
  </UModal>

  <AppSnackbar :open="errorMessages.length > 0" color="error" :timeout="8000" @update:open="handleMessageVisibility">
    {{ errorMessages.join(" ") }}
  </AppSnackbar>
  <AppSnackbar :open="successMessage.length > 0" color="success" :timeout="5000" @update:open="handleMessageVisibility">
    {{ successMessage }}
  </AppSnackbar>
</template>
