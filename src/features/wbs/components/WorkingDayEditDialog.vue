<script setup lang="ts">
import { computed, watch } from "vue";

import type { WorkingCalendarDay, WorkingCalendarTarget, WorkingDayForm } from "@/features/wbs/types/wbs";
import { buildWorkingDayForm, getWorkingDayOverride } from "@/features/wbs/utils/workingCalendar";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

/** 稼働日例外Dialogへ親画面から渡す選択日、対象階層、処理状態。 */
interface Props {
  open: boolean;
  day: WorkingCalendarDay | null;
  target: WorkingCalendarTarget | null;
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WorkingDayForm];
}>();

/** 稼働日の既定の稼働可能時間（分）。 */
const DEFAULT_AVAILABLE_MINUTES = 480;

const DAY_TYPE_OPTIONS = [
  { title: "稼働日", value: "WORKING_DAY" },
  { title: "休日", value: "HOLIDAY" },
] as const;

const createEmptyForm = (): WorkingDayForm => ({
  workDate: "",
  dayType: "WORKING_DAY",
  availableMinutes: DEFAULT_AVAILABLE_MINUTES,
});

const editingOverride = computed(() =>
  props.day !== null && props.target !== null ? getWorkingDayOverride(props.day, props.target) : null,
);
const dialogTitle = computed(() => (editingOverride.value === null ? "稼働日例外を登録" : "稼働日例外を編集"));
const targetLabel = computed(() =>
  props.target?.kind === "MEMBER" ? `個人例外（アカウントID: ${props.target.accountId}）` : "Project共通例外",
);

// Dialogを開く、対象日を変える、競合再取得するたびにBackend確定値からFormを作り直す。
const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: createEmptyForm(),
  syncSources: [() => props.open, () => props.day, () => props.target],
  buildForm: () =>
    props.open && props.day !== null && props.target !== null ? buildWorkingDayForm(props.day, props.target) : createEmptyForm(),
  isBusy: () => props.isSaving,
  canSubmit: () => props.day !== null && props.target !== null,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});

// 種別切替時にBackend制約（休日は0分、稼働日は1分以上）を満たす標準値へ補正し、入力の手戻りを減らす。
watch(
  () => form.value.dayType,
  (dayType) => {
    if (dayType === "HOLIDAY") {
      form.value.availableMinutes = 0;
    } else if (form.value.availableMinutes === 0) {
      form.value.availableMinutes = DEFAULT_AVAILABLE_MINUTES;
    }
  },
);
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
