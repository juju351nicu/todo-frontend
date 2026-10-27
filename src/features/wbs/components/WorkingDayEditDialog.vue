<script setup lang="ts">
import { DAY_TYPE_OPTIONS, useWorkingDayEditForm } from "@/features/wbs/composables/useWorkingDayEditForm";
import type { WorkingCalendarDay, WorkingCalendarTarget, WorkingDayForm } from "@/features/wbs/types/wbs";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** 稼働日例外Dialogへ親画面から渡す選択日、対象階層、処理状態。 */
interface Props {
  open: boolean;
  day: WorkingCalendarDay | null;
  target: WorkingCalendarTarget | null;
  /** 個人例外の対象の参加者名。Project共通または不明ならnull。 */
  targetDisplayName: string | null;
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WorkingDayForm];
}>();

// Formの作り直し・種別切替時の補正・表示文言は composable が持ち、ここは描画だけを行う。
const { closeDialog, dialogTitle, editingOverride, form, handleDialogVisibility, submitForm, targetLabel } =
  useWorkingDayEditForm({
    open: () => props.open,
    day: () => props.day,
    target: () => props.target,
    targetDisplayName: () => props.targetDisplayName,
    isSaving: () => props.isSaving,
    onClose: () => emit("close"),
    onSave: (value) => emit("save", value),
  });
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isSaving"
    :title="dialogTitle"
    :description="targetLabel"
    :ui="{ content: 'max-w-180' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <form v-if="day" @submit.prevent="submitForm">
        <div class="-m-3 flex flex-wrap">
          <div class="w-full p-3 md:w-1/3">
            <UFormField label="設定日">
              <UInput v-model="form.workDate" type="date" :disabled="isSaving" class="w-full" />
            </UFormField>
          </div>
          <div class="w-full p-3 md:w-1/3">
            <UFormField label="稼働日種別">
              <USelect
                v-model="form.dayType"
                :items="[...DAY_TYPE_OPTIONS]"
                label-key="title"
                value-key="value"
                :disabled="isSaving"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="w-full p-3 md:w-1/3">
            <UFormField label="稼働可能時間（分）" help="稼働日は1〜1440分、休日は0分です。">
              <UInput
                v-model.nullable="form.availableMinutes"
                type="number"
                min="0"
                max="1440"
                step="1"
                :disabled="isSaving || form.dayType === 'HOLIDAY'"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
        <StatusAlert type="info" variant="soft">
          保存した日別例外は、曜日既定値より優先されます。個人例外はProject共通例外よりさらに優先されます。
        </StatusAlert>
      </form>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="closeDialog">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :loading="isSaving" @click="submitForm">{{ editingOverride ? "更新" : "登録" }}</UButton>
    </template>
  </UModal>
</template>
