<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import type {
  AttendancePunchAction,
  AttendancePunchState,
} from "@/features/attendance/types/attendance";
import {
  formatAttendanceClockTime,
  formatAttendanceDate,
  getAttendancePunchStateColor,
  getAttendancePunchStateLabel,
} from "@/features/attendance/utils/attendance";

/** 打刻パネルの表示状態。打刻可否の最終判定はBackendが担当する。 */
interface Props {
  workDate: string;
  displayName: string;
  punchState: AttendancePunchState;
  canClockIn: boolean;
  canClockOut: boolean;
  canStartBreak: boolean;
  canEndBreak: boolean;
  canWriteAttendance: boolean;
  isPunching: boolean;
  isToday: boolean;
}

/** 打刻パネルから本人勤怠画面へ通知する操作。 */
interface Emits {
  punch: [action: AttendancePunchAction];
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const currentTime = ref(formatAttendanceClockTime());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const currentTimeAriaLabel = computed(
  () => `現在の東京時刻 ${currentTime.value}`
);

/** 表示時計だけを毎秒更新する。打刻APIは独立してBackend時刻を確定する。 */
onMounted(() => {
  clockTimer = setInterval(() => {
    currentTime.value = formatAttendanceClockTime();
  }, 1_000);
});

/** 画面遷移後に不要なtimerを残さない。 */
onBeforeUnmount(() => {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
  }
});

/** 有効な打刻操作を親画面へ通知する。 */
const requestPunch = (action: AttendancePunchAction): void => {
  emit("punch", action);
};
</script>

<template>
  <v-card class="attendance-punch-panel mb-5" elevation="3">
    <div class="attendance-punch-accent" aria-hidden="true" />
    <v-card-text class="pa-5 pa-sm-7">
      <div class="d-flex align-center justify-center flex-wrap ga-2 mb-4">
        <v-icon icon="mdi-account-circle-outline" color="primary" />
        <span class="font-weight-medium">{{ displayName }}</span>
        <v-chip
          :color="getAttendancePunchStateColor(punchState)"
          size="small"
          variant="flat"
        >
          {{ getAttendancePunchStateLabel(punchState) }}
        </v-chip>
      </div>

      <div class="text-center">
        <p class="attendance-punch-date mb-1">
          {{ formatAttendanceDate(workDate) }}
        </p>
        <time
          class="attendance-punch-clock"
          :aria-label="currentTimeAriaLabel"
        >
          {{ currentTime }}
        </time>
        <p class="text-caption text-medium-emphasis mt-2 mb-0">
          現在時刻は表示用です。打刻時刻はサーバーで確定します。
        </p>
      </div>

      <div class="attendance-punch-actions mx-auto mt-6">
        <v-btn
          color="success"
          prepend-icon="mdi-login"
          size="large"
          :disabled="!canClockIn || isPunching"
          :loading="isPunching && canClockIn"
          :aria-label="`${formatAttendanceDate(workDate)}の出勤を打刻`"
          @click="requestPunch('clock-in')"
        >
          出勤
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-logout"
          size="large"
          :disabled="!canClockOut || isPunching"
          :loading="isPunching && canClockOut"
          :aria-label="`${formatAttendanceDate(workDate)}の退勤を打刻`"
          @click="requestPunch('clock-out')"
        >
          退勤
        </v-btn>
        <v-btn
          color="warning"
          prepend-icon="mdi-coffee-outline"
          size="large"
          :disabled="!canStartBreak || isPunching"
          :loading="isPunching && canStartBreak"
          :aria-label="`${formatAttendanceDate(workDate)}の休憩開始を打刻`"
          @click="requestPunch('break-start')"
        >
          休憩開始
        </v-btn>
        <v-btn
          color="info"
          prepend-icon="mdi-coffee-off-outline"
          size="large"
          :disabled="!canEndBreak || isPunching"
          :loading="isPunching && canEndBreak"
          :aria-label="`${formatAttendanceDate(workDate)}の休憩終了を打刻`"
          @click="requestPunch('break-end')"
        >
          休憩終了
        </v-btn>
      </div>

      <v-alert
        v-if="!canWriteAttendance"
        type="info"
        density="compact"
        variant="tonal"
        class="attendance-punch-notice mx-auto mt-5"
      >
        本人勤怠を更新するpermissionがないため参照のみです。
      </v-alert>
      <v-alert
        v-else-if="!isToday && punchState === 'OFF_DUTY'"
        type="info"
        density="compact"
        variant="tonal"
        class="attendance-punch-notice mx-auto mt-5"
      >
        出勤打刻は本日の詳細を選択した場合だけ実行できます。
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.attendance-punch-panel {
  border: 1px solid rgba(var(--v-theme-primary), 0.16);
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 5%, rgba(var(--v-theme-primary), 0.1), transparent 44%),
    rgb(var(--v-theme-surface));
}

.attendance-punch-accent {
  height: 6px;
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-primary)),
    rgb(var(--v-theme-info))
  );
}

.attendance-punch-date {
  color: rgba(var(--v-theme-on-surface), 0.78);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.attendance-punch-clock {
  display: block;
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(3.25rem, 10vw, 5.75rem);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: 0.035em;
  line-height: 1.1;
}

.attendance-punch-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  max-width: 560px;
}

.attendance-punch-actions :deep(.v-btn) {
  min-height: 54px;
}

.attendance-punch-notice {
  max-width: 640px;
}

@media (max-width: 599px) {
  .attendance-punch-clock {
    font-size: clamp(2.75rem, 16vw, 4.25rem);
    letter-spacing: 0.015em;
  }

  .attendance-punch-actions {
    gap: 10px;
  }

  .attendance-punch-actions :deep(.v-btn) {
    min-height: 50px;
    padding-inline: 8px;
  }
}
</style>
