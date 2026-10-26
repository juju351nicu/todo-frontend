<script setup lang="ts">
import { computed } from "vue";

import type {
  TaskEffortPlan,
  TaskEffortPlanAssigneeOption,
  TaskEffortPlanForm,
  TaskEffortPlanListResponse,
  WbsTask,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import { buildTaskEffortPlanForm } from "@/features/wbs/utils/taskEffortPlan";
import {
  canMutateOwnedEntry,
  formatWbsTaskDialogTitle,
  getEffortAllocationStatus,
  resolveDefaultAccountId,
} from "@/features/wbs/utils/wbsDialog";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

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

const isMutating = computed<boolean>(() => props.isSaving || props.isDeleting);
const dialogTitle = computed(() => formatWbsTaskDialogTitle("Task日別予定工数", props.task));
const allocationStatus = computed(() => getEffortAllocationStatus(props.effortPlanList?.unallocatedEffortMinutes ?? 0));

// Dialogを開く、編集対象を変える、保存結果を受け取るたびに確定値からFormを作り直す。閉じている間は入力を保持する。
const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: buildTaskEffortPlanForm(null),
  syncSources: [() => props.open, () => props.editingEffortPlan, () => props.effortPlanList],
  buildForm: () =>
    props.open
      ? buildTaskEffortPlanForm(resolveDefaultAccountId(props.task, props.assigneeOptions), props.editingEffortPlan)
      : undefined,
  isBusy: isMutating,
  canSubmit: () => props.canEdit,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isMutating"
    :title="dialogTitle"
    :ui="{ content: 'max-w-255' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>

      <div v-if="isLoading" class="flex flex-col gap-3">
        <USkeleton class="h-6 w-1/3" />
        <USkeleton class="h-4 w-full" />
        <USkeleton v-for="row in 4" :key="row" class="h-10 w-full" />
      </div>
      <template v-else-if="task">
        <UCard v-if="canEdit" variant="outline" class="mb-5">
          <template #header>
            <div class="text-base font-normal">{{ editingEffortPlan ? "日別予定を編集" : "日別予定を登録" }}</div>
          </template>
          <form @submit.prevent="submitForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="予定日">
                  <UInput v-model="form.planDate" type="date" :disabled="isMutating" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="予定工数（分）" help="1日・1予定担当者につき1分以上1440分以下です。">
                  <UInput
                    v-model.nullable="form.plannedEffortMinutes"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    :disabled="isMutating"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="予定担当者">
                  <USelect
                    :model-value="form.assigneeAccountId ?? undefined"
                    :items="assigneeOptions"
                    label-key="title"
                    value-key="value"
                    :disabled="isMutating"
                    class="w-full"
                    @update:model-value="form.assigneeAccountId = $event"
                  />
                </UFormField>
              </div>
            </div>
          </form>
          <template #footer>
            <UButton v-if="editingEffortPlan" variant="ghost" :disabled="isMutating" @click="emit('cancelEdit')">新規登録へ戻る</UButton>
            <UButton
              color="primary"
              variant="ghost"
              class="ms-auto"
              :loading="isSaving"
              :disabled="isDeleting || assigneeOptions.length === 0"
              @click="submitForm"
            >
              {{ editingEffortPlan ? "更新" : "登録" }}
            </UButton>
          </template>
        </UCard>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 class="text-base">登録済み日別予定</h2>
          <UBadge>Task全体 {{ formatEffortMinutes(effortPlanList?.taskPlannedEffortMinutes ?? 0) }}</UBadge>
          <UBadge color="primary">日別合計 {{ formatEffortMinutes(effortPlanList?.totalDailyPlannedEffortMinutes ?? 0) }}</UBadge>
          <UBadge :color="allocationStatus.color">{{ allocationStatus.label }}</UBadge>
          <UBadge size="sm" variant="outline">{{ effortPlanList?.effortPlans.length ?? 0 }}件</UBadge>
        </div>

        <StatusAlert v-if="(effortPlanList?.unallocatedEffortMinutes ?? 0) < 0" type="warning" variant="soft" class="mb-3">
          日別予定合計がTask全体予定を超えています。必要に応じて配賦を調整してください。
        </StatusAlert>

        <div v-if="effortPlanList?.effortPlans.length" class="overflow-x-auto">
          <table class="app-table app-table-hover min-w-195 [&_td]:h-13 [&_th]:h-13">
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
              <tr v-for="effortPlan in effortPlanList.effortPlans" :key="effortPlan.effortPlanId">
                <td class="whitespace-nowrap">{{ effortPlan.planDate }}</td>
                <td>
                  {{ effortPlan.assigneeDisplayName }}
                  <div class="text-xs text-muted">アカウントID: {{ effortPlan.assigneeAccountId }}</div>
                </td>
                <td class="whitespace-nowrap">{{ formatEffortMinutes(effortPlan.plannedEffortMinutes) }}</td>
                <td>{{ effortPlan.version }}</td>
                <td v-if="canEdit">
                  <div
                    v-if="canMutateOwnedEntry(canEdit, canManageAnyEffortPlan, effortPlan.assigneeAccountId, currentAccountId)"
                    class="flex gap-1"
                  >
                    <UButton
                      icon="i-mdi-pencil-outline"
                      size="sm"
                      variant="ghost"
                      square
                      :disabled="isMutating"
                      :aria-label="`${effortPlan.planDate}の予定工数を編集`"
                      @click="emit('edit', effortPlan.effortPlanId)"
                    />
                    <UButton
                      icon="i-mdi-delete-outline"
                      color="error"
                      size="sm"
                      variant="ghost"
                      square
                      :disabled="isMutating"
                      :aria-label="`${effortPlan.planDate}の予定工数を削除`"
                      @click="emit('requestDelete', effortPlan.effortPlanId)"
                    />
                  </div>
                  <span v-else class="text-xs text-muted">参照のみ</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <StatusAlert v-else type="info" variant="soft">このTaskの日別予定工数はまだ登録されていません。</StatusAlert>
      </template>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isMutating" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
