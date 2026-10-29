<script setup lang="ts">
import { onBeforeMount } from "vue";

import { formatRemainingDays } from "@/features/task/utils/taskDisplay";
import TaskListPriorityBadge from "@/features/task-list/components/TaskListPriorityBadge.vue";
import TaskListSearchCard from "@/features/task-list/components/TaskListSearchCard.vue";
import {
  buildTaskListEditControlKey,
  useTaskListPage,
} from "@/features/task-list/composables/useTaskListPage";
import { truncateTaskListDetail } from "@/features/task-list/utils/taskListDisplay";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canWriteTask,
  completeTask,
  errorMessages,
  headers,
  initialize,
  isLoading,
  itemsPerPage,
  itemsPerPageOptions,
  search,
  searchTitle,
  selectedDoneFlag,
  showTaskDetail,
  successMessage,
  taskList,
} = useTaskListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </StatusAlert>
  <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>
  <TaskListSearchCard
    v-model:search-title="searchTitle"
    v-model:selected-done-flag="selectedDoneFlag"
    @search="search"
  />
  <br />
  <AppDataTable
    v-model:items-per-page="itemsPerPage"
    :headers="headers"
    :items="taskList"
    item-value="taskId"
    :items-per-page-options="itemsPerPageOptions"
    class="rounded-sm ring ring-default"
  >
    <template #priority-cell="{ item }">
      <TaskListPriorityBadge :priority="item.priority" size="md" />
    </template>
    <template #remainingDays-cell="{ item }">
      {{ formatRemainingDays(item.remainingDays) }}
    </template>
    <template #detail-cell="{ item }">
      <span>{{ truncateTaskListDetail(item.detail) }}</span>
    </template>
    <template #doneFlag-cell="{ item }">
      {{ item.doneFlag ? "完了" : "未完了" }}
    </template>
    <template #actions-cell="{ item }">
      <div class="flex">
        <UButton
          :icon="canWriteTask(item) ? 'i-mdi-pencil' : 'i-mdi-eye'"
          size="xs"
          square
          class="m-1 size-8"
          :aria-label="canWriteTask(item) ? `「${item.title}」を編集` : `「${item.title}」を表示`"
          :data-task-list-control="buildTaskListEditControlKey(item.taskId)"
          @click="showTaskDetail(item)"
        />
        <UButton
          v-if="canWriteTask(item)"
          icon="i-mdi-check"
          size="xs"
          square
          class="m-1 size-8"
          :aria-label="`「${item.title}」を完了`"
          :disabled="item.doneFlag"
          @click="completeTask(item)"
        />
      </div>
    </template>
  </AppDataTable>
</template>
