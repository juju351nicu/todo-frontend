<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useAttendanceAdministrationPage } from "@/features/attendance/composables/useAttendanceAdministrationPage";
import {
  formatAttendanceDate,
  formatAttendanceInstant,
  formatAttendanceMinutes,
  getAttendanceMonthStatusColor,
  getAttendanceMonthStatusLabel,
  getAttendancePunchStateLabel,
} from "@/features/attendance/utils/attendance";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  approve,
  canApproveOrReject,
  canCloseMonth,
  close,
  errorMessages,
  initialize,
  isLoading,
  months,
  processingAction,
  reject,
  rejectReason,
  reviewComment,
  search,
  selectMonth,
  selectedAccountId,
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
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="attendance-administration-page pa-4 pa-md-6">
    <v-card class="mx-auto" max-width="1500">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-calendar-account-outline" />
        勤怠月次確認
      </v-card-title>
      <v-card-text>
        <v-row align="center" dense class="mb-3">
          <v-col cols="12" sm="4" md="3">
            <v-text-field v-model="selectedMonth" type="month" label="対象月" hide-details />
          </v-col>
          <v-col cols="12" sm="4" md="3">
            <v-select
              v-model="selectedStatus"
              :items="statusOptions"
              label="状態"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4" md="3">
            <v-btn color="primary" prepend-icon="mdi-magnify" :disabled="isLoading" @click="search">
              検索
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4">
          {{ successMessage }}
        </v-alert>

        <v-row>
          <v-col cols="12" lg="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1">確認対象（{{ months.length }}件）</v-card-title>
              <v-card-subtitle>提出履歴があり、月次rowが作成済みのaccountだけを表示します。</v-card-subtitle>
              <v-card-text class="px-0">
                <div class="attendance-administration-table-scroll">
                  <v-table density="compact" hover>
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
                        :class="{ 'selected-month-row': month.accountId === selectedAccountId }"
                        role="button"
                        tabindex="0"
                        :aria-label="`${month.displayName}の${month.yearMonth}勤怠を表示`"
                        @click="selectMonth(month)"
                        @keydown.enter="selectMonth(month)"
                        @keydown.space.prevent="selectMonth(month)"
                      >
                        <td>
                          <strong>{{ month.displayName }}</strong>
                          <div class="text-caption text-medium-emphasis">
                            {{ month.loginId || "OAuth account" }} / ID: {{ month.accountId }}
                          </div>
                        </td>
                        <td>
                          <v-chip :color="getAttendanceMonthStatusColor(month.statusCode)" size="small">
                            {{ getAttendanceMonthStatusLabel(month.statusCode) }}
                          </v-chip>
                        </td>
                        <td>{{ formatAttendanceInstant(month.submittedAt) }}</td>
                      </tr>
                      <tr v-if="months.length === 0">
                        <td colspan="3" class="text-center text-medium-emphasis py-6">
                          条件に一致する勤怠月はありません。
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="6">
            <v-card variant="outlined" class="attendance-administration-detail">
              <template v-if="selectedDetail">
                <v-card-title class="d-flex align-center flex-wrap ga-2">
                  {{ selectedListItem?.displayName || `Account ID: ${selectedDetail.accountId}` }}
                  <v-chip :color="getAttendanceMonthStatusColor(selectedDetail.statusCode)" size="small">
                    {{ getAttendanceMonthStatusLabel(selectedDetail.statusCode) }}
                  </v-chip>
                </v-card-title>
                <v-card-subtitle>{{ selectedDetail.yearMonth }} / version {{ selectedDetail.version }}</v-card-subtitle>
                <v-card-text>
                  <v-row dense class="mb-3">
                    <v-col cols="4"><span class="text-caption">総勤務</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.grossWorkMinutes) }}</strong></v-col>
                    <v-col cols="4"><span class="text-caption">休憩</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.breakMinutes) }}</strong></v-col>
                    <v-col cols="4"><span class="text-caption">差引勤務</span><br /><strong>{{ formatAttendanceMinutes(selectedDetail.netWorkMinutes) }}</strong></v-col>
                  </v-row>
                  <v-alert v-if="selectedDetail.hasIncompletePeriod" type="warning" density="compact" class="mb-3">
                    未終了の勤務・休憩区間があります。
                  </v-alert>
                  <v-alert v-if="selectedDetail.reviewComment" type="info" density="compact" class="mb-3">
                    審査コメント: {{ selectedDetail.reviewComment }}
                  </v-alert>

                  <template v-if="canApproveOrReject">
                    <v-textarea v-model="reviewComment" label="承認コメント（任意）" maxlength="1000" rows="2" counter />
                    <v-btn color="success" class="mb-4" :loading="processingAction === 'approve'" @click="approve">
                      承認
                    </v-btn>
                    <v-textarea v-model="rejectReason" label="差戻し理由（必須）" maxlength="1000" rows="2" counter />
                    <v-btn color="warning" :loading="processingAction === 'reject'" @click="reject">
                      差戻し
                    </v-btn>
                  </template>
                  <v-btn
                    v-if="canCloseMonth"
                    color="secondary"
                    prepend-icon="mdi-lock-outline"
                    :loading="processingAction === 'close'"
                    @click="close"
                  >
                    月次を締める
                  </v-btn>

                  <v-divider class="my-4" />
                  <div class="text-subtitle-2 mb-2">登録済み日別明細</div>
                  <v-table density="compact">
                    <thead><tr><th>勤務日</th><th>状態</th><th>勤務区間数</th></tr></thead>
                    <tbody>
                      <tr v-for="day in selectedDetail.days" :key="day.workDate">
                        <td>{{ formatAttendanceDate(day.workDate) }}</td>
                        <td>{{ getAttendancePunchStateLabel(day.punchState) }}</td>
                        <td>{{ day.workPeriods.length }}</td>
                      </tr>
                      <tr v-if="selectedDetail.days.length === 0">
                        <td colspan="3" class="text-center text-medium-emphasis">登録済み勤怠日はありません。</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </template>
              <v-card-text v-else class="text-center text-medium-emphasis py-12">
                左の一覧から確認する利用者を選択してください。
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.attendance-administration-page {
  background: rgb(var(--v-theme-surface-variant));
  min-height: calc(100vh - 64px);
}

.attendance-administration-table-scroll {
  max-height: 680px;
  overflow: auto;
}

.attendance-administration-table-scroll tbody tr {
  cursor: pointer;
}

.selected-month-row {
  background: rgba(var(--v-theme-primary), 0.12);
}

.attendance-administration-detail {
  position: sticky;
  top: 80px;
}

@media (max-width: 1279px) {
  .attendance-administration-detail {
    position: static;
  }
}
</style>
