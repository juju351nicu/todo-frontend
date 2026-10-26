<script setup lang="ts">
import { onBeforeMount } from "vue";

import AttendanceCorrectionDialog from "@/features/attendance/components/AttendanceCorrectionDialog.vue";
import AttendancePunchPanel from "@/features/attendance/components/AttendancePunchPanel.vue";
import { useAttendancePage } from "@/features/attendance/composables/useAttendancePage";
import {
  formatAttendanceDate,
  formatAttendanceAllocationDifference,
  formatAttendanceInstant,
  formatAttendanceMinutes,
  formatAttendanceTime,
  getAttendanceAllocationStatusColor,
  getAttendanceAllocationStatusLabel,
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
import StatusAlert from "@/shared/components/StatusAlert.vue";

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
  hasPendingCorrectionInReviewedMonth,
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
  selectedDayAllocationAlertType,
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
  <LoadingIndicator v-if="isLoading" />
  <div class="page-surface p-4 md:p-6">
    <UCard class="mx-auto max-w-360">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-clock-outline" class="size-6" />
          本人勤怠
          <UFormField label="表示月" class="ms-auto w-52.5 pb-0 text-base font-normal tracking-normal">
            <UInput
              :model-value="selectedMonth"
              type="month"
              size="sm"
              :disabled="isLoading || isPunching"
              class="w-full"
              @update:model-value="changeMonth(String($event ?? ''))"
            />
          </UFormField>
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4" closable @close="errorMessages = []">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4" closable @close="successMessage = ''">
        {{ successMessage }}
      </StatusAlert>

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

      <UCard v-if="monthSummary" variant="soft" class="mb-4">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            月次申請
            <UBadge :color="getAttendanceMonthStatusColor(monthSummary.statusCode)" size="sm">
              {{ getAttendanceMonthStatusLabel(monthSummary.statusCode) }}
            </UBadge>
            <UButton
              v-if="canSubmitMonth"
              color="primary"
              icon="i-mdi-send"
              class="ms-auto"
              :loading="isSubmittingMonth"
              @click="submitMonth"
            >
              {{ monthSummary.statusCode === "REJECTED" ? "再提出" : "提出" }}
            </UButton>
          </div>
        </template>
        <div class="-m-1 flex flex-wrap">
          <div class="w-1/2 p-1 sm:w-1/4">
            <div class="text-xs text-muted">総勤務</div>
            <strong>{{ formatAttendanceMinutes(monthSummary.grossWorkMinutes) }}</strong>
          </div>
          <div class="w-1/2 p-1 sm:w-1/4">
            <div class="text-xs text-muted">休憩</div>
            <strong>{{ formatAttendanceMinutes(monthSummary.breakMinutes) }}</strong>
          </div>
          <div class="w-1/2 p-1 sm:w-1/4">
            <div class="text-xs text-muted">差引勤務</div>
            <strong>{{ formatAttendanceMinutes(monthSummary.netWorkMinutes) }}</strong>
          </div>
          <div class="w-1/2 p-1 sm:w-1/4">
            <div class="text-xs text-muted">最終提出</div>
            <strong>{{ formatAttendanceInstant(monthSummary.submittedAt) }}</strong>
          </div>
        </div>
        <StatusAlert v-if="monthSummary.hasIncompletePeriod" type="warning" density="compact" class="mt-3">
          未終了の勤務・休憩区間があるため提出できません。
        </StatusAlert>
        <StatusAlert v-if="monthSummary.statusCode === 'REJECTED'" type="warning" density="compact" class="mt-3">
          差戻し理由: {{ monthSummary.reviewComment || "理由は登録されていません。" }}
        </StatusAlert>
        <div v-if="monthSummary.statusCode === 'CLOSED'" class="mt-3 text-sm">
          締め日時: {{ formatAttendanceInstant(monthSummary.closedAt) }}
        </div>
      </UCard>

      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 lg:w-7/12">
          <UCard variant="outline" :ui="{ body: 'px-0 sm:px-0' }">
            <template #header>
              <div class="text-base font-normal">月間一覧</div>
              <div class="text-sm font-normal tracking-normal text-muted">
                未打刻日を含む月内全日を表示します。未終了区間は確定時間へ含めません。
              </div>
            </template>
            <div class="max-h-170 overflow-auto">
              <table class="app-table app-table-hover">
                <thead>
                  <tr>
                    <th scope="col">勤務日</th>
                    <th scope="col">状態</th>
                    <th scope="col" class="text-end!">勤務</th>
                    <th scope="col" class="text-end!">休憩</th>
                    <th scope="col" class="text-end!">差引</th>
                    <th scope="col" class="text-end!">Task実績</th>
                    <th scope="col">照合</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in monthRows"
                    :key="row.workDate"
                    class="cursor-pointer"
                    :class="{ 'bg-primary/12': row.workDate === selectedWorkDate }"
                    tabindex="0"
                    @click="selectWorkDate(row.workDate)"
                    @keydown.enter="selectWorkDate(row.workDate)"
                  >
                    <td>{{ formatAttendanceDate(row.workDate) }}</td>
                    <td>
                      <UBadge v-if="row.hasRecord" :color="getAttendancePunchStateColor(row.punchState)" size="sm">
                        {{ getAttendancePunchStateLabel(row.punchState) }}
                      </UBadge>
                      <span v-else class="text-muted">未打刻</span>
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
                    <td class="text-end">
                      {{ formatAttendanceMinutes(row.taskActualMinutes) }}
                    </td>
                    <td>
                      <UBadge :color="getAttendanceAllocationStatusColor(row.allocationStatus)" size="sm">
                        {{ getAttendanceAllocationStatusLabel(row.allocationStatus) }}
                      </UBadge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>

        <div class="w-full p-3 lg:w-5/12">
          <UCard variant="outline" class="static lg:sticky lg:top-20">
            <template #header>
              <div class="flex flex-wrap items-center gap-2">
                {{ formatAttendanceDate(selectedWorkDate) }}
                <UBadge v-if="selectedDay" :color="getAttendancePunchStateColor(selectedDay.punchState)" size="sm">
                  {{ getAttendancePunchStateLabel(selectedDay.punchState) }}
                </UBadge>
                <UButton
                  v-if="canRequestCorrection"
                  color="primary"
                  size="sm"
                  icon="i-mdi-file-edit-outline"
                  class="ms-auto"
                  @click="openCorrectionDialog"
                >
                  修正申請
                </UButton>
              </div>
              <div class="text-sm font-normal tracking-normal text-muted">選択日の確定済み勤務・休憩区間を表示します。</div>
            </template>

            <template v-if="selectedDay">
              <div class="-m-1 mb-1 flex flex-wrap">
                <div class="w-1/2 p-1 sm:w-1/4">
                  <div class="text-xs text-muted">勤務</div>
                  <strong>{{ formatAttendanceMinutes(selectedDaySummary.grossWorkMinutes) }}</strong>
                </div>
                <div class="w-1/2 p-1 sm:w-1/4">
                  <div class="text-xs text-muted">休憩</div>
                  <strong>{{ formatAttendanceMinutes(selectedDaySummary.breakMinutes) }}</strong>
                </div>
                <div class="w-1/2 p-1 sm:w-1/4">
                  <div class="text-xs text-muted">差引</div>
                  <strong>{{ formatAttendanceMinutes(selectedDaySummary.netWorkMinutes) }}</strong>
                </div>
                <div class="w-1/2 p-1 sm:w-1/4">
                  <div class="text-xs text-muted">Task実績</div>
                  <strong>{{ formatAttendanceMinutes(selectedDay.taskActualMinutes) }}</strong>
                </div>
              </div>

              <StatusAlert :type="selectedDayAllocationAlertType" variant="soft" density="compact" class="mb-4">
                <div class="flex flex-wrap items-center gap-2">
                  <strong>Task実績との照合</strong>
                  <UBadge :color="getAttendanceAllocationStatusColor(selectedDay.allocationStatus)" size="sm">
                    {{ getAttendanceAllocationStatusLabel(selectedDay.allocationStatus) }}
                  </UBadge>
                  <span>{{ formatAttendanceAllocationDifference(selectedDay.unallocatedMinutes) }}</span>
                </div>
              </StatusAlert>

              <StatusAlert v-if="selectedDaySummary.incomplete" type="warning" density="compact" class="mb-4">
                未終了区間があるため、時間は確定分だけを表示しています。
              </StatusAlert>

              <div v-if="selectedDay.workPeriods.length" class="flex flex-col gap-3">
                <UCard
                  v-for="(workPeriod, workIndex) in selectedDay.workPeriods"
                  :key="workPeriod.attendanceWorkPeriodId"
                  variant="soft"
                >
                  <template #header>
                    <div class="text-sm font-medium">勤務区間 {{ workIndex + 1 }}</div>
                  </template>
                  <div class="mb-2">
                    {{ formatAttendanceTime(workPeriod.startedAt) }}
                    〜 {{ formatAttendanceTime(workPeriod.endedAt) }}
                  </div>
                  <div
                    v-for="(breakPeriod, breakIndex) in workPeriod.breakPeriods"
                    :key="breakPeriod.attendanceBreakPeriodId"
                    class="text-sm text-muted"
                  >
                    休憩 {{ breakIndex + 1 }}:
                    {{ formatAttendanceTime(breakPeriod.startedAt) }}
                    〜 {{ formatAttendanceTime(breakPeriod.endedAt) }}
                  </div>
                </UCard>
              </div>
              <div v-else class="rounded-sm bg-muted p-4 text-center text-muted">
                この日の打刻はありません。
              </div>

              <USeparator class="my-4" />
              <div class="mb-2 text-sm font-medium">修正申請履歴（{{ correctionRequests.length }}件）</div>
              <StatusAlert v-if="hasPendingCorrectionInReviewedMonth" type="warning" density="compact" class="mb-3">
                この勤務日は審査待ちです。結果確定または取消後に再申請できます。
              </StatusAlert>
              <UCard
                v-for="request in correctionRequests"
                :key="request.attendanceCorrectionRequestId"
                variant="outline"
                class="mb-2"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge :color="getAttendanceCorrectionStatusColor(request.statusCode)" size="sm">
                    {{ getAttendanceCorrectionStatusLabel(request.statusCode) }}
                  </UBadge>
                  <span>{{ formatAttendanceInstant(request.requestedAt) }}</span>
                  <UButton
                    v-if="request.statusCode === 'PENDING'"
                    color="error"
                    variant="ghost"
                    size="sm"
                    class="ms-auto"
                    :loading="cancellingCorrectionId === request.attendanceCorrectionRequestId"
                    @click="cancelCorrectionRequest(request)"
                  >
                    申請取消
                  </UButton>
                </div>
                <div class="mt-2">理由: {{ request.reason }}</div>
                <div class="text-xs text-muted">
                  申請勤務区間: {{ request.workPeriods.length }}件 / version {{ request.version }}
                </div>
                <StatusAlert v-if="request.reviewComment" type="info" density="compact" class="mt-2">
                  審査コメント: {{ request.reviewComment }}
                </StatusAlert>
              </UCard>
              <div v-if="correctionRequests.length === 0" class="text-muted">この勤務日の修正申請はありません。</div>
            </template>
          </UCard>
        </div>
      </div>
    </UCard>
  </div>
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
