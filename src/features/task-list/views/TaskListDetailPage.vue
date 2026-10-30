<script setup lang="ts">
import { toRef } from "vue";

import TaskListUpsertConfirm from "@/features/task-list/components/TaskListUpsertConfirm.vue";
import {
  TASK_LIST_SUBMIT_CONTROL,
  useTaskListDetailPage,
} from "@/features/task-list/composables/useTaskListDetailPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = defineProps<{
  id?: number;
}>();

const {
  canAssignTaskOwner,
  canWriteTask,
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
  taskListForm,
} = useTaskListDetailPage(toRef(props, "id"));
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <TaskListUpsertConfirm
    v-if="isShowConfirm"
    :task-list-form="taskListForm"
    @close-modal="closeConfirm"
    @confirm-submit="confirmSubmit"
  />
  <div class="page-container">
    <StatusAlert v-if="loadError" type="error" class="mb-4">{{ loadError }}</StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4">{{
      successMessage
    }}</StatusAlert>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="!canWriteTask" type="info" class="mb-4"
      >このTaskは参照専用です。</StatusAlert
    >
    <UCard class="w-full max-w-200">
      <template #header>
        <span>{{ taskListForm.taskId > 0 ? taskListForm.taskId : " (新規)" }}</span>
      </template>
      <div class="-m-3 flex flex-wrap">
        <div v-if="taskListForm.taskId === 0 && canAssignTaskOwner" class="w-full p-3">
          <UFormField label="対象ユーザ">
            <USelect
              v-model="taskListForm.userId"
              name="userId"
              :items="fullNameItems"
              label-key="userObjLabel"
              value-key="userObjId"
              class="w-full"
            />
          </UFormField>
        </div>
        <div v-if="taskListForm.taskId > 0" class="w-full p-3">
          <UFormField label="対象ユーザー">
            <UInput :model-value="fullName" readonly class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="着手日">
            <UInput
              v-model="taskListForm.dateFrom"
              type="date"
              name="dateFrom"
              :readonly="!canWriteTask"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="期限日">
            <UInput
              v-model="taskListForm.dateTo"
              type="date"
              name="dateTo"
              :readonly="!canWriteTask"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="重要度">
            <USelect
              v-model="taskListForm.priority"
              name="priority"
              :items="priorityItems"
              label-key="priorityLabel"
              value-key="priority"
              :disabled="!canWriteTask"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="完了フラグ">
            <USelect
              v-model="taskListForm.doneFlag"
              name="doneFlag"
              :items="doneFlagItems"
              label-key="doneFlagLabel"
              value-key="doneFlag"
              :disabled="!canWriteTask"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="タイトル">
            <UInput
              v-model="taskListForm.title"
              name="title"
              :readonly="!canWriteTask"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="詳細">
            <UTextarea
              v-model="taskListForm.detail"
              name="detail"
              :rows="5"
              :readonly="!canWriteTask"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="p-3 pt-0">
          <UButton
            v-if="canWriteTask"
            class="me-4"
            color="success"
            type="button"
            :data-task-list-detail-control="TASK_LIST_SUBMIT_CONTROL"
            @click="showConfirm"
          >
            {{ taskListForm.taskId > 0 ? "更新する" : "登録する" }}
          </UButton>
          <UButton v-if="canWriteTask" type="button" @click="clearForm">クリア</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
