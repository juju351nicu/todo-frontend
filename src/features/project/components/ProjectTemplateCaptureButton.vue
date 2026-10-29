<script setup lang="ts">
import { toRef } from "vue";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import {
  CAPTURE_NAME_CONTROL,
  useProjectTemplateCapture,
} from "@/features/project/composables/useProjectTemplateCapture";
import { PROJECT_TEMPLATE_NAME_MAX_LENGTH } from "@/features/project/constants/projectLimits";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = withDefaults(
  defineProps<{
    projectId: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const {
  baseDate,
  canCapture,
  capture,
  close,
  errorMessages,
  isOpen,
  isSaving,
  name,
  open,
  successMessage,
} = useProjectTemplateCapture(toRef(props, "projectId"), toRef(props, "disabled"));
</script>

<template>
  <div>
    <StatusAlert
      v-if="successMessage"
      type="success"
      density="compact"
      closable
      class="mb-3"
      @close="successMessage = ''"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="flex-1">{{ successMessage }}</span>
        <UButton
          :to="{ name: ROUTE_NAMES.projectTemplates }"
          size="sm"
          variant="ghost"
          class="text-inherit"
          >Templateを確認</UButton
        >
      </div>
    </StatusAlert>
    <UButton
      variant="soft"
      icon="i-mdi-content-save-all-outline"
      :disabled="disabled"
      @click="open"
    >
      ProjectをTemplateとして保存
    </UButton>
  </div>

  <UModal
    v-model:open="isOpen"
    :dismissible="!isSaving"
    title="ProjectをTemplateとして保存"
    :ui="{ content: 'max-w-140' }"
  >
    <template #body>
      <p class="mb-4 text-sm text-muted">
        member role、Board列、WBS Task階層、checklist、Task依存関係を本人専用Templateへ保存します。
        コメント、進捗、実績、calendar、baseline、EVM、勤怠は含みません。
      </p>
      <StatusAlert v-if="errorMessages.length" type="error" density="compact" class="mb-3">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <div class="relative">
        <UFormField label="Template名">
          <UInput
            v-model="name"
            :maxlength="PROJECT_TEMPLATE_NAME_MAX_LENGTH"
            autofocus
            :disabled="isSaving"
            class="w-full"
            :data-project-template-capture="CAPTURE_NAME_CONTROL"
          />
        </UFormField>
        <FieldCounter :value="name" :max="PROJECT_TEMPLATE_NAME_MAX_LENGTH" />
      </div>
      <UFormField
        label="Task日付の基準日"
        help="各Taskの開始日・期限は、この日からの差として保存されます。"
      >
        <UInput
          v-model="baseDate"
          type="date"
          :disabled="isSaving"
          class="w-full"
          @keydown.enter.prevent="capture"
        />
      </UFormField>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="close">キャンセル</UButton>
      <UButton
        color="primary"
        variant="ghost"
        :loading="isSaving"
        :disabled="!canCapture"
        @click="capture"
        >保存</UButton
      >
    </template>
  </UModal>
</template>
