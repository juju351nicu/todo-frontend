<script setup lang="ts">
import { toRef } from "vue";

import { useTaskTemplateCapture } from "@/features/task/composables/useTaskTemplateCapture";
import { TASK_TEMPLATE_NAME_MAX_LENGTH } from "@/features/task/constants/taskLimits";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = withDefaults(
  defineProps<{
    projectId: number;
    taskId: number;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const { canCapture, capture, close, errorMessage, isOpen, isSaving, name, open, successMessage } = useTaskTemplateCapture(
  toRef(props, "projectId"),
  toRef(props, "taskId"),
  toRef(props, "disabled"),
);
</script>

<template>
  <div class="mt-4">
    <StatusAlert v-if="successMessage" type="success" density="compact" closable class="mb-3" @close="successMessage = ''">
      {{ successMessage }}
    </StatusAlert>
    <UButton variant="soft" icon="i-mdi-content-save-outline" :disabled="disabled" @click="open">Templateとして保存</UButton>
  </div>

  <UModal v-model:open="isOpen" :dismissible="!isSaving" title="TaskをTemplateとして保存" :ui="{ content: 'max-w-130' }">
    <template #body>
      <p class="mb-4 text-sm text-muted">Taskの初期値と、未完了のチェック項目を本人専用Templateへ保存します。</p>
      <StatusAlert v-if="errorMessage" type="error" density="compact" class="mb-3">{{ errorMessage }}</StatusAlert>
      <div class="relative">
        <UFormField label="Template名">
          <UInput
            v-model="name"
            :maxlength="TASK_TEMPLATE_NAME_MAX_LENGTH"
            autofocus
            :disabled="isSaving"
            class="w-full"
            @keydown.enter.prevent="capture"
          />
        </UFormField>
        <FieldCounter :value="name" :max="TASK_TEMPLATE_NAME_MAX_LENGTH" />
      </div>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="close">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :loading="isSaving" :disabled="!canCapture" @click="capture">保存</UButton>
    </template>
  </UModal>
</template>
