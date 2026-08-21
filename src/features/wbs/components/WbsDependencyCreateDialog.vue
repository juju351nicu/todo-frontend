<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  TaskDependencyCreateForm,
  TaskDependencyTaskOption,
} from "@/features/wbs/types/wbs";

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

const form = ref<TaskDependencyCreateForm>({
  predecessorTaskId: null,
  successorTaskId: null,
  lagMinutes: 0,
});
const canSubmit = computed(
  () => props.taskOptions.length >= 2 && !props.isSaving
);

/** Dialogを開くたびに、前回確定または破棄した入力を残さず初期値へ戻す。 */
const resetFormWhenOpened = (open: boolean): void => {
  if (open) {
    form.value = {
      predecessorTaskId: null,
      successorTaskId: null,
      lagMinutes: 0,
    };
  }
};

watch(() => props.open, resetFormWhenOpened, { immediate: true });

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

/** 現在の入力値を複製し、検証とAPI送信を担当する親composableへ渡す。 */
const submitForm = (): void => {
  if (canSubmit.value) {
    emit("save", { ...form.value });
  }
};
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="680"
    :persistent="isSaving"
    @update:model-value="handleDialogModelValue"
  >
    <v-card>
      <v-card-title>Task依存関係を追加</v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>

        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          Finish-to-Start：先行Taskの終了後に後続Taskを開始します。
        </v-alert>

        <v-form @submit.prevent="submitForm">
          <v-select
            v-model="form.predecessorTaskId"
            label="先行Task"
            :items="taskOptions"
            :disabled="isSaving"
          />
          <v-select
            v-model="form.successorTaskId"
            label="後続Task"
            :items="taskOptions"
            :disabled="isSaving"
          />
          <v-text-field
            v-model.number="form.lagMinutes"
            label="待ち時間（分）"
            type="number"
            min="0"
            step="1"
            :disabled="isSaving"
            hint="先行Task終了から後続Task開始までの待ち時間です。"
            persistent-hint
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="closeDialog">キャンセル</v-btn>
        <v-btn
          color="primary"
          :loading="isSaving"
          :disabled="!canSubmit"
          @click="submitForm"
        >
          追加
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
