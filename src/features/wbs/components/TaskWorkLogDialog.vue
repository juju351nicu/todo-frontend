<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  TaskWorkLog,
  TaskWorkLogForm,
  TaskWorkLogListResponse,
  TaskWorkLogWorkerOption,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  buildTaskWorkLogForm,
  formatTaskWorkLogEffort,
} from "@/features/wbs/utils/taskWorkLog";

/** Task日別実績Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  workLogList: TaskWorkLogListResponse | null;
  editingWorkLog: TaskWorkLog | null;
  workerOptions: TaskWorkLogWorkerOption[];
  currentAccountId: number | null;
  canEdit: boolean;
  canManageAnyWorkLog: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: TaskWorkLogForm];
  edit: [workLogId: number];
  cancelEdit: [];
  requestDelete: [workLogId: number];
}>();

const form = ref<TaskWorkLogForm>(buildTaskWorkLogForm(null));
const isMutating = computed(() => props.isSaving || props.isDeleting);
const dialogTitle = computed(() =>
  props.task === null
    ? "Task日別実績工数"
    : `Task日別実績工数: ${props.task.wbsCode ? `${props.task.wbsCode} ` : ""}${props.task.title}`
);
const defaultWorkerAccountId = computed(() => {
  const taskAssigneeId = props.task?.assigneeAccountId ?? null;
  return props.workerOptions.some((option) => option.value === taskAssigneeId)
    ? taskAssigneeId
    : props.workerOptions[0]?.value ?? null;
});

/** Dialogを開く、編集対象を変える、保存結果を受け取るたびに確定値からFormを作り直す。 */
const synchronizeForm = (): void => {
  if (!props.open) {
    return;
  }
  form.value = buildTaskWorkLogForm(
    defaultWorkerAccountId.value,
    props.editingWorkLog
  );
};

watch(
  () => [props.open, props.editingWorkLog, props.workLogList] as const,
  synchronizeForm,
  { immediate: true }
);

/** 現在の利用者が対象実績を画面上で更新・削除できるか判定する。Backendを最終認可とする。 */
const canMutateWorkLog = (workLog: TaskWorkLog): boolean =>
  props.canEdit &&
  (props.canManageAnyWorkLog ||
    workLog.workerAccountId === props.currentAccountId);

/** 保存・削除中でなければ未確定入力を破棄するよう親composableへ通知する。 */
const closeDialog = (): void => {
  if (!isMutating.value) {
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
  if (props.canEdit && !isMutating.value) {
    emit("save", { ...form.value });
  }
};
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="980"
    :persistent="isMutating"
    @update:model-value="handleDialogModelValue"
  >
    <v-card>
      <v-card-title>{{ dialogTitle }}</v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4">
          {{ successMessage }}
        </v-alert>

        <v-skeleton-loader v-if="isLoading" type="article, table" />
        <template v-else-if="task">
          <v-card v-if="canEdit" variant="outlined" class="mb-5">
            <v-card-title class="text-subtitle-1">
              {{ editingWorkLog ? "日別実績を編集" : "日別実績を登録" }}
            </v-card-title>
            <v-card-text>
              <v-form @submit.prevent="submitForm">
                <v-row>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model="form.workDate"
                      label="業務日"
                      type="date"
                      :disabled="isMutating"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="form.actualEffortMinutes"
                      label="実績工数（分）"
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      :disabled="isMutating"
                      hint="1日・1作業者につき1分以上1440分以下です。"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="form.workerAccountId"
                      label="作業者"
                      :items="workerOptions"
                      :disabled="isMutating"
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn
                v-if="editingWorkLog"
                :disabled="isMutating"
                @click="emit('cancelEdit')"
              >
                新規登録へ戻る
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                :loading="isSaving"
                :disabled="isDeleting || workerOptions.length === 0"
                @click="submitForm"
              >
                {{ editingWorkLog ? "更新" : "登録" }}
              </v-btn>
            </v-card-actions>
          </v-card>

          <div class="d-flex align-center flex-wrap ga-2 mb-3">
            <h2 class="text-subtitle-1">登録済み日別実績</h2>
            <v-chip color="primary" variant="tonal">
              合計 {{ formatTaskWorkLogEffort(workLogList?.totalActualEffortMinutes ?? 0) }}
            </v-chip>
            <v-chip size="small" variant="outlined">
              {{ workLogList?.workLogs.length ?? 0 }}件
            </v-chip>
          </div>

          <div v-if="workLogList?.workLogs.length" class="work-log-table-scroll">
            <v-table hover class="work-log-table">
              <thead>
                <tr>
                  <th scope="col">業務日</th>
                  <th scope="col">作業者</th>
                  <th scope="col">実績工数</th>
                  <th scope="col">version</th>
                  <th v-if="canEdit" scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="workLog in workLogList.workLogs" :key="workLog.workLogId">
                  <td class="text-no-wrap">{{ workLog.workDate }}</td>
                  <td>
                    {{ workLog.workerDisplayName }}
                    <div class="text-caption text-medium-emphasis">
                      アカウントID: {{ workLog.workerAccountId }}
                    </div>
                  </td>
                  <td class="text-no-wrap">
                    {{ formatTaskWorkLogEffort(workLog.actualEffortMinutes) }}
                  </td>
                  <td>{{ workLog.version }}</td>
                  <td v-if="canEdit">
                    <div v-if="canMutateWorkLog(workLog)" class="d-flex ga-1">
                      <v-btn
                        icon="mdi-pencil-outline"
                        size="small"
                        variant="text"
                        :disabled="isMutating"
                        :aria-label="`${workLog.workDate}の実績工数を編集`"
                        @click="emit('edit', workLog.workLogId)"
                      />
                      <v-btn
                        icon="mdi-delete-outline"
                        color="error"
                        size="small"
                        variant="text"
                        :disabled="isMutating"
                        :aria-label="`${workLog.workDate}の実績工数を削除`"
                        @click="emit('requestDelete', workLog.workLogId)"
                      />
                    </div>
                    <span v-else class="text-caption text-medium-emphasis">
                      参照のみ
                    </span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
          <v-alert v-else type="info" variant="tonal">
            このTaskの日別実績工数はまだ登録されていません。
          </v-alert>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isMutating" @click="closeDialog">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.work-log-table-scroll {
  overflow-x: auto;
}

.work-log-table {
  min-width: 760px;
}
</style>
