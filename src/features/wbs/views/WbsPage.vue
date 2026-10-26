<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount } from "vue";

import TaskEffortPlanDialog from "@/features/wbs/components/TaskEffortPlanDialog.vue";
import TaskWorkLogDialog from "@/features/wbs/components/TaskWorkLogDialog.vue";
import TaskWorkloadCard from "@/features/wbs/components/TaskWorkloadCard.vue";
import WorkingCalendarCard from "@/features/wbs/components/WorkingCalendarCard.vue";
import WorkingDayEditDialog from "@/features/wbs/components/WorkingDayEditDialog.vue";
import WbsBaselineCard from "@/features/wbs/components/WbsBaselineCard.vue";
import WbsBaselineCreateDialog from "@/features/wbs/components/WbsBaselineCreateDialog.vue";
import WbsDependencyCreateDialog from "@/features/wbs/components/WbsDependencyCreateDialog.vue";
import WbsEarnedValueCard from "@/features/wbs/components/WbsEarnedValueCard.vue";
import WbsReportExportCard from "@/features/wbs/components/WbsReportExportCard.vue";
import WbsTaskEditDialog from "@/features/wbs/components/WbsTaskEditDialog.vue";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import {
  formatActualPeriod,
  formatPlannedEffort,
  formatProgressPercent,
  getWbsPriorityColor,
  getWbsPriorityLabel,
  getWbsTaskTypeIcon,
  getWbsTaskTypeLabel,
  normalizeProgressPercent,
} from "@/features/wbs/utils/wbsTree";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

// Gantt libraryは階層表だけを使う利用者へ配信せず、表示切替時に初めて読み込む。
const WbsGanttChart = defineAsyncComponent(
  () => import("@/features/wbs/components/WbsGanttChart.vue")
);

const {
  activateWbsBaseline,
  activeView,
  activeBaselineDetail,
  activatingBaselineId,
  baselineChangedRows,
  baselineEditorErrorMessages,
  baselineErrorMessages,
  baselineList,
  baselineSuccessMessage,
  cancelDependencyDelete,
  cancelEffortPlanDelete,
  cancelEffortPlanEdit,
  cancelWorkLogDelete,
  cancelWorkLogEdit,
  cancelWorkingDayDelete,
  canEditSelectedWorkingCalendarTarget,
  canEditSelectedEffortPlanTask,
  canEditSelectedWorkLogTask,
  canEditWbs,
  canManageAnyEffortPlan,
  canManageAnyWorkLog,
  canManageBaselines,
  closeBaselineCreateDialog,
  closeDependencyEditor,
  closeEffortPlanDialog,
  closeTaskEditor,
  closeWorkLogDialog,
  closeWorkingDayEditor,
  confirmDependencyDelete,
  confirmEffortPlanDelete,
  confirmWorkLogDelete,
  confirmWorkingDayDelete,
  currentAccountId,
  dependencies,
  dependencyEditorErrorMessages,
  dependencyPendingDelete,
  dependencyPendingDeleteRow,
  dependencyRows,
  dependencyTaskOptions,
  downloadWbsReport,
  earnedValue,
  earnedValueErrorMessages,
  earnedValueStatusDate,
  editingEffortPlan,
  editingTask,
  editingWorkLog,
  editEffortPlan,
  effortPlanAssigneeOptions,
  effortPlanEditorErrorMessages,
  effortPlanList,
  effortPlanPendingDelete,
  effortPlanSuccessMessage,
  effortPlanTask,
  editWorkLog,
  editorErrorMessages,
  errorMessages,
  exportingReportType,
  handleDependencyDeleteDialogVisibility,
  handleEffortPlanDeleteDialogVisibility,
  handleWorkLogDeleteDialogVisibility,
  handleWorkingDayDeleteDialogVisibility,
  initialize,
  isDeletingDependency,
  isDeletingEffortPlan,
  isDeletingWorkLog,
  isDeletingWorkingDay,
  isBaselineCreateDialogOpen,
  isBaselineMutating,
  isCreatingBaseline,
  isDependencyEditorOpen,
  isDependencyMutating,
  isEditorOpen,
  isEffortPlanDialogOpen,
  isLoading,
  isLoadingEarnedValue,
  isLoadingEffortPlans,
  isLoadingWorkload,
  isLoadingWorkLogs,
  isLoadingWorkingCalendar,
  isSavingDependency,
  isSavingEffortPlan,
  isSaving,
  isSavingWorkLog,
  isSavingWorkingDay,
  isWorkLogDialogOpen,
  isWorkingCalendarMutating,
  isWorkingDayEditorOpen,
  milestoneCount,
  openBaselineCreateDialog,
  openBoard,
  openDependencyEditor,
  openEffortPlanDialog,
  openTaskEditor,
  openWorkLogDialog,
  openWorkingDayEditor,
  parentOptions,
  requestDependencyDelete,
  requestEffortPlanDelete,
  requestWorkLogDelete,
  requestWorkingDayDelete,
  reportExportErrorMessages,
  reportExportSuccessMessage,
  rows,
  saveDependency,
  saveWbsBaseline,
  saveEffortPlan,
  saveWbsTask,
  saveWorkLog,
  saveWorkingDay,
  successMessage,
  summaryCount,
  taskCount,
  wbs,
  workLogEditorErrorMessages,
  workLogList,
  workLogPendingDelete,
  workLogSuccessMessage,
  workLogTask,
  workLogWorkerOptions,
  workload,
  workloadDateRange,
  workloadErrorMessages,
  loadTaskWorkload,
  loadEarnedValueMetrics,
  loadWorkingCalendar,
  selectedWorkingCalendarTarget,
  workingCalendar,
  workingCalendarDateRange,
  workingCalendarEditorErrorMessages,
  workingCalendarErrorMessages,
  workingCalendarSelectedTargetKey,
  workingCalendarSuccessMessage,
  workingCalendarTargetOptions,
  workingDayEditingDay,
  workingDayPendingDelete,
} = useWbsPage();

