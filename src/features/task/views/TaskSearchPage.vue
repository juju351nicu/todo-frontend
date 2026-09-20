<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useTaskSearchPage } from "@/features/task/composables/useTaskSearchPage";
import type { TaskSearchItem } from "@/features/task/types/taskSearch";
import {
  formatMyTaskRemainingDays,
  getTodoPriorityColor,
  getTodoPriorityLabel,
} from "@/features/task/utils/taskDisplay";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  activeSavedView,
  applySavedView,
  cancelDeleteSavedView,
  changeProject,
  columnOptions,
  createSavedView,
  deleteSavedView,
  errorMessages,
  executeSearch,
  filters,
  initialize,
  isBusy,
  isColumnVisible,
  isDeleteConfirmationOpen,
  options,
  resetSearch,
  requestDeleteSavedView,
  savedViewName,
  savedViews,
  selectedSavedViewId,
  showTask,
  successMessage,
  tasks,
  truncated,
  updateSavedView,
  visibleColumns,
} = useTaskSearchPage();

const priorityOptions = [
  { value: 1, title: "低" },
  { value: 2, title: "中" },
  { value: 3, title: "高" },
];

const selectSavedView = (value: number | null): void => {
  void applySavedView(value);
};

const selectProject = (value: number | null): void => {
  void changeProject(value);
};

