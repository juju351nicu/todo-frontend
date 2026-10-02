<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useDashboardPage } from "@/features/dashboard/composables/useDashboardPage";
import {
  formatDashboardBusinessDate,
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
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  dashboard,
  displayName,
  errorMessages,
  isInitialLoading,
  isLoading,
  loadDashboard,
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
                <v-card variant="tonal" color="teal" height="100%" @click="openProject(project)">
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

@media (max-width: 599px) {
  .dashboard-page {
    padding-inline: 12px !important;
  }
}
</style>
