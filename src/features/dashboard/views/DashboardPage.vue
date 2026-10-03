<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useDashboardPage } from "@/features/dashboard/composables/useDashboardPage";
import {
  formatDashboardBusinessDate,
  getAdvancedDashboardWarningLabel,
  getDashboardProjectRoleLabel,
  normalizeDashboardProgress,
} from "@/features/dashboard/utils/dashboard";
import {
  formatAttendanceMinutes,
  getAttendanceMonthStatusColor,
  getAttendanceMonthStatusLabel,
} from "@/features/attendance/utils/attendance";
import {
  formatNotificationOccurredAt,
  getNotificationEventIcon,
  normalizeNotificationNavigationPath,
} from "@/features/notification/utils/notification";
import {
  formatMyTaskRemainingDays,
  getTodoPriorityColor,
  getTodoPriorityLabel,
} from "@/features/task/utils/taskDisplay";
import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
  getEarnedValueRatioColor,
  getEarnedValueVarianceColor,
} from "@/features/wbs/utils/earnedValue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  advancedDashboard,
  advancedErrorMessages,
  advancedStatusDate,
  dashboard,
  displayName,
  errorMessages,
  isAdvancedLoading,
  isAdvancedNotEntitled,
  isInitialLoading,
  isLoading,
  loadAdvancedDashboard,
  loadDashboard,
  openAdvancedAccessInquiry,
  openAdvancedProject,
  openAttendance,
  openMyTasks,
  openNotificationEvent,
  openProject,
  openProjects,
  openTask,
} = useDashboardPage();

onBeforeMount(loadDashboard);
</script>

