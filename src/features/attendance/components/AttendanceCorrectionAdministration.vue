<script setup lang="ts">
import type {
  AttendanceCorrectionResponse,
  AttendanceCorrectionStatus,
  AttendanceDayResponse,
} from "@/features/attendance/types/attendance";
import {
  formatAttendanceDate,
  formatAttendanceInstant,
  formatAttendanceTime,
} from "@/features/attendance/utils/attendance";
import {
  getAttendanceCorrectionStatusColor,
  getAttendanceCorrectionStatusLabel,
} from "@/features/attendance/utils/attendanceCorrection";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** 管理画面が取得した申請・現在勤怠と審査入力を参照専用Propsとして受け取る。 */
defineProps<{
  correctionRequests: AttendanceCorrectionResponse[];
  currentDay: AttendanceDayResponse | null;
  processingAction: string | null;
  rejectReason: string;
  reviewComment: string;
  selectedCorrection: AttendanceCorrectionResponse | null;
  selectedStatus: AttendanceCorrectionStatus;
  statusOptions: ReadonlyArray<{ title: string; value: AttendanceCorrectionStatus }>;
}>();

/** 検索・選択・審査と入力変更を親画面へ返し、Backend APIは直接呼ばない。 */
defineEmits<{
  approve: [];
  reject: [];
  search: [];
  select: [request: AttendanceCorrectionResponse];
  updateRejectReason: [value: string];
  updateReviewComment: [value: string];
  updateStatus: [value: AttendanceCorrectionStatus];
}>();
</script>

