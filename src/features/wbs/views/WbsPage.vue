<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, reactive } from "vue";

import TaskEffortPlanDialog from "@/features/wbs/components/TaskEffortPlanDialog.vue";
import TaskWorkLogDialog from "@/features/wbs/components/TaskWorkLogDialog.vue";
import TaskWorkloadCard from "@/features/wbs/components/TaskWorkloadCard.vue";
import WorkingCalendarCard from "@/features/wbs/components/WorkingCalendarCard.vue";
import WorkingDayEditDialog from "@/features/wbs/components/WorkingDayEditDialog.vue";
import WbsBaselineCard from "@/features/wbs/components/WbsBaselineCard.vue";
import WbsBaselineCreateDialog from "@/features/wbs/components/WbsBaselineCreateDialog.vue";
import WbsDependencyCard from "@/features/wbs/components/WbsDependencyCard.vue";
import WbsDependencyCreateDialog from "@/features/wbs/components/WbsDependencyCreateDialog.vue";
import WbsEarnedValueCard from "@/features/wbs/components/WbsEarnedValueCard.vue";
import WbsEstimateAccuracyCard from "@/features/wbs/components/WbsEstimateAccuracyCard.vue";
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

// 画面の状態と操作は約140項目あるため、分割代入せず1つの名前で受け取り、templateで`page.`から参照する。
// reactiveで包むと中のref・computedが自動で展開され、templateでも`.value`なしで読み書きできる。
const page = reactive(useWbsPage());

onBeforeMount(page.initialize);

const VIEW_OPTIONS = [
  { value: "table", label: "階層表", icon: "i-mdi-table-tree" },
  { value: "gantt", label: "Gantt", icon: "i-mdi-chart-gantt" },
] as const;
</script>

