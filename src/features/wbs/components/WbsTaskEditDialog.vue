<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  WbsParentOption,
  WbsTask,
  WbsTaskEditForm,
  WbsTaskType,
} from "@/features/wbs/types/wbs";
import { buildWbsTaskEditForm } from "@/features/wbs/utils/wbsForm";

/** WBS Task編集Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  parentOptions: WbsParentOption[];
  isSaving: boolean;
  errorMessages: string[];
}

/** WBS Task種別selectの画面表示名とBackendコード。 */
interface TaskTypeOption {
  title: string;
  value: WbsTaskType;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WbsTaskEditForm];
}>();

const form = ref<WbsTaskEditForm | null>(null);
const taskTypeOptions: TaskTypeOption[] = [
  { title: "Task", value: "TASK" },
  { title: "Summary", value: "SUMMARY" },
  { title: "Milestone", value: "MILESTONE" },
];
const dialogTitle = computed(() =>
  props.task === null ? "WBS Taskを編集" : `WBS Taskを編集: ${props.task.title}`
);

/** Dialogを開くたびにBackend取得済みTaskから独立した入力フォームを作る。 */
const synchronizeForm = (): void => {
  form.value = props.task === null ? null : buildWbsTaskEditForm(props.task);
};

watch(() => [props.open, props.task] as const, synchronizeForm, {
  immediate: true,
});

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
  if (form.value !== null && !props.isSaving) {
    emit("save", { ...form.value });
  }
};
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="760"
    :persistent="isSaving"
    @update:model-value="handleDialogModelValue"
  >
    <v-card>
      <v-card-title>{{ dialogTitle }}</v-card-title>
      <v-card-text v-if="form">
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>

        <v-form @submit.prevent="submitForm">
          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.parentTaskId"
                label="親Task"
                :items="parentOptions"
                :disabled="isSaving"
                hint="親にできるのは自分と子孫を除いたSummaryです。"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.taskType"
                label="Task種別"
                :items="taskTypeOptions"
                :disabled="isSaving"
              />
            </v-col>
          </v-row>

          <v-text-field
            v-model="form.wbsCode"
            label="WBSコード"
            maxlength="100"
            counter
            :disabled="isSaving"
            placeholder="例: 1.2.1"
          />

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.plannedStartDate"
                label="予定開始日"
                type="date"
                :disabled="isSaving"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.plannedEndDate"
                label="予定終了日"
                type="date"
                :disabled="isSaving"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.plannedEffortMinutes"
                label="予定工数（分）"
                type="number"
                min="0"
                step="1"
                :disabled="isSaving"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.progressPercent"
                label="進捗率（%）"
                type="number"
                min="0"
                max="100"
                step="0.01"
                :disabled="isSaving"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">実績期間（任意）</div>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.actualStartDate"
                label="実績開始日"
                type="date"
                :disabled="isSaving"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.actualEndDate"
                label="実績終了日"
                type="date"
                :disabled="isSaving"
                clearable
              />
            </v-col>
          </v-row>
          <p class="text-caption text-medium-emphasis mt-n2 mb-4">
            開始日だけで作業中を表します。実績日の保存では進捗率やBoard列を自動変更しません。
          </p>

          <v-alert
            v-if="form.taskType === 'MILESTONE'"
            type="info"
            variant="tonal"
          >
            Milestoneは予定開始日と終了日を同日にし、予定工数を0分にします。
          </v-alert>
        </v-form>
      </v-card-text>
      <v-card-text v-else>
        編集対象のTaskを読み込めませんでした。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="closeDialog">キャンセル</v-btn>
        <v-btn
          color="primary"
          :loading="isSaving"
          :disabled="form === null"
          @click="submitForm"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
