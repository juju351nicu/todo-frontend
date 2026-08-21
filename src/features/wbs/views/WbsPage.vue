<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, ref } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import {
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
  errorMessages,
  initialize,
  isLoading,
  milestoneCount,
  openBoard,
  rows,
  summaryCount,
  taskCount,
  wbs,
} = useWbsPage();

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
          Boardと同じTaskを使用する読取り専用の階層表
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
          Ganttは予定期間と進捗の参照専用表示です。日程変更はまだ行いません。
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
                <th scope="col">予定工数</th>
                <th scope="col">進捗</th>
                <th scope="col">担当者</th>
                <th scope="col">優先度</th>
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
          <WbsGanttChart :rows="rows" />
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
