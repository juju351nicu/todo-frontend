<script setup lang="ts">
import { useAttendanceClock } from "@/features/attendance/composables/useAttendanceClock";
import type {
  AttendancePunchAction,
  AttendancePunchState,
} from "@/features/attendance/types/attendance";
import {
  formatAttendanceDate,
  getAttendancePunchStateColor,
  getAttendancePunchStateLabel,
} from "@/features/attendance/utils/attendance";
import StatusAlert from "@/shared/components/StatusAlert.vue";

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

const { currentTime, currentTimeAriaLabel } = useAttendanceClock();
</script>

<template>
  <div
    class="mb-5 overflow-hidden rounded-[18px] border border-primary/16 shadow-elevation-3 bg-[radial-gradient(circle_at_50%_5%,color-mix(in_oklab,var(--ui-primary)_10%,transparent),transparent_44%)] bg-default"
  >
    <div class="h-1.5 bg-linear-to-r from-primary to-info" aria-hidden="true" />
    <div class="p-5 sm:p-7">
      <div class="mb-4 flex flex-wrap items-center justify-center gap-2">
        <UIcon name="i-mdi-account-circle-outline" class="size-6 text-primary" />
        <span class="font-medium">{{ displayName }}</span>
        <UBadge :color="getAttendancePunchStateColor(punchState)" variant="solid" size="sm">
          {{ getAttendancePunchStateLabel(punchState) }}
        </UBadge>
      </div>

      <div class="text-center">
        <p class="mb-1 text-[1.05rem] font-semibold tracking-[0.04em] text-toned">
          {{ formatAttendanceDate(workDate) }}
        </p>
        <time
          class="block text-[clamp(2.75rem,16vw,4.25rem)] leading-[1.1] font-medium tracking-[0.015em] tabular-nums sm:text-[clamp(3.25rem,10vw,5.75rem)] sm:tracking-[0.035em]"
          :aria-label="currentTimeAriaLabel"
        >
          {{ currentTime }}
        </time>
        <p class="mt-2 mb-0 text-xs text-muted">
          現在時刻は表示用です。打刻時刻はサーバーで確定します。
        </p>
      </div>

      <div class="mx-auto mt-6 grid max-w-140 grid-cols-2 gap-2.5 sm:gap-3">
        <UButton
          color="success"
          icon="i-mdi-login"
          size="lg"
          class="min-h-12.5 px-2 sm:min-h-13.5 sm:px-5"
          :disabled="!canClockIn || isPunching"
          :loading="isPunching && canClockIn"
          :aria-label="`${formatAttendanceDate(workDate)}の出勤を打刻`"
          data-attendance-punch="clock-in"
          @click="emit('punch', 'clock-in')"
        >
          出勤
        </UButton>
        <UButton
          color="primary"
          icon="i-mdi-logout"
          size="lg"
          class="min-h-12.5 px-2 sm:min-h-13.5 sm:px-5"
          :disabled="!canClockOut || isPunching"
          :loading="isPunching && canClockOut"
          :aria-label="`${formatAttendanceDate(workDate)}の退勤を打刻`"
          data-attendance-punch="clock-out"
          @click="emit('punch', 'clock-out')"
        >
          退勤
        </UButton>
        <UButton
          color="warning"
          icon="i-mdi-coffee-outline"
          size="lg"
          class="min-h-12.5 px-2 sm:min-h-13.5 sm:px-5"
          :disabled="!canStartBreak || isPunching"
          :loading="isPunching && canStartBreak"
          :aria-label="`${formatAttendanceDate(workDate)}の休憩開始を打刻`"
          data-attendance-punch="break-start"
          @click="emit('punch', 'break-start')"
        >
          休憩開始
        </UButton>
        <UButton
          color="info"
          icon="i-mdi-coffee-off-outline"
          size="lg"
          class="min-h-12.5 px-2 sm:min-h-13.5 sm:px-5"
          :disabled="!canEndBreak || isPunching"
          :loading="isPunching && canEndBreak"
          :aria-label="`${formatAttendanceDate(workDate)}の休憩終了を打刻`"
          data-attendance-punch="break-end"
          @click="emit('punch', 'break-end')"
        >
          休憩終了
        </UButton>
      </div>

      <StatusAlert
        v-if="!canWriteAttendance"
        type="info"
        density="compact"
        variant="soft"
        class="mx-auto mt-5 max-w-160"
      >
        本人勤怠を更新するpermissionがないため参照のみです。
      </StatusAlert>
      <StatusAlert
        v-else-if="!isToday && punchState === 'OFF_DUTY'"
        type="info"
        density="compact"
        variant="soft"
        class="mx-auto mt-5 max-w-160"
      >
        出勤打刻は本日の詳細を選択した場合だけ実行できます。
      </StatusAlert>
    </div>
  </div>
</template>
