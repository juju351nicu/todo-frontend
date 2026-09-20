<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import { useMyTasksPage } from "@/features/task/composables/useMyTasksPage";
import {
  formatMyTaskRemainingDays,
  getTodoPriorityColor,
  getTodoPriorityLabel,
} from "@/features/task/utils/taskDisplay";

const {
  canCompleteTasks,
  completeTask,
  errorMessages,
  groups,
  isLoading,
  loadTasks,
  myTasks,
  selectedFilter,
  showTask,
  visibleTasks,
} = useMyTasksPage();

onBeforeMount(loadTasks);
</script>

<template>
  <AppHeader />
  <v-container fluid class="my-tasks-page">
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">Work Management</div>
        <h1 class="text-h4 font-weight-bold">My Tasks</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          自分が担当する未完了Taskを期限順に確認できます。
        </p>
      </div>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        aria-label="My Tasksを再読み込み"
        title="再読み込み"
        :loading="isLoading"
        @click="loadTasks"
      />
    </div>

    <LoadingIndicator v-if="isLoading" />
    <v-alert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>

    <v-btn-toggle
      v-model="selectedFilter"
      mandatory
      color="primary"
      density="comfortable"
      variant="outlined"
      class="mb-4"
      aria-label="My Tasksの期間"
    >
      <v-btn value="ALL">すべて</v-btn>
      <v-btn value="THIS_WEEK">今週</v-btn>
    </v-btn-toggle>

    <v-alert v-if="!isLoading && visibleTasks.length === 0" type="success" variant="tonal" class="mb-6">
      {{ myTasks.length === 0 ? "未完了の担当Taskはありません。" : "今週が期限のTaskはありません。" }}
    </v-alert>

    <v-row>
      <v-col v-for="group in groups" :key="group.key" cols="12" md="4">
        <v-card class="task-group" variant="outlined">
          <v-card-title class="d-flex align-center text-subtitle-1">
            <v-icon :icon="group.icon" :color="group.color" class="mr-2" />
            {{ group.title }}
            <v-chip :color="group.color" size="small" class="ml-2">
              {{ group.items.length }}
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-list v-if="group.items.length" lines="three" density="compact">
            <v-list-item
              v-for="task in group.items"
              :key="task.taskId"
              class="task-item"
              @click="showTask(task)"
            >
              <v-list-item-title class="font-weight-medium">
                {{ task.title }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ task.projectName }} ・ {{ task.statusName }} ・進捗
                {{ Number(task.progressPercent) }}%
                <br />
                期限 {{ task.dueDate }} ・
                {{ formatMyTaskRemainingDays(task.remainingDays) }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="canCompleteTasks"
                  icon="mdi-check"
                  size="small"
                  variant="text"
                  aria-label="Taskを完了"
                  title="完了"
                  @click.stop="completeTask(task)"
                />
              </template>
              <template #prepend>
                <v-chip
                  :color="getTodoPriorityColor(task.priority)"
                  size="x-small"
                  class="mr-2"
                >
                  {{ getTodoPriorityLabel(task.priority) }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text v-else class="text-medium-emphasis py-6">
            該当するTaskはありません。
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.my-tasks-page {
  max-width: 1440px;
}

.task-group {
  height: 100%;
}

.task-item {
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.task-item:last-child {
  border-bottom: 0;
}
</style>
