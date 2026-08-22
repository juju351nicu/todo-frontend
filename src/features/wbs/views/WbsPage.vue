<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, ref } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import TaskEffortPlanDialog from "@/features/wbs/components/TaskEffortPlanDialog.vue";
import TaskWorkLogDialog from "@/features/wbs/components/TaskWorkLogDialog.vue";
import TaskWorkloadCard from "@/features/wbs/components/TaskWorkloadCard.vue";
import WbsDependencyCreateDialog from "@/features/wbs/components/WbsDependencyCreateDialog.vue";
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
import type { WbsViewMode } from "@/features/wbs/types/wbs";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

// Gantt libraryは階層表だけを使う利用者へ配信せず、表示切替時に初めて読み込む。
const WbsGanttChart = defineAsyncComponent(
  () => import("@/features/wbs/components/WbsGanttChart.vue")
);
const activeView = ref<WbsViewMode>("table");

const {
  cancelDependencyDelete,
  cancelEffortPlanDelete,
  cancelEffortPlanEdit,
  cancelWorkLogDelete,
  cancelWorkLogEdit,
  canEditSelectedEffortPlanTask,
  canEditSelectedWorkLogTask,
  canEditWbs,
  canManageAnyEffortPlan,
  canManageAnyWorkLog,
  closeDependencyEditor,
  closeEffortPlanDialog,
  closeTaskEditor,
  closeWorkLogDialog,
  confirmDependencyDelete,
  confirmEffortPlanDelete,
  confirmWorkLogDelete,
  currentAccountId,
  dependencies,
  dependencyEditorErrorMessages,
  dependencyPendingDelete,
  dependencyPendingDeleteRow,
  dependencyRows,
  dependencyTaskOptions,
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
  initialize,
  isDeletingDependency,
  isDeletingEffortPlan,
  isDeletingWorkLog,
  isDependencyEditorOpen,
  isDependencyMutating,
  isEditorOpen,
  isEffortPlanDialogOpen,
  isLoading,
  isLoadingEffortPlans,
  isLoadingWorkload,
  isLoadingWorkLogs,
  isSavingDependency,
  isSavingEffortPlan,
  isSaving,
  isSavingWorkLog,
  isWorkLogDialogOpen,
  milestoneCount,
  openBoard,
  openDependencyEditor,
  openEffortPlanDialog,
  openTaskEditor,
  openWorkLogDialog,
  parentOptions,
  requestDependencyDelete,
  requestEffortPlanDelete,
  requestWorkLogDelete,
  rows,
  saveDependency,
  saveEffortPlan,
  saveWbsTask,
  saveWorkLog,
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
} = useWbsPage();

/** Vuetifyが削除確認Dialogを閉じる場合だけ未確定の削除対象を破棄する。 */
const handleDependencyDeleteDialogModelValue = (value: boolean): void => {
  if (!value) {
    cancelDependencyDelete();
  }
};

/** Vuetifyが日別予定の削除確認Dialogを閉じる場合だけ確認対象を破棄する。 */
const handleEffortPlanDeleteDialogModelValue = (value: boolean): void => {
  if (!value) {
    cancelEffortPlanDelete();
  }
};