const openTask = (task: TaskSearchItem): void => {
  void showTask(task);
};

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <v-container fluid class="task-search-page">
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">Work Management</div>
        <h1 class="text-h4 font-weight-bold">Task検索</h1>
        <p class="text-body-2 text-medium-emphasis mt-1 mb-0">
          参照できるProjectのTaskを横断して検索し、よく使う条件を保存できます。
        </p>
      </div>
      <v-btn
        prepend-icon="mdi-refresh"
        variant="text"
        :loading="isBusy"
        @click="initialize"
      >
        再読み込み
      </v-btn>
    </div>

    <LoadingIndicator v-if="isBusy" />
    <v-alert v-if="errorMessages.length" type="error" class="mb-4" closable>
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>
    <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">
      {{ successMessage }}
    </v-alert>

    <v-card variant="outlined" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-bookmark-outline" class="mr-2" />
        Saved View
      </v-card-title>
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-select
              v-model="selectedSavedViewId"
              :items="savedViews"
              item-title="name"
              item-value="savedViewId"
              label="保存した条件"
              clearable
              hide-details
              @update:model-value="selectSavedView"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="savedViewName"
              label="Saved View名"
              maxlength="100"
              counter
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="4" class="d-flex flex-wrap ga-2">
            <v-btn color="primary" prepend-icon="mdi-content-save-plus-outline" @click="createSavedView">
              新規保存
            </v-btn>
            <v-btn
              variant="outlined"
              prepend-icon="mdi-content-save-edit-outline"
              :disabled="!activeSavedView"
              @click="updateSavedView"
            >
              更新
            </v-btn>
            <v-btn
              color="error"
              variant="text"
              prepend-icon="mdi-delete-outline"
              :disabled="!activeSavedView"
              @click="requestDeleteSavedView"
            >
              削除
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-filter-outline" class="mr-2" />
        検索条件
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="filters.keyword"
              label="キーワード"
              placeholder="Task名・説明・Project名／キー"
              clearable
              prepend-inner-icon="mdi-magnify"
              @keydown.enter="executeSearch"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.projectId"
              :items="options.projects"
              item-title="projectName"
              item-value="projectId"
              label="Project"
              clearable
              @update:model-value="selectProject"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item
                  v-bind="itemProps"
                  :subtitle="item.raw.projectKey"
                />
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.assigneeAccountId"
              :items="options.assignees"
              item-title="displayName"
              item-value="accountId"
              label="担当者"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.statusCode"
              :items="options.statuses"
              item-title="statusName"
              item-value="statusCode"
              label="状態"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.priority"
              :items="priorityOptions"
              label="優先度"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field v-model="filters.dueFrom" type="date" label="期限From" />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field v-model="filters.dueTo" type="date" label="期限To" />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="visibleColumns"
              :items="columnOptions"
              item-title="label"
              item-value="code"
              label="表示列（Task名は常に表示）"
              multiple
              chips
              closable-chips
              hide-details
            />
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center justify-end flex-wrap ga-2">
            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetSearch">
              リセット
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-magnify" @click="executeSearch">
              検索
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-if="truncated" type="info" variant="tonal" class="mb-4">
      検索結果が100件を超えたため、先頭100件を表示しています。条件を追加してください。
    </v-alert>
    <v-alert v-if="!isBusy && tasks.length === 0" type="info" variant="tonal" class="mb-4">
      条件に一致するTaskはありません。
    </v-alert>

    <v-card v-if="tasks.length" variant="outlined" class="search-results">
      <v-table hover fixed-header height="min(62vh, 680px)">
        <thead>
          <tr>
            <th>Task</th>
            <th v-if="isColumnVisible('PROJECT')">Project</th>
            <th v-if="isColumnVisible('STATUS')">状態</th>
            <th v-if="isColumnVisible('ASSIGNEE')">担当者</th>
            <th v-if="isColumnVisible('PRIORITY')">優先度</th>
            <th v-if="isColumnVisible('START_DATE')">開始日</th>
            <th v-if="isColumnVisible('DUE_DATE')">期限</th>
            <th v-if="isColumnVisible('PROGRESS')">進捗</th>
            <th v-if="isColumnVisible('DETAIL')">説明</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in tasks"
            :key="task.taskId"
            class="task-row"
            tabindex="0"
            @click="openTask(task)"
            @keydown.enter="openTask(task)"
          >
            <td class="font-weight-medium task-title">{{ task.title }}</td>
            <td v-if="isColumnVisible('PROJECT')">
              <div>{{ task.projectName }}</div>
              <div class="text-caption text-medium-emphasis">{{ task.projectKey }}</div>
            </td>
            <td v-if="isColumnVisible('STATUS')">{{ task.statusName }}</td>
            <td v-if="isColumnVisible('ASSIGNEE')">{{ task.assigneeDisplayName }}</td>
            <td v-if="isColumnVisible('PRIORITY')">
              <v-chip :color="getTodoPriorityColor(task.priority)" size="small">
                {{ getTodoPriorityLabel(task.priority) }}
              </v-chip>
            </td>
            <td v-if="isColumnVisible('START_DATE')">{{ task.dateFrom }}</td>
            <td v-if="isColumnVisible('DUE_DATE')">
              <div>{{ task.dueDate }}</div>
              <div class="text-caption" :class="task.remainingDays < 0 ? 'text-error' : 'text-medium-emphasis'">
                {{ formatMyTaskRemainingDays(task.remainingDays) }}
              </div>
            </td>
            <td v-if="isColumnVisible('PROGRESS')" class="progress-cell">
              <div class="text-caption mb-1">{{ Number(task.progressPercent) }}%</div>
              <v-progress-linear :model-value="Number(task.progressPercent)" color="primary" rounded />
            </td>
            <td v-if="isColumnVisible('DETAIL')" class="task-detail">{{ task.detail || "—" }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="isDeleteConfirmationOpen" max-width="480" persistent>
      <v-card>
        <v-card-title>Saved Viewを削除</v-card-title>
        <v-card-text>
          「{{ activeSavedView?.name }}」を削除します。この操作は取り消せません。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelDeleteSavedView">キャンセル</v-btn>
          <v-btn color="error" @click="deleteSavedView">削除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.task-search-page {
  max-width: 1600px;
}

.search-results {
  overflow: hidden;
}

.task-row {
  cursor: pointer;
}

.task-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.task-title {
  min-width: 240px;
}

.progress-cell {
  min-width: 120px;
}

.task-detail {
  min-width: 280px;
  max-width: 480px;
  white-space: normal;
}
</style>