<template>
  <LoadingIndicator v-if="page.isLoading" />
  <div class="page-surface p-6">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UButton
        :to="{ name: 'ProjectList' }"
        icon="i-mdi-arrow-left"
        variant="ghost"
        square
        size="lg"
        class="size-12 text-inherit"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="Project一覧へ戻る"
      />
      <div>
        <h1 class="text-2xl">{{ page.wbs?.projectName ?? "WBS" }}</h1>
        <div class="text-sm opacity-70">Boardと同じTaskを使用する階層・予定・実績期間・日別予定実績管理</div>
      </div>
      <UButton icon="i-mdi-view-column-outline" variant="soft" class="ms-auto" :disabled="page.isLoading" @click="page.openBoard">
        Boardを開く
      </UButton>
      <UButton icon="i-mdi-refresh" color="primary" variant="soft" :loading="page.isLoading" @click="page.initialize">再読込</UButton>
    </div>

    <StatusAlert v-if="page.errorMessages.length" type="error" class="mb-4">
      <div v-for="message in page.errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="page.successMessage" type="success" class="mb-4">{{ page.successMessage }}</StatusAlert>

    <UCard v-if="page.wbs" class="mx-auto max-w-400" :ui="{ body: 'p-0 sm:p-0 not-first:pt-0' }">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-mdi-file-tree-outline" class="size-6" />
          WBS階層表
          <UBadge size="sm" variant="outline" class="ms-auto">Task {{ page.taskCount }}</UBadge>
          <UBadge size="sm" variant="outline">Summary {{ page.summaryCount }}</UBadge>
          <UBadge size="sm" variant="outline">Milestone {{ page.milestoneCount }}</UBadge>
        </div>
      </template>

      <div v-if="page.rows.length" class="px-4 pt-4 pb-3">
        <UFieldGroup role="group" aria-label="WBS表示形式">
          <UButton
            v-for="option in VIEW_OPTIONS"
            :key="option.value"
            :icon="option.icon"
            size="lg"
            :color="page.activeView === option.value ? 'primary' : 'neutral'"
            :variant="page.activeView === option.value ? 'soft' : 'ghost'"
            class="shadow-none"
            :aria-pressed="page.activeView === option.value"
            @click="page.activeView = option.value"
          >
            {{ option.label }}
          </UButton>
        </UFieldGroup>
        <p class="mt-2 mb-0 text-xs text-muted">
          階層表から予定・進捗・実績期間と通常Taskの日別予定・実績を管理できます。Gantt上の直接変更はまだ行いません。
        </p>
      </div>

      <div v-if="page.rows.length && page.activeView === 'table'" class="overflow-x-auto">
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
            <tr v-for="row in page.rows" :key="row.taskId">
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
              <td class="whitespace-nowrap">{{ page.resolveAssigneeDisplayName(row.assigneeAccountId) }}</td>
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
                    :disabled="page.isLoadingEffortPlans"
                    :aria-label="`${row.title}の日別予定工数を開く`"
                    @click="page.openEffortPlanDialog(row.taskId)"
                  />
                  <UButton
                    v-if="row.taskType === 'TASK'"
                    icon="i-mdi-timer-edit-outline"
                    color="primary"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="page.isLoadingWorkLogs"
                    :aria-label="`${row.title}の日別実績工数を開く`"
                    @click="page.openWorkLogDialog(row.taskId)"
                  />
                  <UButton
                    v-if="page.canEditTask(row)"
                    icon="i-mdi-pencil-outline"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="page.isSaving"
                    :aria-label="`${row.title}のWBS情報を編集`"
                    @click="page.openTaskEditor(row.taskId)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="page.rows.length && page.activeView === 'gantt'" class="overflow-x-auto">
        <Suspense>
          <WbsGanttChart :rows="page.rows" :dependencies="page.dependencies" />
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
      v-if="page.wbs"
      :baseline-list="page.baselineList"
      :active-baseline-detail="page.activeBaselineDetail"
      :comparison-rows="page.baselineChangedRows"
      :can-manage="page.canManageBaselines"
      :is-loading="page.isLoading"
      :is-mutating="page.isBaselineMutating"
      :activating-baseline-id="page.activatingBaselineId"
      :error-messages="page.baselineErrorMessages"
      :success-message="page.baselineSuccessMessage"
      @create="page.openBaselineCreateDialog"
      @activate="page.activateWbsBaseline"
    />

    <WbsEarnedValueCard
      v-if="page.wbs"
      :status-date="page.earnedValueStatusDate"
      :metrics="page.earnedValue"
      :is-loading="page.isLoadingEarnedValue"
      :error-messages="page.earnedValueErrorMessages"
      @load="page.submitEarnedValueMetrics"
    />

    <WbsReportExportCard
      v-if="page.wbs"
      :status-date="page.earnedValueStatusDate"
      :exporting-report-type="page.exportingReportType"
      :error-messages="page.reportExportErrorMessages"
      :success-message="page.reportExportSuccessMessage"
      @download="page.downloadWbsReport"
    />

    <WorkingCalendarCard
      v-if="page.wbs"
      :date-range="page.workingCalendarDateRange"
      :calendar="page.workingCalendar"
      :target-options="page.workingCalendarTargetOptions"
      :selected-target-key="page.workingCalendarSelectedTargetKey"
      :can-edit-selected-target="page.canEditSelectedWorkingCalendarTarget"
      :read-only-message="page.workingCalendarReadOnlyMessage"
      :is-loading="page.isLoadingWorkingCalendar"
      :is-mutating="page.isWorkingCalendarMutating"
      :error-messages="page.workingCalendarErrorMessages"
      :success-message="page.workingCalendarSuccessMessage"
      @load="page.submitWorkingCalendar"
      @edit="page.openWorkingDayEditor"
      @request-delete="page.requestWorkingDayDelete"
    />

    <TaskWorkloadCard
      v-if="page.wbs"
      :date-range="page.workloadDateRange"
      :workload="page.workload"
      :is-loading="page.isLoadingWorkload"
      :error-messages="page.workloadErrorMessages"
      @load="page.submitTaskWorkload"
    />

    <WbsEstimateAccuracyCard
      v-if="page.wbs"
      :estimate-accuracy="page.estimateAccuracy"
      :is-loading="page.isLoadingEstimateAccuracy"
      :error-messages="page.estimateAccuracyErrorMessages"
      @load="page.loadEstimateAccuracy"
    />

    <WbsDependencyCard
      v-if="page.wbs"
      :dependency-rows="page.dependencyRows"
      :can-edit="page.canEditWbs"
      :can-add="page.dependencyTaskOptions.length >= 2"
      :is-mutating="page.isDependencyMutating"
      :error-messages="page.dependencyErrorMessages"
      :success-message="page.dependencySuccessMessage"
      @add="page.openDependencyEditor"
      @request-delete="page.requestDependencyDelete"
    />

    <WbsTaskEditDialog
      :open="page.isEditorOpen"
      :task="page.editingTask"
      :parent-options="page.parentOptions"
      :is-saving="page.isSaving"
      :error-messages="page.editorErrorMessages"
      @close="page.closeTaskEditor"
      @save="page.saveWbsTask"
    />

    <WbsBaselineCreateDialog
      :open="page.isBaselineCreateDialogOpen"
      :is-saving="page.isCreatingBaseline"
      :error-messages="page.baselineEditorErrorMessages"
      @close="page.closeBaselineCreateDialog"
      @save="page.saveWbsBaseline"
    />

    <WbsDependencyCreateDialog
      :open="page.isDependencyEditorOpen"
      :task-options="page.dependencyTaskOptions"
      :is-saving="page.isSavingDependency"
      :error-messages="page.dependencyEditorErrorMessages"
      @close="page.closeDependencyEditor"
      @save="page.saveDependency"
    />

    <TaskEffortPlanDialog
      :open="page.isEffortPlanDialogOpen"
      :task="page.effortPlanTask"
      :effort-plan-list="page.effortPlanList"
      :editing-effort-plan="page.editingEffortPlan"
      :assignee-options="page.effortPlanAssigneeOptions"
      :current-account-id="page.currentAccountId"
      :can-edit="page.canEditSelectedEffortPlanTask"
      :can-manage-any-effort-plan="page.canManageAnyEffortPlan"
      :is-loading="page.isLoadingEffortPlans"
      :is-saving="page.isSavingEffortPlan"
      :is-deleting="page.isDeletingEffortPlan"
      :error-messages="page.effortPlanEditorErrorMessages"
      :success-message="page.effortPlanSuccessMessage"
      @close="page.closeEffortPlanDialog"
      @save="page.saveEffortPlan"
      @edit="page.editEffortPlan"
      @cancel-edit="page.cancelEffortPlanEdit"
      @request-delete="page.requestEffortPlanDelete"
    />

    <TaskWorkLogDialog
      :open="page.isWorkLogDialogOpen"
      :task="page.workLogTask"
      :work-log-list="page.workLogList"
      :editing-work-log="page.editingWorkLog"
      :worker-options="page.workLogWorkerOptions"
      :current-account-id="page.currentAccountId"
      :can-edit="page.canEditSelectedWorkLogTask"
      :can-manage-any-work-log="page.canManageAnyWorkLog"
      :is-loading="page.isLoadingWorkLogs"
      :is-saving="page.isSavingWorkLog"
      :is-deleting="page.isDeletingWorkLog"
      :error-messages="page.workLogEditorErrorMessages"
      :success-message="page.workLogSuccessMessage"
      @close="page.closeWorkLogDialog"
      @save="page.saveWorkLog"
      @edit="page.editWorkLog"
      @cancel-edit="page.cancelWorkLogEdit"
      @request-delete="page.requestWorkLogDelete"
    />

    <WorkingDayEditDialog
      :open="page.isWorkingDayEditorOpen"
      :day="page.workingDayEditingDay"
      :target="page.selectedWorkingCalendarTarget"
      :target-display-name="page.selectedWorkingCalendarTargetDisplayName"
      :is-saving="page.isSavingWorkingDay"
      :error-messages="page.workingCalendarEditorErrorMessages"
      @close="page.closeWorkingDayEditor"
      @save="page.saveWorkingDay"
    />

    <UModal
      :open="page.workingDayPendingDelete !== null"
      :dismissible="!page.isDeletingWorkingDay"
      title="稼働日例外を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="page.handleWorkingDayDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="page.workingDayPendingDelete">
          {{ page.workingDayPendingDelete.workDate }}の保存済み例外を削除し、下位の既定値へ戻します。
        </template>
        <template v-else>選択した稼働日例外を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="page.isDeletingWorkingDay" @click="page.cancelWorkingDayDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="page.isDeletingWorkingDay" @click="page.confirmWorkingDayDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="page.effortPlanPendingDelete !== null"
      :dismissible="!page.isDeletingEffortPlan"
      title="Task日別予定を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="page.handleEffortPlanDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="page.effortPlanPendingDelete">
          {{ page.effortPlanPendingDelete.planDate }}・{{ page.effortPlanPendingDelete.assigneeDisplayName }}の
          {{ page.effortPlanPendingDelete.plannedEffortMinutes }}分を削除します。
        </template>
        <template v-else>選択したTask日別予定を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="page.isDeletingEffortPlan" @click="page.cancelEffortPlanDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="page.isDeletingEffortPlan" @click="page.confirmEffortPlanDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="page.workLogPendingDelete !== null"
      :dismissible="!page.isDeletingWorkLog"
      title="Task日別実績を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="page.handleWorkLogDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="page.workLogPendingDelete">
          {{ page.workLogPendingDelete.workDate }}・{{ page.workLogPendingDelete.workerDisplayName }}の
          {{ page.workLogPendingDelete.actualEffortMinutes }}分を削除します。
        </template>
        <template v-else>選択したTask日別実績を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="page.isDeletingWorkLog" @click="page.cancelWorkLogDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="page.isDeletingWorkLog" @click="page.confirmWorkLogDelete">削除</UButton>
      </template>
    </UModal>

    <UModal
      :open="page.dependencyPendingDelete !== null"
      :dismissible="!page.isDeletingDependency"
      title="Task依存関係を削除"
      :ui="{ content: 'max-w-140' }"
      @update:open="page.handleDependencyDeleteDialogVisibility"
    >
      <template #body>
        <template v-if="page.dependencyPendingDeleteRow">
          「{{ page.dependencyPendingDeleteRow.predecessorLabel }}」から
          「{{ page.dependencyPendingDeleteRow.successorLabel }}」への依存関係を削除します。
        </template>
        <template v-else>選択したTask依存関係を削除します。</template>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="page.isDeletingDependency" @click="page.cancelDependencyDelete">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="page.isDeletingDependency" @click="page.confirmDependencyDelete">削除</UButton>
      </template>
    </UModal>
  </div>
</template>
