<script setup lang="ts">
import type { TaskDependencyCreateForm, TaskDependencyTaskOption } from "@/features/wbs/types/wbs";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

/** Task依存関係追加Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  taskOptions: TaskDependencyTaskOption[];
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: TaskDependencyCreateForm];
}>();

const createEmptyForm = (): TaskDependencyCreateForm => ({
  predecessorTaskId: null,
  successorTaskId: null,
  lagMinutes: 0,
});

// Dialogを開くたびに、前回確定または破棄した入力を残さず初期値へ戻す。先行・後続の組合せ検証は親composableが行う。
const { canSubmit, closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: createEmptyForm(),
  syncSources: [() => props.open],
  buildForm: () => (props.open ? createEmptyForm() : undefined),
  isBusy: () => props.isSaving,
  canSubmit: () => props.taskOptions.length >= 2,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isSaving"
    title="Task依存関係を追加"
    :ui="{ content: 'max-w-170' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert type="info" variant="soft" density="compact" class="mb-4">
        Finish-to-Start：先行Taskの終了後に後続Taskを開始します。
      </StatusAlert>
      <form @submit.prevent="submitForm">
        <UFormField label="先行Task">
          <USelect
            :model-value="form.predecessorTaskId ?? undefined"
            :items="taskOptions"
            label-key="title"
            value-key="value"
            :disabled="isSaving"
            class="w-full"
            @update:model-value="form.predecessorTaskId = $event"
          />
        </UFormField>
        <UFormField label="後続Task">
          <USelect
            :model-value="form.successorTaskId ?? undefined"
            :items="taskOptions"
            label-key="title"
            value-key="value"
            :disabled="isSaving"
            class="w-full"
            @update:model-value="form.successorTaskId = $event"
          />
        </UFormField>
        <UFormField label="待ち時間（分）" help="先行Task終了から後続Task開始までの待ち時間です。">
          <!-- 空欄は0ではなく未入力（null）として親composableの検証へ渡す。 -->
          <UInput
            v-model.nullable="form.lagMinutes"
            type="number"
            min="0"
            step="1"
            :disabled="isSaving"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="closeDialog">キャンセル</UButton>
      <UButton
        color="primary"
        variant="ghost"
        :loading="isSaving"
        :disabled="!canSubmit"
        @click="submitForm"
        >追加</UButton
      >
    </template>
  </UModal>
</template>
