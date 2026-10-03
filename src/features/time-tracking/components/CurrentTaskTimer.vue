<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useUserStore } from "@/features/auth/stores/user";
import TaskTimerHistoryDialog from "@/features/time-tracking/components/TaskTimerHistoryDialog.vue";
import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";
import {
  calculateDisplayedElapsedSeconds,
  formatElapsedSeconds,
} from "@/features/time-tracking/utils/timeTracking";

const userStore = useUserStore();
const timerStore = useTaskTimerStore();
const {
  currentTimer,
  errorMessages,
  isLoading,
  pendingMutation,
  receivedAtMilliseconds,
  successMessage,
} = storeToRefs(timerStore);
const cancelConfirmOpen = ref(false);
const nowMilliseconds = ref(Date.now());
let intervalId: ReturnType<typeof setInterval> | null = null;

const displayedElapsed = computed(() =>
  currentTimer.value === null
    ? "00:00:00"
    : formatElapsedSeconds(
        calculateDisplayedElapsedSeconds(
          currentTimer.value.elapsedSeconds,
          receivedAtMilliseconds.value,
          nowMilliseconds.value
        )
      )
);

/** 現在Timerを停止し、取消確認が開いていれば閉じる。 */
const stopTimer = async (): Promise<void> => {
  cancelConfirmOpen.value = false;
  await timerStore.stopCurrentTimer();
};

/** 確認済みの現在Timerを実績へ反映せず取消する。 */
const cancelTimer = async (): Promise<void> => {
  const canceled = await timerStore.cancelCurrentTimer();
  if (canceled) {
    cancelConfirmOpen.value = false;
  }
};

/** Snackbarを閉じる操作でStoreの一時メッセージを破棄する。 */
const handleMessageVisibility = (visible: boolean): void => {
  if (!visible) {
    timerStore.clearMessages();
  }
};

watch(
  () => userStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      void timerStore.initialize();
    } else {
      timerStore.resetForLogout();
    }
  },
  { immediate: true }
);

onMounted(() => {
  // 経過表示だけを1秒ごとに更新し、Backend pollingやTimerの自動停止は行わない。
  intervalId = setInterval(() => {
    nowMilliseconds.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});
</script>

<template>
  <div class="current-task-timer d-flex align-center ga-1">
    <v-progress-circular v-if="isLoading" indeterminate size="24" width="2" />
    <template v-else-if="currentTimer">
      <div class="timer-summary" :title="`${currentTimer.projectName} / ${currentTimer.taskTitle}`">
        <div class="timer-task text-caption text-truncate">
          {{ currentTimer.projectKey }} / {{ currentTimer.taskTitle }}
        </div>
        <div class="timer-elapsed font-weight-bold">{{ displayedElapsed }}</div>
      </div>
      <v-btn
        icon="mdi-stop"
        color="error"
        size="small"
        variant="flat"
        :loading="pendingMutation === 'STOP'"
        :disabled="pendingMutation !== null"
        aria-label="現在Timerを停止"
        title="停止して日別実績へ反映"
        @click="stopTimer"
      />
      <v-btn
        icon="mdi-close"
        size="small"
        variant="text"
        :disabled="pendingMutation !== null"
        aria-label="現在Timerを取消"
        title="実績へ反映せず取消"
        @click="cancelConfirmOpen = true"
      />
    </template>
    <TaskTimerHistoryDialog />
  </div>

  <v-dialog v-model="cancelConfirmOpen" max-width="520" :persistent="pendingMutation === 'CANCEL'">
    <v-card>
      <v-card-title>Timerを取消しますか？</v-card-title>
      <v-card-text>
        「{{ currentTimer?.taskTitle }}」の計測時間は日別実績へ反映されません。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="pendingMutation === 'CANCEL'" @click="cancelConfirmOpen = false">
          戻る
        </v-btn>
        <v-btn color="error" :loading="pendingMutation === 'CANCEL'" @click="cancelTimer">
          取消する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar
    :model-value="errorMessages.length > 0"
    color="error"
    timeout="8000"
    @update:model-value="handleMessageVisibility"
  >
    {{ errorMessages.join(" ") }}
  </v-snackbar>
  <v-snackbar
    :model-value="successMessage.length > 0"
    color="success"
    timeout="5000"
    @update:model-value="handleMessageVisibility"
  >
    {{ successMessage }}
  </v-snackbar>
</template>

<style scoped>
.current-task-timer {
  max-width: min(520px, 55vw);
}

.timer-summary {
  min-width: 140px;
  max-width: 320px;
  line-height: 1.15;
}

.timer-elapsed {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 600px) {
  .current-task-timer {
    max-width: calc(100vw - 112px);
  }

  .timer-summary {
    min-width: 76px;
    max-width: 120px;
  }

  .timer-task {
    display: none;
  }
}
</style>
