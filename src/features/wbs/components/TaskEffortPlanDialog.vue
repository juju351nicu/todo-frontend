<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  TaskEffortPlan,
  TaskEffortPlanAssigneeOption,
  TaskEffortPlanForm,
  TaskEffortPlanListResponse,
  WbsTask,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import { buildTaskEffortPlanForm } from "@/features/wbs/utils/taskEffortPlan";

/** Task日別予定Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  effortPlanList: TaskEffortPlanListResponse | null;
  editingEffortPlan: TaskEffortPlan | null;
  assigneeOptions: TaskEffortPlanAssigneeOption[];
  currentAccountId: number | null;
  canEdit: boolean;
  canManageAnyEffortPlan: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: TaskEffortPlanForm];
  edit: [effortPlanId: number];
  cancelEdit: [];
  requestDelete: [effortPlanId: number];
}>();

const form = ref<TaskEffortPlanForm>(buildTaskEffortPlanForm(null));
const isMutating = computed(() => props.isSaving || props.isDeleting);
const dialogTitle = computed(() =>
  props.task === null
    ? "Task日別予定工数"
    : `Task日別予定工数: ${props.task.wbsCode ? `${props.task.wbsCode} ` : ""}${props.task.title}`
);
const defaultAssigneeAccountId = computed(() => {
  const taskAssigneeId = props.task?.assigneeAccountId ?? null;
  return props.assigneeOptions.some((option) => option.value === taskAssigneeId)
    ? taskAssigneeId
    : props.assigneeOptions[0]?.value ?? null;
});
const allocationStatusColor = computed(() => {
  const unallocated = props.effortPlanList?.unallocatedEffortMinutes ?? 0;
  if (unallocated < 0) {
    return "error";
  }
  return unallocated === 0 ? "success" : "warning";
});
const allocationStatusLabel = computed(() => {
  const unallocated = props.effortPlanList?.unallocatedEffortMinutes ?? 0;
  return unallocated < 0
    ? `過配賦 ${formatEffortMinutes(Math.abs(unallocated))}`
    : `未配賦 ${formatEffortMinutes(unallocated)}`;
});

/** Dialogを開く、編集対象を変える、保存結果を受け取るたびに確定値からFormを作り直す。 */
const synchronizeForm = (): void => {
  if (!props.open) {
    return;
  }
  form.value = buildTaskEffortPlanForm(
    defaultAssigneeAccountId.value,
    props.editingEffortPlan
  );
};

watch(
  () => [props.open, props.editingEffortPlan, props.effortPlanList] as const,
  synchronizeForm,
  { immediate: true }
);

/** 現在の利用者が対象日別予定を画面上で更新・削除できるか判定する。Backendを最終認可とする。 */
const canMutateEffortPlan = (effortPlan: TaskEffortPlan): boolean =>
  props.canEdit &&
  (props.canManageAnyEffortPlan ||
    effortPlan.assigneeAccountId === props.currentAccountId);

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
    max-width="1020"
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
              {{ editingEffortPlan ? "日別予定を編集" : "日別予定を登録" }}
            </v-card-title>
            <v-card-text>
              <v-form @submit.prevent="submitForm">
                <v-row>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model="form.planDate"
                      label="予定日"
                      type="date"
                      :disabled="isMutating"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="form.plannedEffortMinutes"
                      label="予定工数（分）"
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      :disabled="isMutating"
                      hint="1日・1予定担当者につき1分以上1440分以下です。"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="form.assigneeAccountId"
                      label="予定担当者"
                      :items="assigneeOptions"
                      :disabled="isMutating"
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn
                v-if="editingEffortPlan"
                :disabled="isMutating"
                @click="emit('cancelEdit')"
              >
                新規登録へ戻る
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                :loading="isSaving"
                :disabled="isDeleting || assigneeOptions.length === 0"
                @click="submitForm"
              >
                {{ editingEffortPlan ? "更新" : "登録" }}
              </v-btn>
            </v-card-actions>
          </v-card>

          <div class="d-flex align-center flex-wrap ga-2 mb-3">
            <h2 class="text-subtitle-1">登録済み日別予定</h2>
            <v-chip variant="tonal">
              Task全体 {{ formatEffortMinutes(effortPlanList?.taskPlannedEffortMinutes ?? 0) }}
            </v-chip>
            <v-chip color="primary" variant="tonal">
              日別合計 {{ formatEffortMinutes(effortPlanList?.totalDailyPlannedEffortMinutes ?? 0) }}
            </v-chip>
            <v-chip :color="allocationStatusColor" variant="tonal">
              {{ allocationStatusLabel }}
            </v-chip>
            <v-chip size="small" variant="outlined">
              {{ effortPlanList?.effortPlans.length ?? 0 }}件
            </v-chip>
          </div>

          <v-alert
            v-if="(effortPlanList?.unallocatedEffortMinutes ?? 0) < 0"
            type="warning"
            variant="tonal"
            class="mb-3"
          >
            日別予定合計がTask全体予定を超えています。必要に応じて配賦を調整してください。
          </v-alert>

          <div v-if="effortPlanList?.effortPlans.length" class="effort-plan-table-scroll">
            <v-table hover class="effort-plan-table">
              <thead>
                <tr>
                  <th scope="col">予定日</th>
                  <th scope="col">予定担当者</th>
                  <th scope="col">予定工数</th>
                  <th scope="col">version</th>
                  <th v-if="canEdit" scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="effortPlan in effortPlanList.effortPlans"
                  :key="effortPlan.effortPlanId"
                >
                  <td class="text-no-wrap">{{ effortPlan.planDate }}</td>
                  <td>
                    {{ effortPlan.assigneeDisplayName }}
                    <div class="text-caption text-medium-emphasis">
                      アカウントID: {{ effortPlan.assigneeAccountId }}
                    </div>
                  </td>
                  <td class="text-no-wrap">
                    {{ formatEffortMinutes(effortPlan.plannedEffortMinutes) }}
                  </td>
                  <td>{{ effortPlan.version }}</td>
                  <td v-if="canEdit">
                    <div v-if="canMutateEffortPlan(effortPlan)" class="d-flex ga-1">
                      <v-btn
                        icon="mdi-pencil-outline"
                        size="small"
                        variant="text"
                        :disabled="isMutating"
                        :aria-label="`${effortPlan.planDate}の予定工数を編集`"
                        @click="emit('edit', effortPlan.effortPlanId)"
                      />
                      <v-btn
                        icon="mdi-delete-outline"
                        color="error"
                        size="small"
                        variant="text"
                        :disabled="isMutating"
                        :aria-label="`${effortPlan.planDate}の予定工数を削除`"
                        @click="emit('requestDelete', effortPlan.effortPlanId)"
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
            このTaskの日別予定工数はまだ登録されていません。
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
.effort-plan-table-scroll {
  overflow-x: auto;
}

.effort-plan-table {
  min-width: 780px;
}
</style>
