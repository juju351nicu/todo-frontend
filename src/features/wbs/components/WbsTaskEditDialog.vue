<script setup lang="ts">
import { computed } from "vue";

import type { WbsParentOption, WbsTask, WbsTaskEditForm, WbsTaskType } from "@/features/wbs/types/wbs";
import { formatWbsTaskDialogTitle } from "@/features/wbs/utils/wbsDialog";
import { buildWbsTaskEditForm } from "@/features/wbs/utils/wbsForm";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

/** WBS Task編集Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  parentOptions: WbsParentOption[];
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WbsTaskEditForm];
}>();

const TASK_TYPE_OPTIONS: { title: string; value: WbsTaskType }[] = [
  { title: "Task", value: "TASK" },
  { title: "Summary", value: "SUMMARY" },
  { title: "Milestone", value: "MILESTONE" },
];

// 選択UI（Reka UI）はnullを未選択として扱うため、最上位（親なし）はTask IDに使われない0で表し、保存前にnullへ戻す。
const ROOT_PARENT_VALUE = 0;
const parentSelectOptions = computed(() =>
  props.parentOptions.map((option) => ({ title: option.title, value: option.value ?? ROOT_PARENT_VALUE })),
);

const dialogTitle = computed(() => formatWbsTaskDialogTitle("WBS Taskを編集", props.task, false));

// Dialogを開くたび、または編集対象が変わるたびに、Backend取得済みTaskから独立した入力フォームを作る。
const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm<WbsTaskEditForm | null>({
  initialForm: null,
  syncSources: [() => props.open, () => props.task],
  buildForm: () => (props.task === null ? null : buildWbsTaskEditForm(props.task)),
  isBusy: () => props.isSaving,
  canSubmit: (value) => value !== null,
  onClose: () => emit("close"),
  onSave: (value) => {
    if (value !== null) {
      emit("save", value);
    }
  },
});
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isSaving"
    :title="dialogTitle"
    :ui="{ content: 'max-w-190' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <template v-if="form">
        <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </StatusAlert>

        <form @submit.prevent="submitForm">
          <div class="-m-3 flex flex-wrap">
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="親Task" help="親にできるのは自分と子孫を除いたSummaryです。">
                <USelect
                  :model-value="form.parentTaskId ?? ROOT_PARENT_VALUE"
                  :items="parentSelectOptions"
                  label-key="title"
                  value-key="value"
                  :disabled="isSaving"
                  class="w-full"
                  @update:model-value="form.parentTaskId = $event === ROOT_PARENT_VALUE ? null : $event"
                />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="Task種別">
                <USelect
                  v-model="form.taskType"
                  :items="TASK_TYPE_OPTIONS"
                  label-key="title"
                  value-key="value"
                  :disabled="isSaving"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <div class="relative">
            <UFormField label="WBSコード">
              <UInput v-model="form.wbsCode" :maxlength="100" :disabled="isSaving" placeholder="例: 1.2.1" class="w-full" />
            </UFormField>
            <FieldCounter :value="form.wbsCode" :max="100" />
          </div>

          <div class="-m-3 flex flex-wrap">
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="予定開始日">
                <UInput v-model="form.plannedStartDate" type="date" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="予定終了日">
                <UInput v-model="form.plannedEndDate" type="date" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="予定工数（分）">
                <UInput v-model.nullable="form.plannedEffortMinutes" type="number" min="0" step="1" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="進捗率（%）">
                <UInput
                  v-model.nullable="form.progressPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  :disabled="isSaving"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <USeparator class="my-4" />
          <div class="mb-2 text-sm font-medium">実績期間（任意）</div>
          <div class="-m-3 flex flex-wrap">
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="実績開始日">
                <UInput v-model="form.actualStartDate" type="date" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="実績終了日">
                <UInput v-model="form.actualEndDate" type="date" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
          </div>
          <p class="-mt-2 mb-4 text-xs text-muted">
            開始日だけで作業中を表します。実績日の保存では進捗率やBoard列を自動変更しません。
          </p>

          <StatusAlert v-if="form.taskType === 'MILESTONE'" type="info" variant="soft">
            Milestoneは予定開始日と終了日を同日にし、予定工数を0分にします。
          </StatusAlert>
        </form>
      </template>
      <template v-else>編集対象のTaskを読み込めませんでした。</template>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="closeDialog">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :loading="isSaving" :disabled="form === null" @click="submitForm">保存</UButton>
    </template>
  </UModal>
</template>
