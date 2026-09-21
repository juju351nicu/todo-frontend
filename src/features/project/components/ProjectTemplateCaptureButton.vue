<script setup lang="ts">
import { computed, toRef } from "vue";

import { useProjectTemplateCapture } from "@/features/project/composables/useProjectTemplateCapture";

const props = withDefaults(
  defineProps<{
    projectId: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const {
  baseDate,
  capture,
  close,
  errorMessage,
  isOpen,
  isSaving,
  name,
  open,
  successMessage,
} = useProjectTemplateCapture(
  toRef(props, "projectId"),
  toRef(props, "disabled")
);
const canCapture = computed(
  () =>
    !props.disabled &&
    !isSaving.value &&
    name.value.trim().length > 0 &&
    name.value.trim().length <= 100 &&
    baseDate.value.length > 0
);
</script>

<template>
  <div>
    <v-alert
      v-if="successMessage"
      type="success"
      density="compact"
      closable
      class="mb-3"
    >
      {{ successMessage }}
      <template #append>
        <v-btn
          :to="{ name: 'ProjectTemplates' }"
          size="small"
          variant="text"
        >
          Templateを確認
        </v-btn>
      </template>
    </v-alert>
    <v-btn
      variant="tonal"
      prepend-icon="mdi-content-save-all-outline"
      :disabled="disabled"
      @click="open"
    >
      ProjectをTemplateとして保存
    </v-btn>
  </div>

  <v-dialog v-model="isOpen" max-width="560" :persistent="isSaving">
    <v-card>
      <v-card-title>ProjectをTemplateとして保存</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          member role、Board列、WBS Task階層、checklist、Task依存関係を本人専用Templateへ保存します。
          コメント、進捗、実績、calendar、baseline、EVM、勤怠は含みません。
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
        />
        <v-text-field
          v-model="baseDate"
          label="Task日付の基準日"
          type="date"
          persistent-hint
          hint="各Taskの開始日・期限は、この日からの差として保存されます。"
          :disabled="isSaving"
          @keydown.enter.prevent="capture"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="close">キャンセル</v-btn>
        <v-btn
          color="primary"
          :loading="isSaving"
          :disabled="!canCapture"
          @click="capture"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