onBeforeMount(initialize);

const VIEW_OPTIONS = [
  { value: "table", label: "階層表", icon: "i-mdi-table-tree" },
  { value: "gantt", label: "Gantt", icon: "i-mdi-chart-gantt" },
] as const;
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="min-h-[calc(100vh-64px)] bg-[#424242] p-6">
    <div class="mb-4 flex flex-wrap items-center gap-3 text-white">
      <UButton
        :to="{ name: 'ProjectList' }"
        icon="i-mdi-arrow-left"
        variant="ghost"
        square
        size="lg"
        class="size-12 text-inherit hover:bg-white/4"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="Project一覧へ戻る"
      />
      <div>
        <h1 class="text-2xl">{{ wbs?.projectName ?? "WBS" }}</h1>
        <div class="text-sm opacity-70">Boardと同じTaskを使用する階層・予定・実績期間・日別予定実績管理</div>
      </div>
      <UButton icon="i-mdi-view-column-outline" variant="soft" class="ms-auto text-white" :disabled="isLoading" @click="openBoard">
        Boardを開く
      </UButton>
      <UButton icon="i-mdi-refresh" color="primary" variant="soft" :loading="isLoading" @click="initialize">再読込</UButton>
    </div>

    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>

    <UCard v-if="wbs" class="mx-auto max-w-400" :ui="{ body: 'p-0 sm:p-0 not-first:pt-0' }">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-mdi-file-tree-outline" class="size-6" />
          WBS階層表
          <UBadge size="sm" variant="outline" class="ms-auto">Task {{ taskCount }}</UBadge>
          <UBadge size="sm" variant="outline">Summary {{ summaryCount }}</UBadge>
          <UBadge size="sm" variant="outline">Milestone {{ milestoneCount }}</UBadge>
        </div>
      </template>

      <div v-if="rows.length" class="px-4 pt-4 pb-3">
        <UFieldGroup role="group" aria-label="WBS表示形式">
          <UButton
            v-for="option in VIEW_OPTIONS"
            :key="option.value"
            :icon="option.icon"
            size="lg"
            :color="activeView === option.value ? 'primary' : 'neutral'"
            :variant="activeView === option.value ? 'soft' : 'ghost'"
            class="shadow-none"
            :aria-pressed="activeView === option.value"
            @click="activeView = option.value"
          >
            {{ option.label }}
          </UButton>
        </UFieldGroup>
        <p class="mt-2 mb-0 text-xs text-muted">
          階層表から予定・進捗・実績期間と通常Taskの日別予定・実績を管理できます。Gantt上の直接変更はまだ行いません。
        </p>
      </div>

      <div v-if="rows.length && activeView === 'table'" class="overflow-x-auto">
        <table class="wbs-table app-table app-table-hover min-w-320 [&_td]:h-13 [&_td]:py-2 [&_th]:h-13">
          <thead>
            <tr>
              <th scope="col">WBS</th>
              <th scope="col">Task</th>
              <th scope="col">種別</th>
              <th scope="col">Board列</th>
              <th scope="col">予定期間</th>
              <th scope="col">実績期間</th>
              <th scope="col">予定工数</th>
              <th scope="col">進捗</th>
              <th scope="col">担当者</th>
              <th scope="col">優先度</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.taskId">
              <td class="whitespace-nowrap">{{ row.wbsCode || "—" }}</td>
              <!-- 階層の深さを字下げで表す。1階層ごとに24pxずつ右へずらす。 -->
              <td class="min-w-80" :style="{ paddingInlineStart: `${16 + row.depth * 24}px` }">
                <div class="flex items-start gap-2">
                  <UIcon
                    :name="getWbsTaskTypeIcon(row.taskType)"
                    class="mt-1 size-5 shrink-0"
                    :aria-label="getWbsTaskTypeLabel(row.taskType)"
                  />
                  <div>
                    <div :class="row.hasChildren ? 'font-bold' : 'font-medium'">{{ row.title }}</div>
                    <div class="line-clamp-2 max-w-110 text-xs text-muted">{{ row.detail }}</div>
                  </div>
                </div>
              </td>
              <td>
                <UBadge size="xs" variant="outline">{{ getWbsTaskTypeLabel(row.taskType) }}</UBadge>
              </td>
              <td class="whitespace-nowrap">
                <UBadge size="xs">{{ row.taskStatusName }}</UBadge>
              </td>
              <td class="whitespace-nowrap">
                {{ row.plannedStartDate }}<br />
                <span class="text-muted">～ {{ row.plannedEndDate }}</span>
              </td>
              <td class="whitespace-nowrap">{{ formatActualPeriod(row.actualStartDate, row.actualEndDate) }}</td>
              <td class="whitespace-nowrap">{{ formatPlannedEffort(row.plannedEffortMinutes) }}</td>
              <td>
                <div class="grid min-w-37.5 grid-cols-[minmax(80px,1fr)_auto] items-center gap-2">
                  <UProgress
                    :model-value="normalizeProgressPercent(row.progressPercent)"
                    :ui="{ base: 'h-2 rounded-full', indicator: 'rounded-full' }"
                  />
                  <span class="text-xs whitespace-nowrap">{{ formatProgressPercent(row.progressPercent) }}%</span>
                </div>
              </td>
              <td class="whitespace-nowrap">ID: {{ row.assigneeAccountId }}</td>
              <td>
                <UBadge :color="getWbsPriorityColor(row.priority)" size="xs">{{ getWbsPriorityLabel(row.priority) }}</UBadge>
              </td>
              <td>
                <div class="flex gap-1">
                  <UButton
                    v-if="row.taskType === 'TASK'"
                    icon="i-mdi-calendar-clock-outline"
                    color="secondary"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="isLoadingEffortPlans"
                    :aria-label="`${row.title}の日別予定工数を開く`"
                    @click="openEffortPlanDialog(row.taskId)"
                  />
                  <UButton
                    v-if="row.taskType === 'TASK'"
                    icon="i-mdi-timer-edit-outline"
                    color="primary"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="isLoadingWorkLogs"
                    :aria-label="`${row.title}の日別実績工数を開く`"
                    @click="openWorkLogDialog(row.taskId)"
                  />
                  <UButton
                    v-if="canEditWbs"
                    icon="i-mdi-pencil-outline"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="isSaving"
                    :aria-label="`${row.title}のWBS情報を編集`"
                    @click="openTaskEditor(row.taskId)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="rows.length && activeView === 'gantt'" class="overflow-x-auto">
        <Suspense>
          <WbsGanttChart :rows="rows" :dependencies="dependencies" />
          <template #fallback>
            <div class="p-10 text-center">Ganttを読み込んでいます。</div>
          </template>
        </Suspense>
      </div>

      <div v-else class="p-10 text-center">
        <UIcon name="i-mdi-file-tree-outline" class="mb-3 size-12" />
        <h2 class="mb-2 text-xl font-medium">WBSへ表示するTaskがありません</h2>
        <p class="mb-0 text-sm text-muted">TaskをProject Boardへ登録すると、同じTask IDでここに表示されます。</p>
      </div>
    </UCard>

    <WbsBaselineCard
      v-if="wbs"
      :baseline-list="baselineList"
      :active-baseline-detail="activeBaselineDetail"
      :comparison-rows="baselineChangedRows"
      :can-manage="canManageBaselines"
      :is-loading="isLoading"
      :is-mutating="isBaselineMutating"
      :activating-baseline-id="activatingBaselineId"
      :error-messages="baselineErrorMessages"
      :success-message="baselineSuccessMessage"
      @create="openBaselineCreateDialog"
      @activate="activateWbsBaseline"
    />

    <WbsEarnedValueCard
      v-if="wbs"
      :status-date="earnedValueStatusDate"
      :metrics="earnedValue"
      :is-loading="isLoadingEarnedValue"
      :error-messages="earnedValueErrorMessages"
      @load="loadEarnedValueMetrics"
    />

    <WbsReportExportCard
      v-if="wbs"
      :status-date="earnedValueStatusDate"
      :exporting-report-type="exportingReportType"
      :error-messages="reportExportErrorMessages"
      :success-message="reportExportSuccessMessage"
      @download="downloadWbsReport"
    />

    <WorkingCalendarCard
      v-if="wbs"
      :date-range="workingCalendarDateRange"
      :calendar="workingCalendar"
      :target-options="workingCalendarTargetOptions"
      :selected-target-key="workingCalendarSelectedTargetKey"
      :can-edit-selected-target="canEditSelectedWorkingCalendarTarget"
      :is-loading="isLoadingWorkingCalendar"
      :is-mutating="isWorkingCalendarMutating"
      :error-messages="workingCalendarErrorMessages"
      :success-message="workingCalendarSuccessMessage"
      @load="loadWorkingCalendar"
      @edit="openWorkingDayEditor"
      @request-delete="requestWorkingDayDelete"
    />

    <TaskWorkloadCard
      v-if="wbs"
      :date-range="workloadDateRange"
      :workload="workload"
      :is-loading="isLoadingWorkload"
      :error-messages="workloadErrorMessages"
      @load="loadTaskWorkload"
    />

    <UCard v-if="wbs" class="mx-auto mt-4 max-w-400" :ui="{ body: 'p-0 sm:p-0 not-first:pt-0' }">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-mdi-vector-link" class="size-6" />
          Task依存関係
          <UBadge size="sm" variant="outline">{{ dependencyRows.length }}件</UBadge>
          <UButton
            v-if="canEditWbs"
            icon="i-mdi-link-plus"
            color="primary"
            variant="soft"
            class="ms-auto"
            :disabled="dependencyTaskOptions.length < 2 || isDependencyMutating"
            @click="openDependencyEditor"
          >
            依存関係を追加
          </UButton>
        </div>
      </template>

      <div v-if="dependencyRows.length" class="overflow-x-auto">
        <table class="app-table app-table-hover min-w-205 [&_td]:h-13 [&_th]:h-13">
          <thead>
            <tr>
              <th scope="col">先行Task</th>
              <th scope="col">後続Task</th>
              <th scope="col">依存種別</th>
              <th scope="col">待ち時間</th>
              <th v-if="canEditWbs" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dependency in dependencyRows" :key="dependency.dependencyId">
              <td>{{ dependency.predecessorLabel }}</td>
              <td>
                <UIcon name="i-mdi-arrow-right" class="me-2 size-5 align-middle" />
                {{ dependency.successorLabel }}
              </td>
              <td><UBadge size="xs" variant="outline">Finish-to-Start</UBadge></td>
              <td>{{ dependency.lagMinutes }}分</td>
              <td v-if="canEditWbs">
                <UButton
                  icon="i-mdi-link-variant-remove"
                  color="error"
                  size="sm"
                  variant="ghost"
                  square
                  :disabled="isDependencyMutating"
                  :aria-label="`${dependency.predecessorLabel}から${dependency.successorLabel}への依存関係を削除`"
                  @click="requestDependencyDelete(dependency.dependencyId)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="p-8 text-center">
        <UIcon name="i-mdi-vector-link" class="mb-2 size-10" />
        <p class="mb-0 text-sm text-muted">Task依存関係はまだ登録されていません。</p>
      </div>
    </UCard>

    <WbsTaskEditDialog
      :open="isEditorOpen"
      :task="editingTask"
      :parent-options="parentOptions"
      :is-saving="isSaving"
      :error-messages="editorErrorMessages"
      @close="closeTaskEditor"
      @save="saveWbsTask"
    />

    <WbsBaselineCreateDialog
      :open="isBaselineCreateDialogOpen"
      :is-saving="isCreatingBaseline"
      :error-messages="baselineEditorErrorMessages"
      @close="closeBaselineCreateDialog"
      @save="saveWbsBaseline"
    />

    <WbsDependencyCreateDialog
      :open="isDependencyEditorOpen"
      :task-options="dependencyTaskOptions"
      :is-saving="isSavingDependency"
      :error-messages="dependencyEditorErrorMessages"
      @close="closeDependencyEditor"
      @save="saveDependency"
    />

    <TaskEffortPlanDialog
      :open="isEffortPlanDialogOpen"
      :task="effortPlanTask"
      :effort-plan-list="effortPlanList"
      :editing-effort-plan="editingEffortPlan"
      :assignee-options="effortPlanAssigneeOptions"
      :current-account-id="currentAccountId"
      :can-edit="canEditSelectedEffortPlanTask"
      :can-manage-any-effort-plan="canManageAnyEffortPlan"
      :is-loading="isLoadingEffortPlans"
      :is-saving="isSavingEffortPlan"
      :is-deleting="isDeletingEffortPlan"
      :error-messages="effortPlanEditorErrorMessages"
      :success-message="effortPlanSuccessMessage"
      @close="closeEffortPlanDialog"
      @save="saveEffortPlan"
      @edit="editEffortPlan"
      @cancel-edit="cancelEffortPlanEdit"
      @request-delete="requestEffortPlanDelete"
    />

    <TaskWorkLogDialog
      :open="isWorkLogDialogOpen"
      :task="workLogTask"
      :work-log-list="workLogList"
      :editing-work-log="editingWorkLog"
      :worker-options="workLogWorkerOptions"
      :current-account-id="currentAccountId"
      :can-edit="canEditSelectedWorkLogTask"
      :can-manage-any-work-log="canManageAnyWorkLog"
      :is-loading="isLoadingWorkLogs"
      :is-saving="isSavingWorkLog"
      :is-deleting="isDeletingWorkLog"
      :error-messages="workLogEditorErrorMessages"
      :success-message="workLogSuccessMessage"
      @close="closeWorkLogDialog"
      @save="saveWorkLog"
      @edit="editWorkLog"
      @cancel-edit="cancelWorkLogEdit"
      @request-delete="requestWorkLogDelete"
    />

    <WorkingDayEditDialog
      :open="isWorkingDayEditorOpen"
      :day="workingDayEditingDay"
      :target="selectedWorkingCalendarTarget"
      :is-saving="isSavingWorkingDay"
      :error-messages="workingCalendarEditorErrorMessages"
      @close="closeWorkingDayEditor"
      @save="saveWorkingDay"
    />

    <UModal
      :open="workingDayPendingDelete !== null"
      :dismissible="!isDeletingWorkingDay"
      title="稼働日例外を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="handleWorkingDayDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="workingDayPendingDelete">
          {{ workingDayPendingDelete.workDate }}の保存済み例外を削除し、下位の既定値へ戻します。
        </template>
        <template v-else>選択した稼働日例外を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="isDeletingWorkingDay" @click="cancelWorkingDayDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="isDeletingWorkingDay" @click="confirmWorkingDayDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="effortPlanPendingDelete !== null"
      :dismissible="!isDeletingEffortPlan"
      title="Task日別予定を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="handleEffortPlanDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="effortPlanPendingDelete">
          {{ effortPlanPendingDelete.planDate }}・{{ effortPlanPendingDelete.assigneeDisplayName }}の
          {{ effortPlanPendingDelete.plannedEffortMinutes }}分を削除します。
        </template>
        <template v-else>選択したTask日別予定を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="isDeletingEffortPlan" @click="cancelEffortPlanDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="isDeletingEffortPlan" @click="confirmEffortPlanDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="workLogPendingDelete !== null"
      :dismissible="!isDeletingWorkLog"
      title="Task日別実績を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="handleWorkLogDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="workLogPendingDelete">
          {{ workLogPendingDelete.workDate }}・{{ workLogPendingDelete.workerDisplayName }}の
          {{ workLogPendingDelete.actualEffortMinutes }}分を削除します。
        </template>
        <template v-else>選択したTask日別実績を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="isDeletingWorkLog" @click="cancelWorkLogDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="isDeletingWorkLog" @click="confirmWorkLogDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="dependencyPendingDelete !== null"
      :dismissible="!isDeletingDependency"
      title="Task依存関係を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="handleDependencyDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="dependencyPendingDeleteRow">
          「{{ dependencyPendingDeleteRow.predecessorLabel }}」から
          「{{ dependencyPendingDeleteRow.successorLabel }}」への依存関係を削除します。
        </template>
        <template v-else>選択したTask依存関係を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="isDeletingDependency" @click="cancelDependencyDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="isDeletingDependency" @click="confirmDependencyDelete">削除</UButton>
      </template>
    </UModal>
  </div>
</template>
