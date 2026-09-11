<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import AttendanceCorrectionDialog from "@/features/attendance/components/AttendanceCorrectionDialog.vue";
import AttendancePunchPanel from "@/features/attendance/components/AttendancePunchPanel.vue";
import { useAttendancePage } from "@/features/attendance/composables/useAttendancePage";
import {
  formatAttendanceDate,
  formatAttendanceInstant,
  formatAttendanceMinutes,
  formatAttendanceTime,
  getAttendancePunchStateColor,
  getAttendancePunchStateLabel,
  getAttendanceMonthStatusColor,
  getAttendanceMonthStatusLabel,
} from "@/features/attendance/utils/attendance";
import {
  getAttendanceCorrectionStatusColor,
  getAttendanceCorrectionStatusLabel,
} from "@/features/attendance/utils/attendanceCorrection";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  addCorrectionBreakPeriod,
  addCorrectionWorkPeriod,
  cancelCorrectionRequest,
  cancellingCorrectionId,
  canRequestCorrection,
  canSubmitMonth,
  canClockIn,
  canClockOut,
  canEndBreak,
  canStartBreak,
  canWriteAttendance,
  changeMonth,
  closeCorrectionDialog,
  correctionForm,
  correctionRequests,
  currentUserDisplayName,
  errorMessages,
  executePunch,
  initialize,
  isLoading,
  isCorrectionDialogOpen,
  isPunching,
  isSubmittingMonth,
  isSubmittingCorrection,
  monthSummary,
  monthRows,
  openCorrectionDialog,
  removeCorrectionBreakPeriod,
  removeCorrectionWorkPeriod,
  selectWorkDate,
  selectedDay,
  selectedDaySummary,
  selectedMonth,
  selectedWorkDate,
  successMessage,
  submitCorrectionRequest,
  submitMonth,
  today,
  updateCorrectionBreakPeriod,
  updateCorrectionWorkPeriod,
} = useAttendancePage();

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="attendance-page pa-4 pa-md-6">
    <v-card class="mx-auto" max-width="1440">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-clock-outline" />
        本人勤怠
        <v-spacer />
        <v-text-field
          :model-value="selectedMonth"
          type="month"
          label="表示月"
          density="compact"
          hide-details
          max-width="210"
          :disabled="isLoading || isPunching"
          @update:model-value="changeMonth(String($event ?? ''))"
        />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4" closable>
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4" closable>
          {{ successMessage }}
        </v-alert>

        <AttendancePunchPanel
          v-if="selectedDay"
          :work-date="selectedWorkDate"
          :display-name="currentUserDisplayName"
          :punch-state="selectedDay.punchState"
          :can-clock-in="canClockIn"
          :can-clock-out="canClockOut"
          :can-start-break="canStartBreak"
          :can-end-break="canEndBreak"
          :can-write-attendance="canWriteAttendance"
          :is-punching="isPunching"
          :is-today="selectedWorkDate === today"
          @punch="executePunch"
        />

        <v-card v-if="monthSummary" variant="tonal" class="mb-4">
          <v-card-title class="d-flex align-center flex-wrap ga-3">
            月次申請
            <v-chip :color="getAttendanceMonthStatusColor(monthSummary.statusCode)" size="small">
              {{ getAttendanceMonthStatusLabel(monthSummary.statusCode) }}
            </v-chip>
            <v-spacer />
            <v-btn
              v-if="canSubmitMonth"
              color="primary"
              prepend-icon="mdi-send"
              :loading="isSubmittingMonth"
              @click="submitMonth"
            >
              {{ monthSummary.statusCode === "REJECTED" ? "再提出" : "提出" }}
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">総勤務</div>
                <strong>{{ formatAttendanceMinutes(monthSummary.grossWorkMinutes) }}</strong>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">休憩</div>
                <strong>{{ formatAttendanceMinutes(monthSummary.breakMinutes) }}</strong>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">差引勤務</div>
                <strong>{{ formatAttendanceMinutes(monthSummary.netWorkMinutes) }}</strong>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">最終提出</div>
                <strong>{{ formatAttendanceInstant(monthSummary.submittedAt) }}</strong>
              </v-col>
            </v-row>
            <v-alert
              v-if="monthSummary.hasIncompletePeriod"
              type="warning"
              density="compact"
              class="mt-3"
            >
              未終了の勤務・休憩区間があるため提出できません。
            </v-alert>
            <v-alert
              v-if="monthSummary.statusCode === 'REJECTED'"
              type="warning"
              density="compact"
              class="mt-3"
            >
              差戻し理由: {{ monthSummary.reviewComment || "理由は登録されていません。" }}
            </v-alert>
            <div v-if="monthSummary.statusCode === 'CLOSED'" class="text-body-2 mt-3">
              締め日時: {{ formatAttendanceInstant(monthSummary.closedAt) }}
            </div>
          </v-card-text>
        </v-card>

        <v-row>
          <v-col cols="12" lg="7">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1">月間一覧</v-card-title>
              <v-card-subtitle>
                未打刻日を含む月内全日を表示します。未終了区間は確定時間へ含めません。
              </v-card-subtitle>
              <v-card-text class="px-0">
                <div class="attendance-table-scroll">
                  <v-table density="compact" hover>
                    <thead>
                      <tr>
                        <th scope="col">勤務日</th>
                        <th scope="col">状態</th>
                        <th scope="col" class="text-end">勤務</th>
                        <th scope="col" class="text-end">休憩</th>
                        <th scope="col" class="text-end">差引</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in monthRows"
                        :key="row.workDate"
                        :class="{
                          'selected-attendance-row': row.workDate === selectedWorkDate,
                        }"
                        tabindex="0"
                        @click="selectWorkDate(row.workDate)"
                        @keydown.enter="selectWorkDate(row.workDate)"
                      >
                        <td>{{ formatAttendanceDate(row.workDate) }}</td>
                        <td>
                          <v-chip
                            v-if="row.hasRecord"
                            :color="getAttendancePunchStateColor(row.punchState)"
                            size="small"
                          >
                            {{ getAttendancePunchStateLabel(row.punchState) }}
                          </v-chip>
                          <span v-else class="text-medium-emphasis">未打刻</span>
                        </td>
                        <td class="text-end">
                          {{ row.hasRecord ? formatAttendanceMinutes(row.grossWorkMinutes) : "—" }}
                        </td>
                        <td class="text-end">
                          {{ row.hasRecord ? formatAttendanceMinutes(row.breakMinutes) : "—" }}
                        </td>
                        <td class="text-end">
                          <span v-if="row.hasRecord">
                            {{ formatAttendanceMinutes(row.netWorkMinutes) }}
                            <small v-if="row.incomplete" class="text-warning">集計中</small>
                          </span>
                          <span v-else>—</span>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="5">
            <v-card variant="outlined" class="attendance-detail-card">
              <v-card-title class="d-flex align-center flex-wrap ga-2">
                {{ formatAttendanceDate(selectedWorkDate) }}
                <v-chip
                  v-if="selectedDay"
                  :color="getAttendancePunchStateColor(selectedDay.punchState)"
                  size="small"
                >
                  {{ getAttendancePunchStateLabel(selectedDay.punchState) }}
                </v-chip>
                <v-spacer />
                <v-btn
                  v-if="canRequestCorrection"
                  color="primary"
                  size="small"
                  prepend-icon="mdi-file-edit-outline"
                  @click="openCorrectionDialog"
                >
                  修正申請
                </v-btn>
              </v-card-title>
              <v-card-subtitle>選択日の確定済み勤務・休憩区間を表示します。</v-card-subtitle>

              <v-card-text v-if="selectedDay">
                <v-row dense class="mb-2">
                  <v-col cols="4">
                    <div class="text-caption text-medium-emphasis">勤務</div>
                    <strong>{{ formatAttendanceMinutes(selectedDaySummary.grossWorkMinutes) }}</strong>
                  </v-col>
                  <v-col cols="4">
                    <div class="text-caption text-medium-emphasis">休憩</div>
                    <strong>{{ formatAttendanceMinutes(selectedDaySummary.breakMinutes) }}</strong>
                  </v-col>
                  <v-col cols="4">
                    <div class="text-caption text-medium-emphasis">差引</div>
                    <strong>{{ formatAttendanceMinutes(selectedDaySummary.netWorkMinutes) }}</strong>
                  </v-col>
                </v-row>

                <v-alert
                  v-if="selectedDaySummary.incomplete"
                  type="warning"
                  density="compact"
                  class="mb-4"
                >
                  未終了区間があるため、時間は確定分だけを表示しています。
                </v-alert>

                <div v-if="selectedDay.workPeriods.length" class="d-flex flex-column ga-3">
                  <v-card
                    v-for="(workPeriod, workIndex) in selectedDay.workPeriods"
                    :key="workPeriod.attendanceWorkPeriodId"
                    variant="tonal"
                  >
                    <v-card-title class="text-subtitle-2">
                      勤務区間 {{ workIndex + 1 }}
                    </v-card-title>
                    <v-card-text>
                      <div class="mb-2">
                        {{ formatAttendanceTime(workPeriod.startedAt) }}
                        〜 {{ formatAttendanceTime(workPeriod.endedAt) }}
                      </div>
                      <div
                        v-for="(breakPeriod, breakIndex) in workPeriod.breakPeriods"
                        :key="breakPeriod.attendanceBreakPeriodId"
                        class="text-body-2 text-medium-emphasis"
                      >
                        休憩 {{ breakIndex + 1 }}:
                        {{ formatAttendanceTime(breakPeriod.startedAt) }}
                        〜 {{ formatAttendanceTime(breakPeriod.endedAt) }}
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <v-sheet v-else rounded color="surface-variant" class="pa-4 text-center">
                  この日の打刻はありません。
                </v-sheet>

                <v-divider class="my-4" />
                <div class="text-subtitle-2 mb-2">
                  修正申請履歴（{{ correctionRequests.length }}件）
                </div>
                <v-alert
                  v-if="['APPROVED', 'CLOSED'].includes(monthSummary?.statusCode ?? '') && correctionRequests.some((request) => request.statusCode === 'PENDING')"
                  type="warning"
                  density="compact"
                  class="mb-3"
                >
                  この勤務日は審査待ちです。結果確定または取消後に再申請できます。
                </v-alert>
                <v-card
                  v-for="request in correctionRequests"
                  :key="request.attendanceCorrectionRequestId"
                  variant="outlined"
                  class="mb-2"
                >
                  <v-card-text>
                    <div class="d-flex align-center flex-wrap ga-2">
                      <v-chip :color="getAttendanceCorrectionStatusColor(request.statusCode)" size="small">
                        {{ getAttendanceCorrectionStatusLabel(request.statusCode) }}
                      </v-chip>
                      <span>{{ formatAttendanceInstant(request.requestedAt) }}</span>
                      <v-spacer />
                      <v-btn
                        v-if="request.statusCode === 'PENDING'"
                        color="error"
                        variant="text"
                        size="small"
                        :loading="cancellingCorrectionId === request.attendanceCorrectionRequestId"
                        @click="cancelCorrectionRequest(request)"
                      >
                        申請取消
                      </v-btn>
                    </div>
                    <div class="mt-2">理由: {{ request.reason }}</div>
                    <div class="text-caption text-medium-emphasis">
                      申請勤務区間: {{ request.workPeriods.length }}件 / version {{ request.version }}
                    </div>
                    <v-alert v-if="request.reviewComment" type="info" density="compact" class="mt-2">
                      審査コメント: {{ request.reviewComment }}
                    </v-alert>
                  </v-card-text>
                </v-card>
                <div v-if="correctionRequests.length === 0" class="text-medium-emphasis">
                  この勤務日の修正申請はありません。
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
  <AttendanceCorrectionDialog
    :model-value="isCorrectionDialogOpen"
    :form="correctionForm"
    :submitting="isSubmittingCorrection"
    :work-date="selectedWorkDate"
    @add-break="addCorrectionBreakPeriod"
    @add-work="addCorrectionWorkPeriod"
    @close="closeCorrectionDialog"
    @remove-break="removeCorrectionBreakPeriod"
    @remove-work="removeCorrectionWorkPeriod"
    @submit="submitCorrectionRequest"
    @update-break-ended-at="(workIndex, breakIndex, value) => updateCorrectionBreakPeriod(workIndex, breakIndex, 'endedAt', value)"
    @update-break-started-at="(workIndex, breakIndex, value) => updateCorrectionBreakPeriod(workIndex, breakIndex, 'startedAt', value)"
    @update-note="correctionForm.note = $event"
    @update-reason="correctionForm.reason = $event"
    @update-work-ended-at="(workIndex, value) => updateCorrectionWorkPeriod(workIndex, 'endedAt', value)"
    @update-work-started-at="(workIndex, value) => updateCorrectionWorkPeriod(workIndex, 'startedAt', value)"
  />
</template>

<style scoped>
.attendance-page {
  background: rgb(var(--v-theme-surface-variant));
  min-height: calc(100vh - 64px);
}

.attendance-table-scroll {
  max-height: 680px;
  overflow: auto;
}

.attendance-table-scroll tbody tr {
  cursor: pointer;
}

.selected-attendance-row {
  background: rgba(var(--v-theme-primary), 0.12);
}

.attendance-detail-card {
  position: sticky;
  top: 80px;
}

@media (max-width: 1279px) {
  .attendance-detail-card {
    position: static;
  }
}
</style>