<template>
  <AppHeader />
  <v-container fluid class="dashboard-page pa-4 pa-md-6">
    <div class="d-flex align-start align-sm-center justify-space-between ga-4 mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">Work Management</div>
        <h1 class="text-h4 font-weight-bold">{{ displayName }}さんのDashboard</h1>
        <p v-if="dashboard" class="text-body-2 text-medium-emphasis mt-1 mb-0">
          {{ formatDashboardBusinessDate(dashboard.businessDate) }} ・
          {{ dashboard.businessZoneId }}
        </p>
      </div>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        aria-label="Dashboardを再読み込み"
        title="再読み込み"
        :loading="isLoading"
        @click="loadDashboard"
      />
    </div>

    <LoadingIndicator v-if="isInitialLoading" />
    <v-alert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>

    <v-row v-if="dashboard" align="stretch">
      <v-col cols="12" lg="7">
        <v-card class="dashboard-card h-100" variant="outlined">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon icon="mdi-format-list-checks" color="primary" />
            My Tasks
            <v-spacer />
            <v-chip v-if="dashboard.myTasks.available" color="primary" size="small">
              未完了 {{ dashboard.myTasks.totalCount }}件
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text v-if="dashboard.myTasks.available">
            <v-row dense class="mb-3">
              <v-col cols="6" sm="3">
                <v-sheet class="metric pa-3" rounded color="red-lighten-5">
                  <div class="text-caption text-medium-emphasis">期限超過</div>
                  <div class="text-h5 font-weight-bold text-error">
                    {{ dashboard.myTasks.overdueCount }}
                  </div>
                </v-sheet>
              </v-col>
              <v-col cols="6" sm="3">
                <v-sheet class="metric pa-3" rounded color="orange-lighten-5">
                  <div class="text-caption text-medium-emphasis">今日</div>
                  <div class="text-h5 font-weight-bold">
                    {{ dashboard.myTasks.dueTodayCount }}
                  </div>
                </v-sheet>
              </v-col>
              <v-col cols="6" sm="3">
                <v-sheet class="metric pa-3" rounded color="blue-lighten-5">
                  <div class="text-caption text-medium-emphasis">今週</div>
                  <div class="text-h5 font-weight-bold">
                    {{ dashboard.myTasks.dueThisWeekCount }}
                  </div>
                </v-sheet>
              </v-col>
              <v-col cols="6" sm="3">
                <v-sheet class="metric pa-3" rounded color="grey-lighten-4">
                  <div class="text-caption text-medium-emphasis">今後</div>
                  <div class="text-h5 font-weight-bold">
                    {{ dashboard.myTasks.upcomingCount }}
                  </div>
                </v-sheet>
              </v-col>
            </v-row>

            <v-list v-if="dashboard.myTasks.items.length" lines="three" density="compact">
              <v-list-item
                v-for="task in dashboard.myTasks.items"
                :key="task.taskId"
                class="dashboard-list-item"
                link
                @click="openTask(task)"
              >
                <template #prepend>
                  <v-chip :color="getTodoPriorityColor(task.priority)" size="x-small" class="mr-3">
                    {{ getTodoPriorityLabel(task.priority) }}
                  </v-chip>
                </template>
                <v-list-item-title class="font-weight-medium">{{ task.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ task.projectName }} ・ {{ task.statusName }}<br />
                  期限 {{ task.dueDate }} ・ {{ formatMyTaskRemainingDays(task.remainingDays) }} ・
                  進捗 {{ Number(task.progressPercent) }}%
                </v-list-item-subtitle>
                <template #append>
                  <v-icon icon="mdi-chevron-right" />
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else type="success" variant="tonal">
              未完了の担当Taskはありません。
            </v-alert>
          </v-card-text>
          <v-card-text v-else>
            <v-alert type="info" variant="tonal">
              My Tasksを参照するpermissionがありません。
            </v-alert>
          </v-card-text>
          <v-card-actions v-if="dashboard.myTasks.available">
            <v-spacer />
            <v-btn color="primary" variant="text" append-icon="mdi-arrow-right" @click="openMyTasks">
              My Tasksを開く
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card class="dashboard-card h-100" variant="outlined">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon icon="mdi-bell-outline" color="deep-purple" />
            通知
            <v-spacer />
            <v-chip color="deep-purple" size="small">
              {{ dashboard.notifications.badgeCount }}件
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <div class="d-flex flex-wrap ga-2 mb-3">
              <v-chip variant="tonal" size="small">
                未読 {{ dashboard.notifications.unreadEventCount }}件
              </v-chip>
              <v-chip color="warning" variant="tonal" size="small">
                未解決 {{ dashboard.notifications.unresolvedAlertCount }}件
              </v-chip>
            </div>
            <v-list v-if="dashboard.notifications.recentEvents.length" lines="three" density="compact">
              <v-list-item
                v-for="event in dashboard.notifications.recentEvents"
                :key="event.notificationEventId"
                class="dashboard-list-item"
                :link="normalizeNotificationNavigationPath(event.navigationPath) !== null"
                @click="openNotificationEvent(event)"
              >
                <template #prepend>
                  <v-icon :icon="getNotificationEventIcon(event.eventType)" class="mr-3" />
                </template>
                <v-list-item-title :class="{ 'font-weight-bold': !event.read }">
                  {{ event.title }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ event.message }}<br />
                  {{ formatNotificationOccurredAt(event.occurredAt) }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-alert v-else type="success" variant="tonal">
              新しいイベント通知はありません。
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="8">
        <v-card class="dashboard-card h-100" variant="outlined">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon icon="mdi-folder-multiple-outline" color="teal" />
            Projects
            <v-spacer />
            <v-chip v-if="dashboard.projects.available" color="teal" size="small">
              ACTIVE {{ dashboard.projects.activeProjectCount }}件
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text v-if="dashboard.projects.available">
            <v-row v-if="dashboard.projects.cards.length" dense>
              <v-col
                v-for="project in dashboard.projects.cards"
                :key="project.projectId"
                cols="12"
                md="6"
              >
                <v-card
                  variant="tonal"
                  color="teal"
                  height="100%"
                  link
                  @click="openProject(project)"
                >
                  <v-card-title class="text-subtitle-1 font-weight-bold">
                    {{ project.projectName }}
                  </v-card-title>
                  <v-card-subtitle>
                    {{ project.projectKey }} ・ {{ getDashboardProjectRoleLabel(project.projectRole) }}
                  </v-card-subtitle>
                  <v-card-text>
                    <div class="d-flex justify-space-between text-body-2 mb-1">
                      <span>平均進捗</span>
                      <strong>{{ Number(project.averageProgressPercent) }}%</strong>
                    </div>
                    <v-progress-linear
                      :model-value="normalizeDashboardProgress(Number(project.averageProgressPercent))"
                      color="teal"
                      height="8"
                      rounded
                      class="mb-3"
                    />
                    <div class="d-flex flex-wrap ga-2">
                      <v-chip size="small" variant="outlined">
                        完了 {{ project.completedTaskCount }}/{{ project.totalTaskCount }}
                      </v-chip>
                      <v-chip
                        v-if="project.overdueTaskCount > 0"
                        size="small"
                        color="error"
                        variant="tonal"
                      >
                        期限超過 {{ project.overdueTaskCount }}
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <v-alert v-else type="info" variant="tonal">
              参照できるACTIVE Projectはありません。
            </v-alert>
          </v-card-text>
          <v-card-text v-else>
            <v-alert type="info" variant="tonal">
              Project進捗を参照するpermissionがありません。
            </v-alert>
          </v-card-text>
          <v-card-actions v-if="dashboard.projects.available">
            <v-spacer />
            <v-btn color="teal" variant="text" append-icon="mdi-arrow-right" @click="openProjects">
              Project一覧を開く
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="dashboard-card h-100" variant="outlined">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-clock-outline" color="indigo" />
            今月の勤怠
          </v-card-title>
          <v-divider />
          <template v-if="dashboard.attendance.available">
            <v-card-text v-if="dashboard.attendance.status">
              <div class="d-flex align-center flex-wrap ga-2 mb-4">
                <span class="text-h6">{{ dashboard.attendance.yearMonth }}</span>
                <v-chip
                  :color="getAttendanceMonthStatusColor(dashboard.attendance.status)"
                  size="small"
                >
                  {{ getAttendanceMonthStatusLabel(dashboard.attendance.status) }}
                </v-chip>
              </div>
              <v-list density="compact">
                <v-list-item title="実勤務" prepend-icon="mdi-briefcase-clock-outline">
                  <template #append>
                    <strong>{{ formatAttendanceMinutes(dashboard.attendance.netWorkMinutes ?? 0) }}</strong>
                  </template>
                </v-list-item>
                <v-list-item title="総勤務" prepend-icon="mdi-timer-outline">
                  <template #append>
                    {{ formatAttendanceMinutes(dashboard.attendance.grossWorkMinutes ?? 0) }}
                  </template>
                </v-list-item>
                <v-list-item title="休憩" prepend-icon="mdi-coffee-outline">
                  <template #append>
                    {{ formatAttendanceMinutes(dashboard.attendance.breakMinutes ?? 0) }}
                  </template>
                </v-list-item>
              </v-list>
              <v-alert
                v-if="dashboard.attendance.hasIncompletePeriod"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                未終了の勤務または休憩があります。
              </v-alert>
            </v-card-text>
            <v-card-text v-else>
              <v-alert type="warning" variant="tonal">
                当月の勤怠状態を取得できませんでした。
              </v-alert>
            </v-card-text>
          </template>
          <v-card-text v-else>
            <v-alert type="info" variant="tonal">
              本人勤怠を参照するpermissionがありません。
            </v-alert>
          </v-card-text>
          <v-card-actions v-if="dashboard.attendance.available">
            <v-spacer />
            <v-btn color="indigo" variant="text" append-icon="mdi-arrow-right" @click="openAttendance">
              勤怠を開く
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card v-if="dashboard" class="dashboard-card mt-6" variant="outlined">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon icon="mdi-chart-box-outline" color="amber-darken-3" />
        高度Dashboard
        <v-chip size="small" color="amber-darken-3" variant="tonal">Pro</v-chip>
        <v-spacer />
        <v-chip v-if="advancedDashboard" size="small" variant="outlined">
          基準日 {{ advancedDashboard.statusDate }}
        </v-chip>
      </v-card-title>
      <v-divider />

      <v-card-text v-if="!dashboard.myTasks.available">
        <v-alert type="info" variant="tonal">
          高度Dashboardの利用にはTask参照permissionが必要です。
        </v-alert>
      </v-card-text>

      <v-card-text v-else>
        <p class="text-body-2 text-medium-emphasis mb-4">
          参照可能なProjectのEVMと、基準日を含む週の本人予定負荷を比較します。
          計算式と参照範囲はBackendが一元管理します。
        </p>

        <v-form
          v-if="!isAdvancedNotEntitled"
          class="mb-4"
          @submit.prevent="loadAdvancedDashboard()"
        >
          <v-row align="center" dense>
            <v-col cols="12" sm="5" md="3">
              <v-text-field
                v-model="advancedStatusDate"
                label="EVM基準日"
                type="date"
                :disabled="isAdvancedLoading"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="3" md="2">
              <v-btn
                type="submit"
                color="amber-darken-3"
                prepend-icon="mdi-calculator-variant-outline"
                :loading="isAdvancedLoading"
                block
              >
                集計
              </v-btn>
            </v-col>
          </v-row>
        </v-form>

        <v-alert v-if="advancedErrorMessages.length" type="error" class="mb-4">
          <div v-for="message in advancedErrorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>

        <v-alert
          v-if="isAdvancedNotEntitled"
          type="info"
          variant="tonal"
          class="mb-2"
          title="高度Dashboardは現在のプランでは利用できません"
        >
          Project横断EVMと本人の週次予定負荷を利用する場合は、利用プランについてお問い合わせください。
          <template #append>
            <v-btn variant="text" color="primary" @click="openAdvancedAccessInquiry">
              問い合わせる
            </v-btn>
          </template>
        </v-alert>

        <v-skeleton-loader
          v-else-if="isAdvancedLoading && advancedDashboard === null"
          type="article, table"
        />

        <template v-else-if="advancedDashboard">
          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip variant="outlined">
              {{ advancedDashboard.projects.length }} Project
            </v-chip>
            <v-chip
              :color="
                advancedDashboard.projectsWithoutActiveBaselineCount > 0
                  ? 'warning'
                  : 'success'
              "
              variant="tonal"
            >
              active baselineなし
              {{ advancedDashboard.projectsWithoutActiveBaselineCount }}件
            </v-chip>
            <v-chip variant="outlined">
              timezone {{ advancedDashboard.businessZoneId }}
            </v-chip>
          </div>

          <template v-if="advancedDashboard.projects.length">
            <div class="advanced-table-scroll d-none d-md-block">
              <v-table hover class="advanced-table">
                <thead>
                  <tr>
                    <th scope="col">Project / baseline</th>
                    <th scope="col">EVM</th>
                    <th scope="col">進捗</th>
                    <th scope="col">効率</th>
                    <th scope="col">差異</th>
                    <th scope="col">本人予定負荷</th>
                    <th scope="col">警告</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="project in advancedDashboard.projects"
                    :key="project.projectId"
                  >
                    <td>
                      <v-btn
                        variant="text"
                        color="primary"
                        class="px-0 text-none"
                        append-icon="mdi-arrow-right"
                        @click="openAdvancedProject(project)"
                      >
                        {{ project.projectName }}
                      </v-btn>
                      <div class="text-caption text-medium-emphasis">
                        {{ project.projectKey }} ・ #{{ project.baselineNumber }}
                        {{ project.baselineName }} ・ {{ project.baselineDate }}
                      </div>
                    </td>
                    <td class="text-no-wrap">
                      BAC {{ formatEarnedValueMinutes(project.bac) }}<br />
                      PV {{ formatEarnedValueMinutes(project.pv) }} ・
                      EV {{ formatEarnedValueMinutes(project.ev) }}<br />
                      AC {{ formatEarnedValueMinutes(project.ac) }}
                    </td>
                    <td class="text-no-wrap">
                      計画 {{ formatEarnedValuePercent(project.plannedProgressPercent) }}<br />
                      出来高 {{ formatEarnedValuePercent(project.earnedProgressPercent) }}
                    </td>
                    <td>
                      <div class="d-flex flex-wrap ga-1">
                        <v-chip
                          size="small"
                          :color="getEarnedValueRatioColor(project.spi)"
                          variant="tonal"
                        >
                          SPI {{ formatEarnedValueRatio(project.spi) }}
                        </v-chip>
                        <v-chip
                          size="small"
                          :color="getEarnedValueRatioColor(project.cpi)"
                          variant="tonal"
                        >
                          CPI {{ formatEarnedValueRatio(project.cpi) }}
                        </v-chip>
                      </div>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap ga-1">
                        <v-chip
                          size="small"
                          :color="getEarnedValueVarianceColor(project.sv)"
                          variant="tonal"
                        >
                          SV {{ formatSignedEarnedValueMinutes(project.sv) }}
                        </v-chip>
                        <v-chip
                          size="small"
                          :color="getEarnedValueVarianceColor(project.cv)"
                          variant="tonal"
                        >
                          CV {{ formatSignedEarnedValueMinutes(project.cv) }}
                        </v-chip>
                      </div>
                    </td>
                    <td class="text-no-wrap">
                      {{ project.workloadWeekStartDate }} ～
                      {{ project.workloadWeekEndDate }}<br />
                      {{ formatAttendanceMinutes(project.ownPlannedWorkloadMinutes) }}
                      <v-chip
                        v-if="project.ownOverEightHourDayCount > 0"
                        color="warning"
                        size="x-small"
                        class="ml-1"
                      >
                        8時間超 {{ project.ownOverEightHourDayCount }}日
                      </v-chip>
                    </td>
                    <td>
                      <div v-if="project.warningCodes.length" class="d-flex flex-column ga-1">
                        <v-chip
                          v-for="warningCode in project.warningCodes"
                          :key="warningCode"
                          color="warning"
                          size="small"
                          variant="tonal"
                        >
                          {{ getAdvancedDashboardWarningLabel(warningCode) }}
                        </v-chip>
                      </div>
                      <span v-else class="text-medium-emphasis">なし</span>
                      <div class="text-caption text-medium-emphasis mt-1">
                        baseline配賦差
                        {{ formatSignedEarnedValueMinutes(project.baselineAllocationVarianceMinutes) }}
                      </div>
                      <div
                        v-if="project.excludedActualEffortMinutes > 0"
                        class="text-caption text-warning"
                      >
                        AC除外 {{ formatEarnedValueMinutes(project.excludedActualEffortMinutes) }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <v-row class="d-md-none" dense>
              <v-col
                v-for="project in advancedDashboard.projects"
                :key="project.projectId"
                cols="12"
              >
                <v-card
                  variant="tonal"
                  color="amber-darken-3"
                  link
                  @click="openAdvancedProject(project)"
                >
                  <v-card-title class="text-subtitle-1 font-weight-bold">
                    {{ project.projectName }}
                  </v-card-title>
                  <v-card-subtitle>
                    {{ project.projectKey }} ・ baseline #{{ project.baselineNumber }}
                  </v-card-subtitle>
                  <v-card-text>
                    <div class="d-flex flex-wrap ga-1 mb-3">
                      <v-chip
                        size="small"
                        :color="getEarnedValueRatioColor(project.spi)"
                        variant="tonal"
                      >
                        SPI {{ formatEarnedValueRatio(project.spi) }}
                      </v-chip>
                      <v-chip
                        size="small"
                        :color="getEarnedValueRatioColor(project.cpi)"
                        variant="tonal"
                      >
                        CPI {{ formatEarnedValueRatio(project.cpi) }}
                      </v-chip>
                      <v-chip
                        v-if="project.warningCodes.length"
                        size="small"
                        color="warning"
                        variant="tonal"
                      >
                        警告 {{ project.warningCodes.length }}件
                      </v-chip>
                      <v-chip
                        size="small"
                        :color="getEarnedValueVarianceColor(project.sv)"
                        variant="tonal"
                      >
                        SV {{ formatSignedEarnedValueMinutes(project.sv) }}
                      </v-chip>
                      <v-chip
                        size="small"
                        :color="getEarnedValueVarianceColor(project.cv)"
                        variant="tonal"
                      >
                        CV {{ formatSignedEarnedValueMinutes(project.cv) }}
                      </v-chip>
                    </div>
                    <div class="text-body-2">
                      計画 {{ formatEarnedValuePercent(project.plannedProgressPercent) }} ・
                      出来高 {{ formatEarnedValuePercent(project.earnedProgressPercent) }}
                    </div>
                    <div class="text-body-2 mt-1">
                      BAC {{ formatEarnedValueMinutes(project.bac) }} ・
                      PV {{ formatEarnedValueMinutes(project.pv) }} ・
                      EV {{ formatEarnedValueMinutes(project.ev) }} ・
                      AC {{ formatEarnedValueMinutes(project.ac) }}
                    </div>
                    <div class="text-body-2 mt-1">
                      本人予定 {{ formatAttendanceMinutes(project.ownPlannedWorkloadMinutes) }}
                      （{{ project.workloadWeekStartDate }} ～ {{ project.workloadWeekEndDate }}）
                    </div>
                    <v-alert
                      v-if="project.ownOverEightHourDayCount > 0"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mt-3"
                    >
                      8時間を超える予定日が{{ project.ownOverEightHourDayCount }}日あります。
                    </v-alert>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </template>

          <v-alert v-else type="info" variant="tonal">
            active baselineを持つ参照可能なACTIVE Projectはありません。
          </v-alert>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.dashboard-page {
  max-width: 1440px;
}

.dashboard-card {
  border-color: rgba(var(--v-border-color), 0.28);
}

.metric {
  min-height: 76px;
}

.dashboard-list-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.dashboard-list-item:last-child {
  border-bottom: 0;
}

.advanced-table-scroll {
  overflow-x: auto;
}

.advanced-table {
  min-width: 1120px;
}

@media (max-width: 599px) {
  .dashboard-page {
    padding-inline: 12px !important;
  }
}
</style>
