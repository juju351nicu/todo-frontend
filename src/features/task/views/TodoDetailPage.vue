<script setup lang="ts">
import { toRef } from "vue";

import TodoUpsertConfirm from "@/features/task/components/TodoUpsertConfirm.vue";
import { TODO_SUBMIT_CONTROL, useTodoDetailPage } from "@/features/task/composables/useTodoDetailPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = defineProps<{
  id?: number;
}>();

const {
  canAssignTodoOwner,
  canWriteTodo,
  clearForm,
  closeConfirm,
  confirmSubmit,
  doneFlagItems,
  errorMessages,
  fullName,
  fullNameItems,
  isLoading,
  isShowConfirm,
  loadError,
  priorityItems,
  showConfirm,
  successMessage,
  todoForm,
} = useTodoDetailPage(toRef(props, "id"));
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <TodoUpsertConfirm v-if="isShowConfirm" :todo-form="todoForm" @close-modal="closeConfirm" @confirm-submit="confirmSubmit" />
  <div class="page-container">
    <StatusAlert v-if="loadError" type="error" class="mb-4">{{ loadError }}</StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="!canWriteTodo" type="info" class="mb-4">このTodoは参照専用です。</StatusAlert>
    <UCard class="w-full max-w-200">
      <template #header>
        <span>{{ todoForm.todoId > 0 ? todoForm.todoId : " (新規)" }}</span>
      </template>
      <div class="-m-3 flex flex-wrap">
        <div v-if="todoForm.todoId === 0 && canAssignTodoOwner" class="w-full p-3">
          <UFormField label="対象ユーザ">
            <USelect
              v-model="todoForm.userId"
              name="userId"
              :items="fullNameItems"
              label-key="userObjLabel"
              value-key="userObjId"
              class="w-full"
            />
          </UFormField>
        </div>
        <div v-if="todoForm.todoId > 0" class="w-full p-3">
          <UFormField label="対象ユーザー">
            <UInput :model-value="fullName" readonly class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="着手日">
            <UInput v-model="todoForm.dateFrom" name="dateFrom" :readonly="!canWriteTodo" required class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="期限日">
            <UInput v-model="todoForm.dateTo" name="dateTo" :readonly="!canWriteTodo" required class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="重要度">
            <USelect
              v-model="todoForm.priority"
              name="priority"
              :items="priorityItems"
              label-key="priorityLabel"
              value-key="priority"
              :disabled="!canWriteTodo"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="完了フラグ">
            <USelect
              v-model="todoForm.doneFlag"
              name="doneFlag"
              :items="doneFlagItems"
              label-key="doneFlagLabel"
              value-key="doneFlag"
              :disabled="!canWriteTodo"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="タイトル">
            <UInput v-model="todoForm.title" name="title" :readonly="!canWriteTodo" required class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="詳細">
            <UTextarea v-model="todoForm.detail" name="detail" :rows="5" :readonly="!canWriteTodo" required class="w-full" />
          </UFormField>
        </div>
        <div class="p-3 pt-0">
          <UButton
            v-if="canWriteTodo"
            class="me-4"
            color="success"
            type="button"
            :data-todo-detail-control="TODO_SUBMIT_CONTROL"
            @click="showConfirm"
          >
            {{ todoForm.todoId > 0 ? "更新する" : "登録する" }}
          </UButton>
          <UButton v-if="canWriteTodo" type="button" @click="clearForm">クリア</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
