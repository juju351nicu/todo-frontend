<script setup lang="ts">
import { onBeforeMount } from "vue";

import { DASHBOARD_CONTROL, useDashboardPage } from "@/features/dashboard/composables/useDashboardPage";
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
} from "@/features/notification/utils/notification";
import TodoPriorityBadge from "@/features/task/components/TodoPriorityBadge.vue";
import { formatMyTaskRemainingDays } from "@/features/task/utils/taskDisplay";
import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
  getEarnedValueRatioColor,
  getEarnedValueVarianceColor,
} from "@/features/wbs/utils/earnedValue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  advancedDashboard,
  advancedErrorMessages,
  advancedStatusDate,
  canExpandNotification,
  dashboard,
  displayName,
  errorMessages,
  isAdvancedLoading,
  isAdvancedNotEntitled,
  isInitialLoading,
  isLoading,
  isNotificationExpanded,
  loadDashboard,
  openAdvancedAccessInquiry,
  openAdvancedProject,
  openAttendance,
  openMyTasks,
  openNotificationEvent,
  openProject,
  openProjects,
  openTask,
  reloadDashboard,
  submitAdvancedDashboard,
} = useDashboardPage();

onBeforeMount(loadDashboard);

// 移行前のv-card-title直下のv-dividerと同じく、見出しと本文を線で区切り、本文の上余白を残す。
const dividedCardUi = { header: "border-b border-default", body: "not-first:pt-4" };
</script>

