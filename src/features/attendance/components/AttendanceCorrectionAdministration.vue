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
  <v-card variant="outlined" class="mb-6">
    <v-card-title>勤怠修正申請</v-card-title>
    <v-card-subtitle>
      申請snapshotと現在勤怠を比較し、審査待ち申請を承認または却下します。
    </v-card-subtitle>
    <v-card-text>
      <v-row align="center" dense class="mb-3">
        <v-col cols="12" sm="5" md="3">
          <v-select
            :model-value="selectedStatus"
            :items="statusOptions"
            label="申請状態"
            hide-details
            @update:model-value="$emit('updateStatus', $event as AttendanceCorrectionStatus)"
          />
        </v-col>
        <v-col cols="12" sm="4" md="3">
          <v-btn color="primary" prepend-icon="mdi-magnify" @click="$emit('search')">
            申請を検索
          </v-btn>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" lg="5">
          <v-table density="compact" hover>
            <thead>
              <tr><th>対象者・勤務日</th><th>状態</th><th>申請日時</th></tr>
            </thead>
            <tbody>
              <tr
                v-for="request in correctionRequests"
                :key="request.attendanceCorrectionRequestId"
                class="correction-request-row"
                :class="{
                  'selected-correction-row':
                    request.attendanceCorrectionRequestId ===
                    selectedCorrection?.attendanceCorrectionRequestId,
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
                  <div class="text-caption">{{ formatAttendanceDate(request.workDate) }}</div>
                </td>
                <td>
                  <v-chip :color="getAttendanceCorrectionStatusColor(request.statusCode)" size="small">
                    {{ getAttendanceCorrectionStatusLabel(request.statusCode) }}
                  </v-chip>
                </td>
                <td>{{ formatAttendanceInstant(request.requestedAt) }}</td>
              </tr>
              <tr v-if="correctionRequests.length === 0">
                <td colspan="3" class="text-center text-medium-emphasis py-6">
                  条件に一致する修正申請はありません。
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-col>

        <v-col cols="12" lg="7">
          <v-sheet v-if="selectedCorrection" rounded color="surface-variant" class="pa-4">
            <div class="d-flex align-center flex-wrap ga-2 mb-3">
              <strong>{{ selectedCorrection.displayName || `Account ${selectedCorrection.accountId}` }}</strong>
              <span>{{ formatAttendanceDate(selectedCorrection.workDate) }}</span>
              <v-chip :color="getAttendanceCorrectionStatusColor(selectedCorrection.statusCode)" size="small">
                {{ getAttendanceCorrectionStatusLabel(selectedCorrection.statusCode) }}
              </v-chip>
            </div>
            <v-alert type="info" density="compact" class="mb-3">
              修正理由: {{ selectedCorrection.reason }}
            </v-alert>
            <v-row>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">現在勤怠</div>
                <div v-if="currentDay?.workPeriods.length">
                  <div v-for="(period, index) in currentDay.workPeriods" :key="period.attendanceWorkPeriodId" class="mb-2">
                    勤務 {{ index + 1 }}:
                    {{ formatAttendanceTime(period.startedAt) }}〜{{ formatAttendanceTime(period.endedAt) }}
                    <div v-for="(breakPeriod, breakIndex) in period.breakPeriods" :key="breakPeriod.attendanceBreakPeriodId" class="text-caption">
                      休憩 {{ breakIndex + 1 }}:
                      {{ formatAttendanceTime(breakPeriod.startedAt) }}〜{{ formatAttendanceTime(breakPeriod.endedAt) }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-medium-emphasis">現在の打刻はありません。</div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">申請snapshot</div>
                <div v-if="selectedCorrection.workPeriods.length">
                  <div v-for="period in selectedCorrection.workPeriods" :key="period.attendanceCorrectionWorkPeriodId" class="mb-2">
                    勤務 {{ period.sequenceNo }}:
                    {{ formatAttendanceTime(period.startedAt) }}〜{{ formatAttendanceTime(period.endedAt) }}
                    <div v-for="breakPeriod in period.breakPeriods" :key="breakPeriod.attendanceCorrectionBreakPeriodId" class="text-caption">
                      休憩 {{ breakPeriod.sequenceNo }}:
                      {{ formatAttendanceTime(breakPeriod.startedAt) }}〜{{ formatAttendanceTime(breakPeriod.endedAt) }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-medium-emphasis">勤務区間を空にする申請です。</div>
                <div class="text-caption mt-2">承認後メモ: {{ selectedCorrection.proposedNote || "なし" }}</div>
              </v-col>
            </v-row>

            <template v-if="selectedCorrection.statusCode === 'PENDING'">
              <v-divider class="my-3" />
              <v-textarea
                :model-value="reviewComment"
                label="承認コメント（任意）"
                maxlength="1000"
                rows="2"
                counter
                @update:model-value="$emit('updateReviewComment', String($event ?? ''))"
              />
              <v-btn
                color="success"
                class="mb-3"
                :loading="processingAction === 'approve-correction'"
                :disabled="processingAction !== null"
                @click="$emit('approve')"
              >
                修正を承認
              </v-btn>
              <v-textarea
                :model-value="rejectReason"
                label="却下理由（必須）"
                maxlength="1000"
                rows="2"
                counter
                @update:model-value="$emit('updateRejectReason', String($event ?? ''))"
              />
              <v-btn
                color="warning"
                :loading="processingAction === 'reject-correction'"
                :disabled="processingAction !== null"
                @click="$emit('reject')"
              >
                修正を却下
              </v-btn>
            </template>
            <v-alert v-else-if="selectedCorrection.reviewComment" type="info" density="compact" class="mt-3">
              審査コメント: {{ selectedCorrection.reviewComment }}
            </v-alert>
          </v-sheet>
          <v-sheet v-else rounded color="surface-variant" class="pa-8 text-center text-medium-emphasis">
            左の一覧から確認する修正申請を選択してください。
          </v-sheet>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.correction-request-row {
  cursor: pointer;
}

.selected-correction-row {
  background: rgba(var(--v-theme-primary), 0.12);
}
</style>
