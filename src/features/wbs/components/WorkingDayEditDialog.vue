<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  WorkingCalendarDay,
  WorkingCalendarTarget,
  WorkingDayForm,
} from "@/features/wbs/types/wbs";
import {
  buildWorkingDayForm,
  getWorkingDayOverride,
} from "@/features/wbs/utils/workingCalendar";

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
const emptyForm = (): WorkingDayForm => ({
  workDate: "",
  dayType: "WORKING_DAY",
  availableMinutes: 480,
});
const form = ref<WorkingDayForm>(emptyForm());

const editingOverride = computed(() =>
  props.day !== null && props.target !== null
    ? getWorkingDayOverride(props.day, props.target)
    : null
);
const dialogTitle = computed(() =>
  editingOverride.value === null ? "稼働日例外を登録" : "稼働日例外を編集"
);
const targetLabel = computed(() =>
  props.target?.kind === "MEMBER"
    ? `個人例外（アカウントID: ${props.target.accountId}）`
    : "Project共通例外"
);

/** Dialogを開く、対象日を変える、競合再取得するたびにBackend確定値からFormを作り直す。 */
watch(
  () => [props.open, props.day, props.target] as const,
  () => {
    form.value =
      props.open && props.day !== null && props.target !== null
        ? buildWorkingDayForm(props.day, props.target)
        : emptyForm();
  },
  { immediate: true }
);

/** 種別切替時にBackend制約を満たす標準値へ補正し、入力の手戻りを減らす。 */
watch(
  () => form.value.dayType,
  (dayType) => {
    if (dayType === "HOLIDAY") {
      form.value.availableMinutes = 0;
    } else if (form.value.availableMinutes === 0) {
      form.value.availableMinutes = 480;
    }
  }
);

/** 保存中でなければ未確定入力を破棄するよう親composableへ通知する。 */
const closeDialog = (): void => {
  if (!props.isSaving) {
    emit("close");
  }
};

/** Vuetifyが外側クリック等で閉じようとした場合だけ通常のclose処理へ渡す。 */
const handleDialogModelValue = (value: boolean): void => {
  if (!value) {
    closeDialog();
  }
};

/** 現在の入力値を複製し、検証・登録更新を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isSaving && props.day !== null && props.target !== null) {
    emit("save", { ...form.value });
  }
};
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="720"
    :persistent="isSaving"
    @update:model-value="handleDialogModelValue"
  >
    <v-card>
      <v-card-title>{{ dialogTitle }}</v-card-title>
      <v-card-subtitle>{{ targetLabel }}</v-card-subtitle>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>
        <v-form v-if="day" @submit.prevent="submit">
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="form.workDate"
                label="設定日"
                type="date"
                :disabled="isSaving"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="form.dayType"
                label="稼働日種別"
                :items="[
                  { title: '稼働日', value: 'WORKING_DAY' },
                  { title: '休日', value: 'HOLIDAY' },
                ]"
                :disabled="isSaving"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.availableMinutes"
                label="稼働可能時間（分）"
                type="number"
                min="0"
                max="1440"
                step="1"
                :disabled="isSaving || form.dayType === 'HOLIDAY'"
                hint="稼働日は1〜1440分、休日は0分です。"
                persistent-hint
              />
            </v-col>
          </v-row>
          <v-alert type="info" variant="tonal">
            保存した日別例外は、曜日既定値より優先されます。個人例外はProject共通例外よりさらに優先されます。
          </v-alert>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="closeDialog">キャンセル</v-btn>
        <v-btn color="primary" :loading="isSaving" @click="submit">
          {{ editingOverride ? "更新" : "登録" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