<template>
  <UCard variant="outline" class="mb-6">
    <template #header>
      <div>勤怠修正申請</div>
      <div class="text-sm font-normal tracking-normal text-muted">
        申請snapshotと現在勤怠を比較し、審査待ち申請を承認または却下します。
      </div>
    </template>
    <div class="-m-1 mb-2 flex flex-wrap items-center">
      <div class="w-full p-1 sm:w-5/12 md:w-1/4">
        <UFormField label="申請状態" class="pb-0">
          <USelect
            :model-value="selectedStatus"
            :items="[...statusOptions]"
            label-key="title"
            value-key="value"
            class="w-full"
            @update:model-value="$emit('updateStatus', $event as AttendanceCorrectionStatus)"
          />
        </UFormField>
      </div>
      <div class="w-full p-1 sm:w-1/3 md:w-1/4">
        <UButton color="primary" icon="i-mdi-magnify" @click="$emit('search')">申請を検索</UButton>
      </div>
    </div>

    <div class="-m-3 flex flex-wrap">
      <div class="w-full p-3 lg:w-5/12">
        <table class="app-table app-table-hover">
          <thead>
            <tr>
              <th>対象者・勤務日</th>
              <th>状態</th>
              <th>申請日時</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in correctionRequests"
              :key="request.attendanceCorrectionRequestId"
              class="cursor-pointer"
              :class="{
                'bg-primary/12': request.attendanceCorrectionRequestId === selectedCorrection?.attendanceCorrectionRequestId,
              }"
              role="button"
              tabindex="0"
              :aria-label="`${request.displayName || 'Account ' + request.accountId}の${formatAttendanceDate(request.workDate)}修正申請を表示`"
              aria-keyshortcuts="Enter Space"
              @click="$emit('select', request)"
              @keydown.enter="$emit('select', request)"
              @keydown.space.prevent="$emit('select', request)"
            >
              <td>
                <strong>{{ request.displayName || `Account ${request.accountId}` }}</strong>
                <div class="text-xs">{{ formatAttendanceDate(request.workDate) }}</div>
              </td>
              <td>
                <UBadge :color="getAttendanceCorrectionStatusColor(request.statusCode)" size="sm">
                  {{ getAttendanceCorrectionStatusLabel(request.statusCode) }}
                </UBadge>
              </td>
              <td>{{ formatAttendanceInstant(request.requestedAt) }}</td>
            </tr>
            <tr v-if="correctionRequests.length === 0">
              <td colspan="3" class="py-6 text-center text-muted">条件に一致する修正申請はありません。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="w-full p-3 lg:w-7/12">
        <div v-if="selectedCorrection" class="rounded-sm bg-[#424242] p-4 text-[#EEEEEE]">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <strong>{{ selectedCorrection.displayName || `Account ${selectedCorrection.accountId}` }}</strong>
            <span>{{ formatAttendanceDate(selectedCorrection.workDate) }}</span>
            <UBadge :color="getAttendanceCorrectionStatusColor(selectedCorrection.statusCode)" size="sm">
              {{ getAttendanceCorrectionStatusLabel(selectedCorrection.statusCode) }}
            </UBadge>
          </div>
          <StatusAlert type="info" density="compact" class="mb-3">修正理由: {{ selectedCorrection.reason }}</StatusAlert>
          <div class="-m-3 flex flex-wrap">
            <div class="w-full p-3 md:w-1/2">
              <div class="mb-2 text-sm font-medium">現在勤怠</div>
              <div v-if="currentDay?.workPeriods.length">
                <div v-for="(period, index) in currentDay.workPeriods" :key="period.attendanceWorkPeriodId" class="mb-2">
                  勤務 {{ index + 1 }}:
                  {{ formatAttendanceTime(period.startedAt) }}〜{{ formatAttendanceTime(period.endedAt) }}
                  <div
                    v-for="(breakPeriod, breakIndex) in period.breakPeriods"
                    :key="breakPeriod.attendanceBreakPeriodId"
                    class="text-xs"
                  >
                    休憩 {{ breakIndex + 1 }}:
                    {{ formatAttendanceTime(breakPeriod.startedAt) }}〜{{ formatAttendanceTime(breakPeriod.endedAt) }}
                  </div>
                </div>
              </div>
              <div v-else class="opacity-70">現在の打刻はありません。</div>
            </div>
            <div class="w-full p-3 md:w-1/2">
              <div class="mb-2 text-sm font-medium">申請snapshot</div>
              <div v-if="selectedCorrection.workPeriods.length">
                <div v-for="period in selectedCorrection.workPeriods" :key="period.attendanceCorrectionWorkPeriodId" class="mb-2">
                  勤務 {{ period.sequenceNo }}:
                  {{ formatAttendanceTime(period.startedAt) }}〜{{ formatAttendanceTime(period.endedAt) }}
                  <div
                    v-for="breakPeriod in period.breakPeriods"
                    :key="breakPeriod.attendanceCorrectionBreakPeriodId"
                    class="text-xs"
                  >
                    休憩 {{ breakPeriod.sequenceNo }}:
                    {{ formatAttendanceTime(breakPeriod.startedAt) }}〜{{ formatAttendanceTime(breakPeriod.endedAt) }}
                  </div>
                </div>
              </div>
              <div v-else class="opacity-70">勤務区間を空にする申請です。</div>
              <div class="mt-2 text-xs">承認後メモ: {{ selectedCorrection.proposedNote || "なし" }}</div>
            </div>
          </div>

          <template v-if="selectedCorrection.statusCode === 'PENDING'">
            <USeparator class="my-3" />
            <div class="relative">
              <UFormField label="承認コメント（任意）">
                <UTextarea
                  :model-value="reviewComment"
                  :maxlength="1000"
                  :rows="2"
                  class="w-full"
                  @update:model-value="$emit('updateReviewComment', String($event ?? ''))"
                />
              </UFormField>
              <FieldCounter :value="reviewComment" :max="1000" />
            </div>
            <UButton
              color="success"
              class="mb-3"
              :loading="processingAction === 'approve-correction'"
              :disabled="processingAction !== null"
              @click="$emit('approve')"
            >
              修正を承認
            </UButton>
            <div class="relative">
              <UFormField label="却下理由（必須）">
                <UTextarea
                  :model-value="rejectReason"
                  :maxlength="1000"
                  :rows="2"
                  class="w-full"
                  @update:model-value="$emit('updateRejectReason', String($event ?? ''))"
                />
              </UFormField>
              <FieldCounter :value="rejectReason" :max="1000" />
            </div>
            <UButton
              color="warning"
              :loading="processingAction === 'reject-correction'"
              :disabled="processingAction !== null"
              @click="$emit('reject')"
            >
              修正を却下
            </UButton>
          </template>
          <StatusAlert v-else-if="selectedCorrection.reviewComment" type="info" density="compact" class="mt-3">
            審査コメント: {{ selectedCorrection.reviewComment }}
          </StatusAlert>
        </div>
        <div v-else class="rounded-sm bg-[#424242] p-8 text-center text-[#EEEEEE]/70">
          左の一覧から確認する修正申請を選択してください。
        </div>
      </div>
    </div>
  </UCard>
</template>
