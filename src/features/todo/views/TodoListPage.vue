<script setup lang="ts">
import { onBeforeMount } from "vue";

import { formatRemainingDays } from "@/features/task/utils/taskDisplay";
import TodoPriorityBadge from "@/features/todo/components/TodoPriorityBadge.vue";
import TodoSearchCard from "@/features/todo/components/TodoSearchCard.vue";
import {
  buildTodoEditControlKey,
  useTodoListPage,
} from "@/features/todo/composables/useTodoListPage";
import { truncateTodoDetail } from "@/features/todo/utils/todoDisplay";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canWriteTodo,
  completeTodo,
  errorMessages,
  headers,
  initialize,
  isLoading,
  itemsPerPage,
  itemsPerPageOptions,
  search,
  searchTitle,
  selectedDoneFlag,
  showTodoDetail,
  successMessage,
  todoList,
} = useTodoListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </StatusAlert>
  <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>
  <TodoSearchCard
    v-model:search-title="searchTitle"
    v-model:selected-done-flag="selectedDoneFlag"
    @search="search"
  />
  <br />
  <AppDataTable
    v-model:items-per-page="itemsPerPage"
    :headers="headers"
    :items="todoList"
    item-value="todoId"
    :items-per-page-options="itemsPerPageOptions"
    class="rounded-sm ring ring-default"
  >
    <template #priority-cell="{ item }">
      <TodoPriorityBadge :priority="item.priority" size="md" />
    </template>
    <template #remainingDays-cell="{ item }">
      {{ formatRemainingDays(item.remainingDays) }}
    </template>
    <template #detail-cell="{ item }">
      <span>{{ truncateTodoDetail(item.detail) }}</span>
    </template>
    <template #doneFlag-cell="{ item }">
      {{ item.doneFlag ? "完了" : "未完了" }}
    </template>
    <template #actions-cell="{ item }">
      <div class="flex">
        <UButton
          :icon="canWriteTodo(item) ? 'i-mdi-pencil' : 'i-mdi-eye'"
          size="xs"
          square
          class="m-1 size-8"
          :aria-label="canWriteTodo(item) ? `「${item.title}」を編集` : `「${item.title}」を表示`"
          :data-todo-control="buildTodoEditControlKey(item.todoId)"
          @click="showTodoDetail(item)"
        />
        <UButton
          v-if="canWriteTodo(item)"
          icon="i-mdi-check"
          size="xs"
          square
          class="m-1 size-8"
          :aria-label="`「${item.title}」を完了`"
          :disabled="item.doneFlag"
          @click="completeTodo(item)"
        />
      </div>
    </template>
  </AppDataTable>
</template>
