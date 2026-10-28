<script setup lang="ts">
import { computed } from "vue";

import type {
  TaskWorkLog,
  TaskWorkLogForm,
  TaskWorkLogListResponse,
  TaskWorkLogWorkerOption,
  WbsTask,
} from "@/features/wbs/types/wbs";
import { buildTaskWorkLogForm, formatTaskWorkLogEffort } from "@/features/wbs/utils/taskWorkLog";
import { canMutateOwnedEntry, formatWbsTaskDialogTitle, resolveDefaultAccountId } from "@/features/wbs/utils/wbsDialog";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";

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

const isMutating = computed<boolean>(() => props.isSaving || props.isDeleting);
const dialogTitle = computed(() => formatWbsTaskDialogTitle("Task日別実績工数", props.task));

// Dialogを開く、編集対象を変える、保存結果を受け取るたびに確定値からFormを作り直す。閉じている間は入力を保持する。
const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: buildTaskWorkLogForm(null),
  syncSources: [() => props.open, () => props.editingWorkLog, () => props.workLogList],
  buildForm: () =>
    props.open ? buildTaskWorkLogForm(resolveDefaultAccountId(props.task, props.workerOptions), props.editingWorkLog) : undefined,
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
    :ui="{ content: 'max-w-245' }"
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
            <div class="text-base font-normal">{{ editingWorkLog ? "日別実績を編集" : "日別実績を登録" }}</div>
          </template>
          <form @submit.prevent="submitForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="業務日">
                  <UInput v-model="form.workDate" type="date" :disabled="isMutating" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="実績工数（分）" help="1日・1作業者につき1分以上1440分以下です。">
                  <UInput
                    v-model.nullable="form.actualEffortMinutes"
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
                <UFormField label="作業者">
                  <USelect
                    :model-value="form.workerAccountId ?? undefined"
                    :items="workerOptions"
                    label-key="title"
                    value-key="value"
                    :disabled="isMutating"
                    class="w-full"
                    @update:model-value="form.workerAccountId = $event"
                  />
                </UFormField>
              </div>
            </div>
          </form>
          <template #footer>
            <UButton v-if="editingWorkLog" variant="ghost" :disabled="isMutating" @click="emit('cancelEdit')">新規登録へ戻る</UButton>
            <UButton
              color="primary"
              variant="ghost"
              class="ms-auto"
              :loading="isSaving"
              :disabled="isDeleting || workerOptions.length === 0"
              @click="submitForm"
            >
              {{ editingWorkLog ? "更新" : "登録" }}
            </UButton>
          </template>
        </UCard>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 class="text-base">登録済み日別実績</h2>
          <UBadge color="info">合計 {{ formatTaskWorkLogEffort(workLogList?.totalActualEffortMinutes ?? 0) }}</UBadge>
          <UBadge size="sm" variant="outline">{{ workLogList?.workLogs.length ?? 0 }}件</UBadge>
        </div>

        <div v-if="workLogList?.workLogs.length" class="overflow-x-auto">
          <table class="app-table app-table-hover min-w-190 [&_td]:h-13 [&_th]:h-13">
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
                <td class="whitespace-nowrap">{{ workLog.workDate }}</td>
                <td>
                  {{ workLog.workerDisplayName }}
                  <div class="text-xs text-muted">アカウントID: {{ workLog.workerAccountId }}</div>
                </td>
                <td class="whitespace-nowrap">{{ formatTaskWorkLogEffort(workLog.actualEffortMinutes) }}</td>
                <td>{{ workLog.version }}</td>
                <td v-if="canEdit">
                  <div
                    v-if="canMutateOwnedEntry(canEdit, canManageAnyWorkLog, workLog.workerAccountId, currentAccountId)"
                    class="flex gap-1"
                  >
                    <UButton
                      icon="i-mdi-pencil-outline"
                      size="sm"
                      variant="ghost"
                      square
                      :disabled="isMutating"
                      :aria-label="`${workLog.workDate}の実績工数を編集`"
                      @click="emit('edit', workLog.workLogId)"
                    />
                    <UButton
                      icon="i-mdi-delete-outline"
                      color="error"
                      size="sm"
                      variant="ghost"
                      square
                      :disabled="isMutating"
                      :aria-label="`${workLog.workDate}の実績工数を削除`"
                      @click="emit('requestDelete', workLog.workLogId)"
                    />
                  </div>
                  <span v-else class="text-xs text-muted">参照のみ</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <StatusAlert v-else type="info" variant="soft">このTaskの日別実績工数はまだ登録されていません。</StatusAlert>
      </template>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isMutating" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