<template>
  <div class="max-w-360 p-4 max-sm:px-3 md:p-6">
    <div class="mb-6 flex items-start justify-between gap-4 sm:items-center">
      <div>
        <div class="text-xs leading-8 font-medium tracking-[.1666666667em] text-muted uppercase">Work Management</div>
        <h1 class="text-[2.125rem] leading-10 font-bold tracking-[.0073529412em]">{{ displayName }}さんのDashboard</h1>
        <p v-if="dashboard" class="mt-1 mb-0 text-sm text-muted">
          {{ formatDashboardBusinessDate(dashboard.businessDate) }} ・
          {{ dashboard.businessZoneId }}
        </p>
      </div>
      <UButton
        icon="i-mdi-refresh"
        variant="ghost"
        square
        size="lg"
        class="size-12"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="Dashboardを再読み込み"
        title="再読み込み"
        :loading="isLoading"
        :data-dashboard-control="DASHBOARD_CONTROL.reload"
        @click="reloadDashboard"
      />
    </div>

    <LoadingIndicator v-if="isInitialLoading" />
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>

    <div v-if="dashboard" class="-m-3 flex flex-wrap items-stretch">
      <div class="w-full p-3 lg:w-7/12">
        <UCard variant="outline" class="flex h-full flex-col border-default" :ui="dividedCardUi">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <UIcon name="i-mdi-format-list-checks" class="size-6 text-primary" />
              My Tasks
              <UBadge v-if="dashboard.myTasks.available" color="primary" size="sm" class="ms-auto">
                未完了 {{ dashboard.myTasks.totalCount }}件
              </UBadge>
            </div>
          </template>
          <template v-if="dashboard.myTasks.available">
            <div class="-m-1 mb-2 flex flex-wrap">
              <div class="w-1/2 p-1 sm:w-1/4">
                <div class="min-h-19 rounded-sm bg-error/10 p-3">
                  <div class="text-xs text-muted">期限超過</div>
                  <div class="text-2xl font-bold text-error">{{ dashboard.myTasks.overdueCount }}</div>
                </div>
              </div>
              <div class="w-1/2 p-1 sm:w-1/4">
                <div class="min-h-19 rounded-sm bg-warning/10 p-3">
                  <div class="text-xs text-muted">今日</div>
                  <div class="text-2xl font-bold">{{ dashboard.myTasks.dueTodayCount }}</div>
                </div>
              </div>
              <div class="w-1/2 p-1 sm:w-1/4">
                <div class="min-h-19 rounded-sm bg-info/10 p-3">
                  <div class="text-xs text-muted">今週</div>
                  <div class="text-2xl font-bold">{{ dashboard.myTasks.dueThisWeekCount }}</div>
                </div>
              </div>
              <div class="w-1/2 p-1 sm:w-1/4">
                <div class="min-h-19 rounded-sm bg-elevated p-3">
                  <div class="text-xs text-muted">今後</div>
                  <div class="text-2xl font-bold">{{ dashboard.myTasks.upcomingCount }}</div>
                </div>
              </div>
            </div>

            <ul v-if="dashboard.myTasks.items.length" class="py-2">
              <li v-for="task in dashboard.myTasks.items" :key="task.taskId" class="border-b border-default last:border-b-0">
                <button
                  type="button"
                  class="flex w-full items-start px-4 py-2 text-start hover:bg-elevated"
                  @click="openTask(task)"
                >
                  <TodoPriorityBadge :priority="task.priority" size="xs" class="me-3 mt-0.5" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-medium">{{ task.title }}</span>
                    <span class="line-clamp-2 text-sm text-muted">
                      {{ task.projectName }} ・ {{ task.statusName }}<br />
                      期限 {{ task.dueDate }} ・ {{ formatMyTaskRemainingDays(task.remainingDays) }} ・
                      進捗 {{ Number(task.progressPercent) }}%
                    </span>
                  </span>
                  <UIcon name="i-mdi-chevron-right" class="ms-2 size-6 text-muted" />
                </button>
              </li>
            </ul>
            <StatusAlert v-else type="success" variant="soft">未完了の担当Taskはありません。</StatusAlert>
          </template>
          <StatusAlert v-else type="info" variant="soft">My Tasksを参照するpermissionがありません。</StatusAlert>
          <template v-if="dashboard.myTasks.available" #footer>
            <UButton
              color="primary"
              variant="ghost"
              trailing-icon="i-mdi-arrow-right"
              class="ms-auto"
              @click="openMyTasks"
            >
              My Tasksを開く
            </UButton>
          </template>
        </UCard>
      </div>

      <div class="w-full p-3 lg:w-5/12">
        <UCard variant="outline" class="h-full border-default" :ui="dividedCardUi">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <UIcon name="i-mdi-bell-outline" class="size-6 text-deep-purple" />
              通知
              <UBadge color="deep-purple" size="sm" class="ms-auto">{{ dashboard.notifications.badgeCount }}件</UBadge>
            </div>
          </template>
          <div class="mb-3 flex flex-wrap gap-2">
            <UBadge size="sm">未読 {{ dashboard.notifications.unreadEventCount }}件</UBadge>
            <UBadge color="warning" size="sm">未解決 {{ dashboard.notifications.unresolvedAlertCount }}件</UBadge>
          </div>
          <ul v-if="dashboard.notifications.recentEvents.length" class="py-2">
            <li
              v-for="event in dashboard.notifications.recentEvents"
              :key="event.notificationEventId"
              class="border-b border-default last:border-b-0"
            >
              <!-- 遷移先のないお知らせは、押すと本文の全文を開閉する（2行では読み切れないため）。 -->
              <button
                type="button"
                class="flex w-full items-start px-4 py-2 text-start hover:bg-elevated"
                :aria-expanded="canExpandNotification(event) ? isNotificationExpanded(event.notificationEventId) : undefined"
                @click="openNotificationEvent(event)"
              >
                <UIcon :name="getNotificationEventIcon(event.eventType)" class="me-3 size-6 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block text-base" :class="{ 'font-bold': !event.read }">{{ event.title }}</span>
                  <span
                    class="text-sm whitespace-pre-line text-muted"
                    :class="isNotificationExpanded(event.notificationEventId) ? 'block' : 'line-clamp-2'"
                    >{{ event.message }}</span
                  >
                  <span class="flex items-center gap-1 text-sm text-muted">
                    {{ formatNotificationOccurredAt(event.occurredAt) }}
                    <span v-if="canExpandNotification(event)" class="ms-auto inline-flex items-center text-xs">
                      {{ isNotificationExpanded(event.notificationEventId) ? "閉じる" : "全文を表示" }}
                      <UIcon
                        :name="isNotificationExpanded(event.notificationEventId) ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
                        class="size-4"
                      />
                    </span>
                  </span>
                </span>
              </button>
            </li>
          </ul>
          <StatusAlert v-else type="success" variant="soft">新しいイベント通知はありません。</StatusAlert>
        </UCard>
      </div>

      <div class="w-full p-3 lg:w-2/3">
        <UCard variant="outline" class="flex h-full flex-col border-default" :ui="dividedCardUi">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <UIcon name="i-mdi-folder-multiple-outline" class="size-6 text-teal" />
              Projects
              <UBadge v-if="dashboard.projects.available" color="teal" size="sm" class="ms-auto">
                ACTIVE {{ dashboard.projects.activeProjectCount }}件
              </UBadge>
            </div>
          </template>
          <template v-if="dashboard.projects.available">
            <div v-if="dashboard.projects.cards.length" class="-m-1 flex flex-wrap">
              <div v-for="project in dashboard.projects.cards" :key="project.projectId" class="w-full p-1 md:w-1/2">
                <button
                  type="button"
                  class="block h-full w-full rounded-sm bg-teal/12 text-start text-teal hover:bg-teal/16"
                  @click="openProject(project)"
                >
                  <span class="block px-4 pt-2 text-base font-bold">{{ project.projectName }}</span>
                  <span class="block px-4 text-sm opacity-60">
                    {{ project.projectKey }} ・ {{ getDashboardProjectRoleLabel(project.projectRole) }}
                  </span>
                  <span class="block p-4">
                    <span class="mb-1 flex justify-between text-sm">
                      <span>平均進捗</span>
                      <strong>{{ Number(project.averageProgressPercent) }}%</strong>
                    </span>
                    <UProgress
                      :model-value="normalizeDashboardProgress(Number(project.averageProgressPercent))"
                      color="teal"
                      size="md"
                      class="mb-3"
                      :ui="{ base: 'h-2 bg-teal/24 rounded-full', indicator: 'rounded-full' }"
                    />
                    <span class="flex flex-wrap gap-2">
                      <UBadge size="sm" variant="outline" color="teal">
                        完了 {{ project.completedTaskCount }}/{{ project.totalTaskCount }}
                      </UBadge>
                      <UBadge v-if="project.overdueTaskCount > 0" size="sm" color="error">
                        期限超過 {{ project.overdueTaskCount }}
                      </UBadge>
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <StatusAlert v-else type="info" variant="soft">参照できるACTIVE Projectはありません。</StatusAlert>
          </template>
          <StatusAlert v-else type="info" variant="soft">Project進捗を参照するpermissionがありません。</StatusAlert>
          <template v-if="dashboard.projects.available" #footer>
            <UButton color="teal" variant="ghost" trailing-icon="i-mdi-arrow-right" class="ms-auto" @click="openProjects">
              Project一覧を開く
            </UButton>
          </template>
        </UCard>
      </div>

      <div class="w-full p-3 lg:w-1/3">
        <UCard variant="outline" class="flex h-full flex-col border-default" :ui="dividedCardUi">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-mdi-clock-outline" class="size-6 text-indigo" />
              今月の勤怠
            </div>
          </template>
          <template v-if="dashboard.attendance.available">
            <template v-if="dashboard.attendance.status">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <span class="text-xl font-medium">{{ dashboard.attendance.yearMonth }}</span>
                <UBadge :color="getAttendanceMonthStatusColor(dashboard.attendance.status)" size="sm">
                  {{ getAttendanceMonthStatusLabel(dashboard.attendance.status) }}
                </UBadge>
              </div>
              <ul class="py-2 text-base">
                <li class="flex min-h-10 items-center gap-8 px-4">
                  <UIcon name="i-mdi-briefcase-clock-outline" class="size-6 opacity-60" />
                  <span class="flex-1">実勤務</span>
                  <strong>{{ formatAttendanceMinutes(dashboard.attendance.netWorkMinutes ?? 0) }}</strong>
                </li>
                <li class="flex min-h-10 items-center gap-8 px-4">
                  <UIcon name="i-mdi-timer-outline" class="size-6 opacity-60" />
                  <span class="flex-1">総勤務</span>
                  {{ formatAttendanceMinutes(dashboard.attendance.grossWorkMinutes ?? 0) }}
                </li>
                <li class="flex min-h-10 items-center gap-8 px-4">
                  <UIcon name="i-mdi-coffee-outline" class="size-6 opacity-60" />
                  <span class="flex-1">休憩</span>
                  {{ formatAttendanceMinutes(dashboard.attendance.breakMinutes ?? 0) }}
                </li>
              </ul>
              <StatusAlert
                v-if="dashboard.attendance.hasIncompletePeriod"
                type="warning"
                variant="soft"
                density="compact"
                class="mt-3"
              >
                未終了の勤務または休憩があります。
              </StatusAlert>
            </template>
            <StatusAlert v-else type="warning" variant="soft">当月の勤怠状態を取得できませんでした。</StatusAlert>
          </template>
          <StatusAlert v-else type="info" variant="soft">本人勤怠を参照するpermissionがありません。</StatusAlert>
          <template v-if="dashboard.attendance.available" #footer>
            <UButton color="indigo" variant="ghost" trailing-icon="i-mdi-arrow-right" class="ms-auto" @click="openAttendance">
              勤怠を開く
            </UButton>
          </template>
        </UCard>
      </div>
    </div>

    <UCard v-if="dashboard" variant="outline" class="mt-6 border-default" :ui="dividedCardUi">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-mdi-chart-box-outline" class="size-6 text-amber-darken-3" />
          高度Dashboard
          <UBadge size="sm" color="amber-darken-3">Pro</UBadge>
          <UBadge v-if="advancedDashboard" size="sm" variant="outline" class="ms-auto">
            基準日 {{ advancedDashboard.statusDate }}
          </UBadge>
        </div>
      </template>

      <StatusAlert v-if="!dashboard.myTasks.available" type="info" variant="soft">
        高度Dashboardの利用にはTask参照permissionが必要です。
      </StatusAlert>

      <template v-else>
        <p class="mb-4 text-sm text-muted">
          参照可能なProjectのEVMと、基準日を含む週の本人予定負荷を比較します。
          計算式と参照範囲はBackendが一元管理します。
        </p>

        <form v-if="!isAdvancedNotEntitled" class="mb-4" @submit.prevent="submitAdvancedDashboard">
          <div class="-m-1 flex flex-wrap items-center">
            <div class="w-full p-1 sm:w-5/12 md:w-1/4">
              <UFormField label="EVM基準日" class="pb-0">
                <UInput
                  v-model="advancedStatusDate"
                  type="date"
                  :disabled="isAdvancedLoading"
                  class="w-full"
                  :data-dashboard-control="DASHBOARD_CONTROL.advancedStatusDate"
                />
              </UFormField>
            </div>
            <div class="w-full p-1 sm:w-1/4 md:w-1/6">
              <UButton type="submit" color="amber-darken-3" icon="i-mdi-calculator-variant-outline" :loading="isAdvancedLoading" block>
                集計
              </UButton>
            </div>
          </div>
        </form>

        <StatusAlert v-if="advancedErrorMessages.length" type="error" class="mb-4">
          <div v-for="message in advancedErrorMessages" :key="message">{{ message }}</div>
        </StatusAlert>

        <StatusAlert
          v-if="isAdvancedNotEntitled"
          type="info"
          variant="soft"
          class="mb-2"
          title="高度Dashboardは現在のプランでは利用できません"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="flex-1">
              Project横断EVMと本人の週次予定負荷を利用する場合は、利用プランについてお問い合わせください。
            </span>
            <UButton variant="ghost" color="primary" @click="openAdvancedAccessInquiry">問い合わせる</UButton>
          </div>
        </StatusAlert>

        <div v-else-if="isAdvancedLoading && advancedDashboard === null" class="flex flex-col gap-3">
          <USkeleton class="h-6 w-1/3" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-2/3" />
          <USkeleton v-for="row in 4" :key="row" class="h-10 w-full" />
        </div>

        <template v-else-if="advancedDashboard">
          <div class="mb-4 flex flex-wrap gap-2">
            <UBadge variant="outline">{{ advancedDashboard.projects.length }} Project</UBadge>
            <UBadge :color="advancedDashboard.projectsWithoutActiveBaselineCount > 0 ? 'warning' : 'success'">
              active baselineなし
              {{ advancedDashboard.projectsWithoutActiveBaselineCount }}件
            </UBadge>
            <UBadge variant="outline">timezone {{ advancedDashboard.businessZoneId }}</UBadge>
          </div>

          <template v-if="advancedDashboard.projects.length">
            <div class="hidden overflow-x-auto md:block">
              <table class="app-table app-table-hover min-w-280 [&_td]:h-13 [&_td]:py-2">
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
                  <tr v-for="project in advancedDashboard.projects" :key="project.projectId">
                    <td>
                      <UButton
                        variant="ghost"
                        color="primary"
                        class="px-0 normal-case"
                        trailing-icon="i-mdi-arrow-right"
                        @click="openAdvancedProject(project)"
                      >
                        {{ project.projectName }}
                      </UButton>
                      <div class="text-xs text-muted">
                        {{ project.projectKey }} ・ #{{ project.baselineNumber }}
                        {{ project.baselineName }} ・ {{ project.baselineDate }}
                      </div>
                    </td>
                    <td class="whitespace-nowrap">
                      BAC {{ formatEarnedValueMinutes(project.bac) }}<br />
                      PV {{ formatEarnedValueMinutes(project.pv) }} ・ EV {{ formatEarnedValueMinutes(project.ev) }}<br />
                      AC {{ formatEarnedValueMinutes(project.ac) }}
                    </td>
                    <td class="whitespace-nowrap">
                      計画 {{ formatEarnedValuePercent(project.plannedProgressPercent) }}<br />
                      出来高 {{ formatEarnedValuePercent(project.earnedProgressPercent) }}
                    </td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        <UBadge size="sm" :color="getEarnedValueRatioColor(project.spi)">
                          SPI {{ formatEarnedValueRatio(project.spi) }}
                        </UBadge>
                        <UBadge size="sm" :color="getEarnedValueRatioColor(project.cpi)">
                          CPI {{ formatEarnedValueRatio(project.cpi) }}
                        </UBadge>
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        <UBadge size="sm" :color="getEarnedValueVarianceColor(project.sv)">
                          SV {{ formatSignedEarnedValueMinutes(project.sv) }}
                        </UBadge>
                        <UBadge size="sm" :color="getEarnedValueVarianceColor(project.cv)">
                          CV {{ formatSignedEarnedValueMinutes(project.cv) }}
                        </UBadge>
                      </div>
                    </td>
                    <td class="whitespace-nowrap">
                      {{ project.workloadWeekStartDate }} ～ {{ project.workloadWeekEndDate }}<br />
                      {{ formatAttendanceMinutes(project.ownPlannedWorkloadMinutes) }}
                      <UBadge v-if="project.ownOverEightHourDayCount > 0" color="warning" size="xs" class="ms-1">
                        8時間超 {{ project.ownOverEightHourDayCount }}日
                      </UBadge>
                    </td>
                    <td>
                      <div v-if="project.warningCodes.length" class="flex flex-col items-start gap-1">
                        <UBadge v-for="warningCode in project.warningCodes" :key="warningCode" color="warning" size="sm">
                          {{ getAdvancedDashboardWarningLabel(warningCode) }}
                        </UBadge>
                      </div>
                      <span v-else class="text-muted">なし</span>
                      <div class="mt-1 text-xs text-muted">
                        baseline配賦差
                        {{ formatSignedEarnedValueMinutes(project.baselineAllocationVarianceMinutes) }}
                      </div>
                      <div v-if="project.excludedActualEffortMinutes > 0" class="text-xs text-warning">
                        AC除外 {{ formatEarnedValueMinutes(project.excludedActualEffortMinutes) }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="-m-1 flex flex-col md:hidden">
              <div v-for="project in advancedDashboard.projects" :key="project.projectId" class="p-1">
                <button
                  type="button"
                  class="block w-full rounded-sm bg-amber-darken-3/12 text-start text-amber-darken-3 hover:bg-amber-darken-3/16"
                  @click="openAdvancedProject(project)"
                >
                  <span class="block px-4 pt-2 text-base font-bold">{{ project.projectName }}</span>
                  <span class="block px-4 text-sm opacity-60">
                    {{ project.projectKey }} ・ baseline #{{ project.baselineNumber }}
                  </span>
                  <span class="block p-4">
                    <span class="mb-3 flex flex-wrap gap-1">
                      <UBadge size="sm" :color="getEarnedValueRatioColor(project.spi)">
                        SPI {{ formatEarnedValueRatio(project.spi) }}
                      </UBadge>
                      <UBadge size="sm" :color="getEarnedValueRatioColor(project.cpi)">
                        CPI {{ formatEarnedValueRatio(project.cpi) }}
                      </UBadge>
                      <UBadge v-if="project.warningCodes.length" size="sm" color="warning">
                        警告 {{ project.warningCodes.length }}件
                      </UBadge>
                      <UBadge size="sm" :color="getEarnedValueVarianceColor(project.sv)">
                        SV {{ formatSignedEarnedValueMinutes(project.sv) }}
                      </UBadge>
                      <UBadge size="sm" :color="getEarnedValueVarianceColor(project.cv)">
                        CV {{ formatSignedEarnedValueMinutes(project.cv) }}
                      </UBadge>
                    </span>
                    <span class="block text-sm">
                      計画 {{ formatEarnedValuePercent(project.plannedProgressPercent) }} ・
                      出来高 {{ formatEarnedValuePercent(project.earnedProgressPercent) }}
                    </span>
                    <span class="mt-1 block text-sm">
                      BAC {{ formatEarnedValueMinutes(project.bac) }} ・ PV {{ formatEarnedValueMinutes(project.pv) }} ・
                      EV {{ formatEarnedValueMinutes(project.ev) }} ・ AC {{ formatEarnedValueMinutes(project.ac) }}
                    </span>
                    <span class="mt-1 block text-sm">
                      本人予定 {{ formatAttendanceMinutes(project.ownPlannedWorkloadMinutes) }}
                      （{{ project.workloadWeekStartDate }} ～ {{ project.workloadWeekEndDate }}）
                    </span>
                    <StatusAlert
                      v-if="project.ownOverEightHourDayCount > 0"
                      type="warning"
                      variant="soft"
                      density="compact"
                      class="mt-3"
                    >
                      8時間を超える予定日が{{ project.ownOverEightHourDayCount }}日あります。
                    </StatusAlert>
                  </span>
                </button>
              </div>
            </div>
          </template>

          <StatusAlert v-else type="info" variant="soft">
            active baselineを持つ参照可能なACTIVE Projectはありません。
          </StatusAlert>
        </template>
      </template>
    </UCard>
  </div>
</template>
