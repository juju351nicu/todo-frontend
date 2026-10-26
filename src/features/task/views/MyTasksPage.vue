<script setup lang="ts">
import { onBeforeMount } from "vue";

import TodoPriorityBadge from "@/features/task/components/TodoPriorityBadge.vue";
import { useMyTasksPage } from "@/features/task/composables/useMyTasksPage";
import { formatMyTaskRemainingDays } from "@/features/task/utils/taskDisplay";
import TaskTimerActionButton from "@/features/time-tracking/components/TaskTimerActionButton.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canCompleteTasks,
  canStartTimers,
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

const FILTER_OPTIONS = [
  { value: "ALL", label: "すべて" },
  { value: "THIS_WEEK", label: "今週" },
] as const;
</script>

<template>
  <div class="max-w-360 p-4">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="text-xs leading-8 font-medium tracking-[.1666666667em] text-muted uppercase">Work Management</div>
        <h1 class="text-[2.125rem] leading-10 font-bold tracking-[.0073529412em]">My Tasks</h1>
        <p class="mt-1 text-sm text-muted">自分が担当する未完了Taskを期限順に確認できます。</p>
      </div>
      <UButton
        icon="i-mdi-refresh"
        variant="ghost"
        square
        size="lg"
        class="size-12"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="My Tasksを再読み込み"
        title="再読み込み"
        :loading="isLoading"
        @click="loadTasks"
      />
    </div>

    <LoadingIndicator v-if="isLoading" />
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>

    <!-- Vuetifyのv-btn-toggle（outlined・mandatory）と同じく、どちらか1つを必ず選択した状態にする。 -->
    <UFieldGroup class="mb-4" role="group" aria-label="My Tasksの期間">
      <UButton
        v-for="option in FILTER_OPTIONS"
        :key="option.value"
        variant="outline"
        :color="selectedFilter === option.value ? 'primary' : 'neutral'"
        :class="selectedFilter === option.value ? 'bg-primary/12' : ''"
        :aria-pressed="selectedFilter === option.value"
        @click="selectedFilter = option.value"
      >
        {{ option.label }}
      </UButton>
    </UFieldGroup>

    <StatusAlert v-if="!isLoading && visibleTasks.length === 0" type="success" variant="soft" class="mb-6">
      {{ myTasks.length === 0 ? "未完了の担当Taskはありません。" : "今週が期限のTaskはありません。" }}
    </StatusAlert>

    <div class="-m-3 flex flex-wrap">
      <div v-for="group in groups" :key="group.key" class="w-full p-3 md:w-1/3">
        <UCard variant="outline" class="h-full" :ui="{ header: 'border-b border-default', body: 'p-0 sm:p-0 not-first:pt-0' }">
          <template #header>
            <div class="flex items-center text-base font-normal">
              <UIcon :name="group.icon" class="me-2 size-6" :class="`text-${group.color}`" />
              {{ group.title }}
              <UBadge :color="group.color" size="sm" class="ms-2">{{ group.items.length }}</UBadge>
            </div>
          </template>
          <ul v-if="group.items.length" class="py-2">
            <li v-for="task in group.items" :key="task.taskId" class="border-b border-default last:border-b-0">
              <div
                role="button"
                tabindex="0"
                class="flex cursor-pointer items-start px-4 py-1.5 hover:bg-black/4"
                @click="showTask(task)"
                @keydown.enter="showTask(task)"
              >
                <TodoPriorityBadge :priority="task.priority" size="xs" class="me-2 mt-0.5" />
                <span class="min-w-0 flex-1">
                  <span class="block text-base font-medium">{{ task.title }}</span>
                  <span class="line-clamp-2 text-sm text-muted">
                    {{ task.projectName }} ・ {{ task.statusName }} ・進捗 {{ Number(task.progressPercent) }}%
                    <br />
                    期限 {{ task.dueDate }} ・ {{ formatMyTaskRemainingDays(task.remainingDays) }}
                  </span>
                </span>
                <span class="flex items-center gap-1">
                  <TaskTimerActionButton v-if="canStartTimers" :project-id="task.projectId" :task-id="task.taskId" compact />
                  <UButton
                    v-if="canCompleteTasks"
                    icon="i-mdi-check"
                    size="sm"
                    variant="ghost"
                    square
                    aria-label="Taskを完了"
                    title="完了"
                    @click.stop="completeTask(task)"
                  />
                </span>
              </div>
            </li>
          </ul>
          <div v-else class="px-4 py-6 text-muted">該当するTaskはありません。</div>
        </UCard>
      </div>
    </div>
  </div>
</template>