/** Vuetifyが日別実績の削除確認Dialogを閉じる場合だけ確認対象を破棄する。 */
const handleWorkLogDeleteDialogModelValue = (value: boolean): void => {
  if (!value) {
    cancelWorkLogDelete();
  }
};

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="pa-6 wbs-page">
    <div class="d-flex align-center flex-wrap ga-3 mb-4">
      <v-btn
        :to="{ name: 'ProjectList' }"
        icon="mdi-arrow-left"
        variant="text"
        aria-label="Project一覧へ戻る"
      />
      <div>
        <h1 class="text-h5">{{ wbs?.projectName ?? "WBS" }}</h1>
        <div class="text-body-2 text-medium-emphasis">
          Boardと同じTaskを使用する階層・予定・実績期間・日別予定実績管理
        </div>
      </div>
      <v-spacer />
      <v-btn
        prepend-icon="mdi-view-column-outline"
        variant="tonal"
        :disabled="isLoading"
        @click="openBoard"
      >
        Boardを開く
      </v-btn>
      <v-btn
        prepend-icon="mdi-refresh"
        color="primary"
        variant="tonal"
        :loading="isLoading"
        @click="initialize"
      >
        再読込
      </v-btn>
    </div>

    <v-alert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>
    <v-alert v-if="successMessage" type="success" class="mb-4">
      {{ successMessage }}
    </v-alert>

    <v-card v-if="wbs" max-width="1600" class="mx-auto">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon icon="mdi-file-tree-outline" />
        WBS階層表
        <v-spacer />
        <v-chip size="small" variant="outlined">Task {{ taskCount }}</v-chip>
        <v-chip size="small" variant="outlined">
          Summary {{ summaryCount }}
        </v-chip>
        <v-chip size="small" variant="outlined">
          Milestone {{ milestoneCount }}
        </v-chip>
      </v-card-title>

      <v-card-text v-if="rows.length" class="pb-3">
        <v-btn-toggle
          v-model="activeView"
          color="primary"
          mandatory
          divided
          aria-label="WBS表示形式"
        >
          <v-btn value="table" prepend-icon="mdi-table-tree">階層表</v-btn>
          <v-btn value="gantt" prepend-icon="mdi-chart-gantt">Gantt</v-btn>
        </v-btn-toggle>
        <p class="text-caption text-medium-emphasis mt-2 mb-0">
          階層表から予定・進捗・実績期間と通常Taskの日別予定・実績を管理できます。Gantt上の直接変更はまだ行いません。
        </p>
      </v-card-text>

      <v-card-text v-if="rows.length && activeView === 'table'" class="pa-0">
        <div class="wbs-table-scroll">
          <v-table class="wbs-table" hover>
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
                <td class="text-no-wrap">{{ row.wbsCode || "—" }}</td>
                <td
                  class="wbs-title-cell"
                  :style="{ paddingInlineStart: `${16 + row.depth * 24}px` }"
                >
                  <div class="d-flex align-start ga-2">
                    <v-icon
                      :icon="getWbsTaskTypeIcon(row.taskType)"
                      size="small"
                      class="mt-1 flex-shrink-0"
                      :aria-label="getWbsTaskTypeLabel(row.taskType)"
                    />
                    <div>
                      <div
                        class="font-weight-medium"
                        :class="{ 'font-weight-bold': row.hasChildren }"
                      >
                        {{ row.title }}
                      </div>
                      <div class="text-caption text-medium-emphasis task-detail">
                        {{ row.detail }}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <v-chip size="x-small" variant="outlined">
                    {{ getWbsTaskTypeLabel(row.taskType) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">
                  <v-chip size="x-small">{{ row.taskStatusName }}</v-chip>
                </td>
                <td class="text-no-wrap">
                  {{ row.plannedStartDate }}<br />
                  <span class="text-medium-emphasis">
                    ～ {{ row.plannedEndDate }}
                  </span>
                </td>
                <td class="text-no-wrap">
                  {{ formatActualPeriod(row.actualStartDate, row.actualEndDate) }}
                </td>
                <td class="text-no-wrap">
                  {{ formatPlannedEffort(row.plannedEffortMinutes) }}
                </td>
                <td>
                  <div class="progress-cell">
                    <v-progress-linear
                      :model-value="normalizeProgressPercent(row.progressPercent)"
                      color="primary"
                      height="8"
                      rounded
                    />
                    <span class="text-caption text-no-wrap">
                      {{ formatProgressPercent(row.progressPercent) }}%
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap">ID: {{ row.assigneeAccountId }}</td>
                <td>
                  <v-chip
                    :color="getWbsPriorityColor(row.priority)"
                    size="x-small"
                  >
                    {{ getWbsPriorityLabel(row.priority) }}
                  </v-chip>
                </td>
                <td>
                  <div class="d-flex ga-1">
                    <v-btn
                      v-if="row.taskType === 'TASK'"
                      icon="mdi-calendar-clock-outline"
                      color="secondary"
                      size="small"
                      variant="text"
                      :disabled="isLoadingEffortPlans"
                      :aria-label="`${row.title}の日別予定工数を開く`"
                      @click="openEffortPlanDialog(row.taskId)"
                    />
                    <v-btn
                      v-if="row.taskType === 'TASK'"
                      icon="mdi-timer-edit-outline"
                      color="primary"
                      size="small"
                      variant="text"
                      :disabled="isLoadingWorkLogs"
                      :aria-label="`${row.title}の日別実績工数を開く`"
                      @click="openWorkLogDialog(row.taskId)"
                    />
                    <v-btn
                      v-if="canEditWbs"
                      icon="mdi-pencil-outline"
                      size="small"
                      variant="text"
                      :disabled="isSaving"
                      :aria-label="`${row.title}のWBS情報を編集`"
                      @click="openTaskEditor(row.taskId)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>

      <v-card-text
        v-else-if="rows.length && activeView === 'gantt'"
        class="pa-0 wbs-gantt-scroll"
      >
        <Suspense>
          <WbsGanttChart :rows="rows" :dependencies="dependencies" />
          <template #fallback>
            <div class="pa-10 text-center">Ganttを読み込んでいます。</div>
          </template>
        </Suspense>
      </v-card-text>

      <v-card-text v-else class="pa-10 text-center">
        <v-icon icon="mdi-file-tree-outline" size="48" class="mb-3" />
        <h2 class="text-h6 mb-2">WBSへ表示するTaskがありません</h2>
        <p class="text-body-2 text-medium-emphasis mb-0">
          TaskをProject Boardへ登録すると、同じTask IDでここに表示されます。
        </p>
      </v-card-text>
    </v-card>

    <TaskWorkloadCard
      v-if="wbs"
      :date-range="workloadDateRange"
      :workload="workload"
      :is-loading="isLoadingWorkload"
      :error-messages="workloadErrorMessages"
      @load="loadTaskWorkload"
    />

    <v-card v-if="wbs" max-width="1600" class="mx-auto mt-4">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon icon="mdi-vector-link" />
        Task依存関係
        <v-chip size="small" variant="outlined">
          {{ dependencyRows.length }}件
        </v-chip>
        <v-spacer />
        <v-btn
          v-if="canEditWbs"
          prepend-icon="mdi-link-plus"
          color="primary"
          variant="tonal"
          :disabled="dependencyTaskOptions.length < 2 || isDependencyMutating"
          @click="openDependencyEditor"
        >
          依存関係を追加
        </v-btn>
      </v-card-title>

      <v-card-text v-if="dependencyRows.length" class="pa-0">
        <div class="wbs-dependency-scroll">
          <v-table class="wbs-dependency-table" hover>
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
              <tr
                v-for="dependency in dependencyRows"
                :key="dependency.dependencyId"
              >
                <td>{{ dependency.predecessorLabel }}</td>
                <td>
                  <v-icon icon="mdi-arrow-right" size="small" class="mr-2" />
                  {{ dependency.successorLabel }}
                </td>
                <td>
                  <v-chip size="x-small" variant="outlined">
                    Finish-to-Start
                  </v-chip>
                </td>
                <td>{{ dependency.lagMinutes }}分</td>
                <td v-if="canEditWbs">
                  <v-btn
                    icon="mdi-link-variant-remove"
                    color="error"
                    size="small"
                    variant="text"
                    :disabled="isDependencyMutating"
                    :aria-label="`${dependency.predecessorLabel}から${dependency.successorLabel}への依存関係を削除`"
                    @click="requestDependencyDelete(dependency.dependencyId)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
      <v-card-text v-else class="pa-8 text-center">
        <v-icon icon="mdi-vector-link" size="40" class="mb-2" />
        <p class="text-body-2 text-medium-emphasis mb-0">
          Task依存関係はまだ登録されていません。
        </p>
      </v-card-text>
    </v-card>

    <WbsTaskEditDialog
      :open="isEditorOpen"
      :task="editingTask"
      :parent-options="parentOptions"
      :is-saving="isSaving"
      :error-messages="editorErrorMessages"
      @close="closeTaskEditor"
      @save="saveWbsTask"
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

    <v-dialog
      :model-value="effortPlanPendingDelete !== null"
      max-width="560"
      :persistent="isDeletingEffortPlan"
      @update:model-value="handleEffortPlanDeleteDialogModelValue"
    >
      <v-card>
        <v-card-title>Task日別予定を削除</v-card-title>
        <v-card-text>
          <template v-if="effortPlanPendingDelete">
            {{ effortPlanPendingDelete.planDate }}・{{ effortPlanPendingDelete.assigneeDisplayName }}の
            {{ effortPlanPendingDelete.plannedEffortMinutes }}分を削除します。
          </template>
          <template v-else>選択したTask日別予定を削除します。</template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isDeletingEffortPlan" @click="cancelEffortPlanDelete">
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            :loading="isDeletingEffortPlan"
            @click="confirmEffortPlanDelete"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="workLogPendingDelete !== null"
      max-width="560"
      :persistent="isDeletingWorkLog"
      @update:model-value="handleWorkLogDeleteDialogModelValue"
    >
      <v-card>
        <v-card-title>Task日別実績を削除</v-card-title>
        <v-card-text>
          <template v-if="workLogPendingDelete">
            {{ workLogPendingDelete.workDate }}・{{ workLogPendingDelete.workerDisplayName }}の
            {{ workLogPendingDelete.actualEffortMinutes }}分を削除します。
          </template>
          <template v-else>選択したTask日別実績を削除します。</template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isDeletingWorkLog" @click="cancelWorkLogDelete">
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            :loading="isDeletingWorkLog"
            @click="confirmWorkLogDelete"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="dependencyPendingDelete !== null"
      max-width="560"
      :persistent="isDeletingDependency"
      @update:model-value="handleDependencyDeleteDialogModelValue"
    >
      <v-card>
        <v-card-title>Task依存関係を削除</v-card-title>
        <v-card-text>
          <template v-if="dependencyPendingDeleteRow">
            「{{ dependencyPendingDeleteRow.predecessorLabel }}」から
            「{{ dependencyPendingDeleteRow.successorLabel }}」への依存関係を削除します。
          </template>
          <template v-else>
            選択したTask依存関係を削除します。
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isDeletingDependency" @click="cancelDependencyDelete">
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            :loading="isDeletingDependency"
            @click="confirmDependencyDelete"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.wbs-page {
  min-height: calc(100vh - 64px);
  background: rgb(var(--v-theme-surface-variant));
}

.wbs-table-scroll {
  overflow-x: auto;
}

.wbs-gantt-scroll {
  overflow-x: auto;
}

.wbs-dependency-scroll {
  overflow-x: auto;
}

.wbs-dependency-table {
  min-width: 820px;
}

.wbs-table {
  min-width: 1280px;
}

.wbs-title-cell {
  min-width: 320px;
}

.task-detail {
  display: -webkit-box;
  max-width: 440px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.progress-cell {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 150px;
}
</style>
