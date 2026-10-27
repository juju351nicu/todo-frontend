<script setup lang="ts">
import { onBeforeMount } from "vue";

import AttendanceCorrectionAdministration from "@/features/attendance/components/AttendanceCorrectionAdministration.vue";
import {
  ATTENDANCE_ADMIN_CONTROL,
  attendanceMonthRowControlKey,
  useAttendanceAdministrationPage,
} from "@/features/attendance/composables/useAttendanceAdministrationPage";
import {
  formatAttendanceDate,
  formatAttendanceInstant,
  formatAttendanceMinutes,
  getAttendanceMonthStatusColor,
  getAttendanceMonthStatusLabel,
  getAttendancePunchStateLabel,
} from "@/features/attendance/utils/attendance";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  approve,
  approveCorrectionRequest,
  canApproveOrReject,
  canCloseMonth,
  canExport,
  canReview,
  close,
  correctionRejectReason,
  correctionRejectReasonError,
  correctionRequests,
  correctionReviewComment,
  correctionStatusOptions,
  errorMessages,
  downloadMonthlyCsv,
  initialize,
  isExportingMonthlyCsv,
  isLoading,
  monthRejectReasonError,
  months,
  processingAction,
  reject,
  rejectCorrectionRequest,
  rejectReason,
  reviewComment,
  search,
  searchCorrectionRequests,
  selectCorrectionRequest,
  selectMonth,
  selectedAccountId,
  selectedCorrection,
  selectedCorrectionCurrentDay,
  selectedCorrectionStatus,
  selectedDetail,
  selectedListItem,
  selectedMonth,
  selectedStatus,
  statusOptions,
  successMessage,
} = useAttendanceAdministrationPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="page-surface p-4 md:p-6">
    <UCard class="mx-auto max-w-375">
      <template #header>
        <h2 class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-calendar-account-outline" class="size-6" />
          勤怠月次確認
        </h2>
      </template>

      <div class="-m-1 mb-2 flex flex-wrap items-end">
        <div class="w-full p-1 sm:w-1/3 md:w-1/4">
          <UFormField label="対象月" class="pb-0">
            <UInput v-model="selectedMonth" type="month" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-1 sm:w-1/3 md:w-1/4">
          <UFormField label="状態" class="pb-0">
            <USelect v-model="selectedStatus" :items="[...statusOptions]" label-key="title" value-key="value" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-1 sm:w-1/3 md:w-1/4">
          <UButton
            color="primary"
            icon="i-mdi-magnify"
            :disabled="isLoading"
            :data-attendance-admin-control="ATTENDANCE_ADMIN_CONTROL.search"
            @click="search"
          >
            検索
          </UButton>
        </div>
        <div v-if="canExport" class="w-full p-1 sm:w-1/3 md:w-1/4">
          <UButton
            color="success"
            icon="i-mdi-file-delimited-outline"
            variant="soft"
            :disabled="isLoading"
            :loading="isExportingMonthlyCsv"
            :data-attendance-admin-control="ATTENDANCE_ADMIN_CONTROL.export"
            @click="downloadMonthlyCsv"
          >
            月次CSV
          </UButton>
        </div>
      </div>

      <p v-if="canExport" class="mb-4 text-xs text-muted">
        選択月の全アカウント・月内全日を出力します。Task実績への配賦状況を含み、メールアドレスや認証情報は含みません。
      </p>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </StatusAlert>

      <AttendanceCorrectionAdministration
        v-if="canReview"
        :correction-requests="correctionRequests"
        :current-day="selectedCorrectionCurrentDay"
        :processing-action="processingAction"
        :reject-reason="correctionRejectReason"
        :reject-reason-error="correctionRejectReasonError"
        :review-comment="correctionReviewComment"
        :selected-correction="selectedCorrection"
        :selected-status="selectedCorrectionStatus"
        :status-options="correctionStatusOptions"
        @approve="approveCorrectionRequest"
        @reject="rejectCorrectionRequest"
        @search="searchCorrectionRequests"
        @select="selectCorrectionRequest"
        @update-reject-reason="correctionRejectReason = $event"
        @update-review-comment="correctionReviewComment = $event"
        @update-status="selectedCorrectionStatus = $event"
      />

      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 lg:w-1/2">
          <UCard variant="outline" :ui="{ body: 'px-0 sm:px-0' }">
            <template #header>
              <div class="text-base font-normal">確認対象（{{ months.length }}件）</div>
              <div class="text-sm font-normal tracking-normal text-muted">
                提出履歴があり、月次rowが作成済みのaccountだけを表示します。
              </div>
            </template>
            <div class="max-h-170 overflow-auto">
              <table class="app-table app-table-hover">
                <thead>
                  <tr>
                    <th scope="col">利用者</th>
                    <th scope="col">状態</th>
                    <th scope="col">提出日時</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="month in months"
                    :key="month.attendanceMonthId"
                    class="cursor-pointer"
                    :class="{ 'bg-primary/12': month.accountId === selectedAccountId }"
                    role="button"
                    tabindex="0"
                    :aria-label="`${month.displayName}の${month.yearMonth}勤怠を表示`"
                    :data-attendance-admin-control="attendanceMonthRowControlKey(month.accountId)"
                    @click="selectMonth(month)"
                    @keydown.enter="selectMonth(month)"
                    @keydown.space.prevent="selectMonth(month)"
                  >
                    <td>
                      <strong>{{ month.displayName }}</strong>
                      <div class="text-xs text-muted">{{ month.loginId || "OAuth account" }} / ID: {{ month.accountId }}</div>
                    </td>
                    <td>
                      <UBadge :color="getAttendanceMonthStatusColor(month.statusCode)" size="sm">
                        {{ getAttendanceMonthStatusLabel(month.statusCode) }}
                      </UBadge>
                    </td>
                    <td>{{ formatAttendanceInstant(month.submittedAt) }}</td>
                  </tr>
                  <tr v-if="months.length === 0">
                    <td colspan="3" class="py-6 text-center text-muted">条件に一致する勤怠月はありません。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>

        <div class="w-full p-3 lg:w-1/2">
          <UCard variant="outline" class="attendance-administration-detail static lg:sticky lg:top-20">
            <template v-if="selectedDetail" #header>
              <div class="flex flex-wrap items-center gap-2">
                {{ selectedListItem?.displayName || `Account ID: ${selectedDetail.accountId}` }}
                <UBadge :color="getAttendanceMonthStatusColor(selectedDetail.statusCode)" size="sm">
                  {{ getAttendanceMonthStatusLabel(selectedDetail.statusCode) }}
                </UBadge>
              </div>
              <div class="text-sm font-normal tracking-normal text-muted">
                {{ selectedDetail.yearMonth }} / version {{ selectedDetail.version }}
              </div>
            </template>
            <template v-if="selectedDetail">
              <div class="-m-1 mb-2 flex">
                <div class="w-1/3 p-1">
                  <span class="text-xs">総勤務</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.grossWorkMinutes) }}</strong>
                </div>
                <div class="w-1/3 p-1">
                  <span class="text-xs">休憩</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.breakMinutes) }}</strong>
                </div>
                <div class="w-1/3 p-1">
                  <span class="text-xs">差引勤務</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.netWorkMinutes) }}</strong>
                </div>
              </div>
              <StatusAlert v-if="selectedDetail.hasIncompletePeriod" type="warning" density="compact" class="mb-3">
                未終了の勤務・休憩区間があります。
              </StatusAlert>
              <StatusAlert v-if="selectedDetail.reviewComment" type="info" density="compact" class="mb-3">
                審査コメント: {{ selectedDetail.reviewComment }}
              </StatusAlert>

              <template v-if="canApproveOrReject">
                <div class="relative">
                  <UFormField label="承認コメント（任意）">
                    <UTextarea v-model="reviewComment" :maxlength="1000" :rows="2" class="w-full" />
                  </UFormField>
                  <FieldCounter :value="reviewComment" :max="1000" />
                </div>
                <UButton
                  color="success"
                  class="mb-4"
                  :loading="processingAction === 'approve'"
                  data-attendance-admin-control="approve"
                  @click="approve"
                >
                  承認
                </UButton>
                <div class="relative">
                  <UFormField label="差戻し理由（必須）" :error="monthRejectReasonError || undefined">
                    <UTextarea
                      v-model="rejectReason"
                      :maxlength="1000"
                      :rows="2"
                      class="w-full"
                      :data-attendance-admin-control="ATTENDANCE_ADMIN_CONTROL.rejectReason"
                    />
                  </UFormField>
                  <FieldCounter :value="rejectReason" :max="1000" />
                </div>
                <UButton color="warning" :loading="processingAction === 'reject'" data-attendance-admin-control="reject" @click="reject">
                  差戻し
                </UButton>
              </template>
              <UButton
                v-if="canCloseMonth"
                color="secondary"
                icon="i-mdi-lock-outline"
                :loading="processingAction === 'close'"
                data-attendance-admin-control="close"
                @click="close"
              >
                月次を締める
              </UButton>

              <USeparator class="my-4" />
              <div class="mb-2 text-sm font-medium">登録済み日別明細</div>
              <table class="app-table">
                <thead>
                  <tr>
                    <th>勤務日</th>
                    <th>状態</th>
                    <th>勤務区間数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in selectedDetail.days" :key="day.workDate">
                    <td>{{ formatAttendanceDate(day.workDate) }}</td>
                    <td>{{ getAttendancePunchStateLabel(day.punchState) }}</td>
                    <td>{{ day.workPeriods.length }}</td>
                  </tr>
                  <tr v-if="selectedDetail.days.length === 0">
                    <td colspan="3" class="text-center text-muted">登録済み勤怠日はありません。</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <div v-else class="py-8 text-center text-muted">左の一覧から確認する利用者を選択してください。</div>
          </UCard>
        </div>
      </div>
    </UCard>
  </div>
</template>
