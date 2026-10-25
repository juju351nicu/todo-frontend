<script setup lang="ts">
import type { WbsBaselineCreateForm } from "@/features/wbs/types/wbs";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

/** baseline作成Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WbsBaselineCreateForm];
}>();

const createEmptyForm = (): WbsBaselineCreateForm => ({ name: "", description: "" });

// Dialogを開くたびに、前回の保存済みまたは破棄済み入力を初期化する。
const { canSubmit, closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: createEmptyForm(),
  syncSources: [() => props.open],
  buildForm: () => (props.open ? createEmptyForm() : undefined),
  isBusy: () => props.isSaving,
  canSubmit: (value) => value.name.trim().length > 0,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isSaving"
    title="WBS baselineを作成"
    :ui="{ content: 'max-w-170' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert type="info" variant="soft" density="compact" class="mb-4">
        現在のTask予定、依存関係、日別予定工数を変更不能な比較用snapshotとして保存します。
      </StatusAlert>
      <form @submit.prevent="submitForm">
        <div class="relative">
          <UFormField label="baseline名">
            <UInput v-model="form.name" :maxlength="100" :disabled="isSaving" autofocus class="w-full" />
          </UFormField>
          <FieldCounter :value="form.name" :max="100" />
        </div>
        <div class="relative">
          <UFormField label="説明（任意）">
            <UTextarea v-model="form.description" :maxlength="1000" :rows="4" :disabled="isSaving" class="w-full" />
          </UFormField>
          <FieldCounter :value="form.description" :max="1000" />
        </div>
      </form>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="closeDialog">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :loading="isSaving" :disabled="!canSubmit" @click="submitForm">作成</UButton>
    </template>
  </UModal>
</template>
