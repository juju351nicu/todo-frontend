<script setup lang="ts">
import { computed } from "vue";

import type {
  HumanEstimateForm,
  TaskEstimateListResponse,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  buildHumanEstimateForm,
  ESTIMATE_ASSISTANCE_MODE_OPTIONS,
  formatEstimateAssistanceMode,
  formatTaskEstimateRange,
  formatTaskEstimateSource,
} from "@/features/wbs/utils/taskEstimate";
import { formatWbsTaskDialogTitle } from "@/features/wbs/utils/wbsDialog";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";
import { formatShortDateTime } from "@/shared/utils/dateTime";

/** Task見積もりDialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  estimateList: TaskEstimateListResponse | null;
  canCreate: boolean;
  isLoading: boolean;
  isSaving: boolean;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: HumanEstimateForm];
}>();

const isBusy = computed(() => props.isLoading || props.isSaving);
const dialogTitle = computed(() => formatWbsTaskDialogTitle("Task見積もり", props.task));

// 保存後の一覧Responseが変わるたびに空Formへ戻し、直前の見積もりを誤って再送しない。
const { closeDialog, form, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: buildHumanEstimateForm(),
  syncSources: [() => props.open, () => props.estimateList],
  buildForm: () => (props.open ? buildHumanEstimateForm() : undefined),
  isBusy,
  canSubmit: () => props.canCreate,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isBusy"
    :title="dialogTitle"
    :ui="{ content: 'max-w-255' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </StatusAlert>

      <div v-if="isLoading" class="flex flex-col gap-3">
        <USkeleton class="h-6 w-1/3" />
        <USkeleton class="h-28 w-full" />
        <USkeleton v-for="row in 3" :key="row" class="h-10 w-full" />
      </div>
      <template v-else-if="task">
        <UCard v-if="canCreate" variant="outline" class="mb-5">
          <template #header>
            <div>
              <div class="text-base font-normal">Human Estimateを追加</div>
              <p class="mt-1 mb-0 text-xs text-muted">
                AI提案を見る前の見積もりを履歴へ追加します。正式予定工数は変更しません。
              </p>
            </div>
          </template>
          <form @submit.prevent="submitForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="想定するAI支援">
                  <USelect
                    v-model="form.assistanceMode"
                    :items="ESTIMATE_ASSISTANCE_MODE_OPTIONS"
                    label-key="title"
                    value-key="value"
                    :disabled="isSaving"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="最頻値・単一点（分）" help="必須。1分以上の整数です。">
                  <UInput
                    v-model.nullable="form.estimateLikelyMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isSaving"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="楽観値（分）" help="単一点見積もりでは空欄にします。">
                  <UInput
                    v-model.nullable="form.estimateLowMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isSaving"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="悲観値（分）" help="3点見積もりでは楽観値と両方入力します。">
                  <UInput
                    v-model.nullable="form.estimateHighMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isSaving"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </form>
          <template #footer>
            <UButton
              color="primary"
              variant="ghost"
              class="ms-auto"
              :loading="isSaving"
              @click="submitForm"
            >
              見積もりを追加
            </UButton>
          </template>
        </UCard>

        <StatusAlert v-else type="info" variant="soft" class="mb-5">
          このTaskの見積もり履歴は参照できますが、Human
          Estimateを追加する権限または状態ではありません。
        </StatusAlert>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 class="text-base">見積もり履歴</h2>
          <UBadge size="sm" variant="outline">
            {{ estimateList?.estimates.length ?? 0 }} revision
          </UBadge>
        </div>

        <div v-if="estimateList?.estimates.length" class="overflow-x-auto">
          <table class="app-table app-table-hover min-w-230 [&_td]:h-13 [&_th]:h-13">
            <thead>
              <tr>
                <th scope="col">revision</th>
                <th scope="col">作成主体</th>
                <th scope="col">AI支援</th>
                <th scope="col">見積もり（楽観 / 最頻 / 悲観）</th>
                <th scope="col">Task version</th>
                <th scope="col">保存者</th>
                <th scope="col">保存日時</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="estimate in estimateList.estimates" :key="estimate.taskEstimateSnapshotId">
                <td>{{ estimate.revision }}</td>
                <td class="whitespace-nowrap">
                  <UBadge :color="estimate.sourceCode === 'HUMAN' ? 'neutral' : 'info'" size="xs">
                    {{ formatTaskEstimateSource(estimate.sourceCode) }}
                  </UBadge>
                </td>
                <td class="whitespace-nowrap">
                  {{ formatEstimateAssistanceMode(estimate.assistanceMode) }}
                </td>
                <td class="whitespace-nowrap">{{ formatTaskEstimateRange(estimate) }}</td>
                <td>{{ estimate.sourceTaskVersion }}</td>
                <td>{{ estimate.requestedByAccountId }}</td>
                <td class="whitespace-nowrap">{{ formatShortDateTime(estimate.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <StatusAlert v-else type="info" variant="soft">
          このTaskの見積もり履歴はまだありません。
        </StatusAlert>
      </template>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isBusy" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
