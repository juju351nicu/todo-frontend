<script setup lang="ts">
import { computed, toRef } from "vue";

import { useTaskTemplateCapture } from "@/features/task/composables/useTaskTemplateCapture";

const props = withDefaults(
  defineProps<{
    projectId: number;
    taskId: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const {
  capture,
  close,
  errorMessage,
  isOpen,
  isSaving,
  name,
  open,
  successMessage,
} = useTaskTemplateCapture(
  toRef(props, "projectId"),
  toRef(props, "taskId"),
  toRef(props, "disabled")
);
const canCapture = computed(
  () =>
    !props.disabled &&
    !isSaving.value &&
    name.value.trim().length > 0 &&
    name.value.trim().length <= 100
);
</script>

<template>
  <div class="mt-4">
    <v-alert
      v-if="successMessage"
      type="success"
      density="compact"
      closable
      class="mb-3"
    >
      {{ successMessage }}
    </v-alert>
    <v-btn
      variant="tonal"
      prepend-icon="mdi-content-save-outline"
      :disabled="disabled"
      @click="open"
    >
      Templateとして保存
    </v-btn>
  </div>

  <v-dialog v-model="isOpen" max-width="520" :persistent="isSaving">
    <v-card>
      <v-card-title>TaskをTemplateとして保存</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Taskの初期値と、未完了のチェック項目を本人専用Templateへ保存します。
        </p>
        <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3">
          {{ errorMessage }}
        </v-alert>
        <v-text-field
          v-model="name"
          label="Template名"
          maxlength="100"
          counter
          autofocus
          :disabled="isSaving"
          @keydown.enter.prevent="capture"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="close">キャンセル</v-btn>
        <v-btn color="primary" :loading="isSaving" :disabled="!canCapture" @click="capture">
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
