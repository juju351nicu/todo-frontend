<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  AiEstimationConfirmationResponse,
  AiEstimationRequestResponse,
  AiEstimationRequestStatus,
  EstimateAssistanceMode,
  HumanEstimateForm,
  TaskEstimateDecision,
  TaskEstimateDecisionForm,
  TaskEstimateListResponse,
  TaskEstimateOutcomeForm,
  WbsTask,
} from "@/features/wbs/types/wbs";
import {
  buildHumanEstimateForm,
  buildTaskEstimateDecisionForm,
  buildTaskEstimateOutcomeForm,
  ESTIMATE_ASSISTANCE_MODE_OPTIONS,
  ESTIMATE_DECISION_OPTIONS,
  ESTIMATE_VARIANCE_NOTE_MAX_LENGTH,
  ESTIMATE_VARIANCE_REASON_OPTIONS,
  formatEstimateAssistanceMode,
  formatAiEstimateConfidence,
  formatAiEstimationFailure,
  formatAiEstimationStatus,
  formatEstimateVarianceReason,
  formatTaskEstimateDecision,
  formatTaskEstimateRange,
  formatTaskEstimateSource,
} from "@/features/wbs/utils/taskEstimate";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import { formatWbsTaskDialogTitle } from "@/features/wbs/utils/wbsDialog";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";
import { formatShortDateTime } from "@/shared/utils/dateTime";

/** Task見積もりDialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  task: WbsTask | null;
  estimateList: TaskEstimateListResponse | null;
  aiConfirmation: AiEstimationConfirmationResponse | null;
  aiRequest: AiEstimationRequestResponse | null;
  canCreate: boolean;
  canGenerateAi: boolean;
  canDecide: boolean;
  canEvaluate: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeciding: boolean;
  isEvaluating: boolean;
  isLoadingAiConfirmation: boolean;
  isRequestingAi: boolean;
  isRefreshingAi: boolean;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: HumanEstimateForm];
  decide: [form: TaskEstimateDecisionForm];
  evaluate: [form: TaskEstimateOutcomeForm];
  confirmAi: [assistanceMode: EstimateAssistanceMode];
  requestAi: [confirmed: boolean];
  refreshAi: [];
}>();

const isBusy = computed(
  () =>
    props.isLoading ||
    props.isSaving ||
    props.isDeciding ||
    props.isEvaluating ||
    props.isLoadingAiConfirmation ||
    props.isRequestingAi ||
    props.isRefreshingAi
);
const dialogTitle = computed(() => formatWbsTaskDialogTitle("Task見積もり", props.task));
const latestEstimate = computed(() => props.estimateList?.estimates.at(-1) ?? null);
const decidedEstimateIds = computed(
  () =>
    new Set(props.estimateList?.decisions.map((decision) => decision.taskEstimateSnapshotId) ?? [])
);
const undecidedEstimates = computed(
  () =>
    props.estimateList?.estimates.filter(
      (estimate) => !decidedEstimateIds.value.has(estimate.taskEstimateSnapshotId)
    ) ?? []
);
const estimateDecisionOptions = computed(() =>
  undecidedEstimates.value.map((estimate) => ({
    title: `revision ${estimate.revision}：${formatTaskEstimateRange(estimate)}`,
    value: estimate.taskEstimateSnapshotId,
  }))
);
const NO_VARIANCE_REASON_VALUE = "__NONE__";
const outcomeVarianceReasonOptions = computed(() => {
  const reasonOptions = ESTIMATE_VARIANCE_REASON_OPTIONS.map((option) => ({ ...option }));
  if (props.estimateList?.actualEffortMinutes === props.estimateList?.finalPlannedEffortMinutes) {
    return [{ title: "理由なし", value: NO_VARIANCE_REASON_VALUE }, ...reasonOptions];
  }
  return reasonOptions;
});
const aiAssistanceMode = ref<EstimateAssistanceMode>("CODING_AGENT");
const aiSendingConfirmed = ref(false);

watch(
  () => [props.open, props.task?.taskId, props.aiConfirmation?.inputSha256] as const,
  () => {
    aiSendingConfirmed.value = false;
  }
);

/** AI Request状態をNuxt UIのsemantic colorへ変換する。 */
const aiStatusColor = (status: AiEstimationRequestStatus) => {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "error";
    case "CANCELED":
      return "neutral";
    case "RETRY_WAIT":
      return "warning";
    default:
      return "info";
  }
};

/** 送信内容確認APIを選択中のprovider非依存支援modeで呼ぶ。 */
const submitAiConfirmation = (): void => {
  if (!isBusy.value && props.canGenerateAi) {
    emit("confirmAi", aiAssistanceMode.value);
  }
};

/** 画面の明示同意状態を生成受付処理へ渡す。 */
const submitAiRequest = (): void => {
  if (!isBusy.value && props.canGenerateAi) {
    emit("requestAi", aiSendingConfirmed.value);
  }
};

/** 採否監査が参照する見積もりrevisionを表示する。 */
const formatDecisionRevision = (decision: TaskEstimateDecision): string => {
  const estimate = props.estimateList?.estimates.find(
    (candidate) => candidate.taskEstimateSnapshotId === decision.taskEstimateSnapshotId
  );
  return estimate === undefined
    ? `ID ${decision.taskEstimateSnapshotId}`
    : `revision ${estimate.revision}`;
};

/** 採否監査のFinal Plan変更前後を同じ単位で表示する。 */
const formatDecisionPlanTransition = (decision: TaskEstimateDecision): string =>
  `${formatEffortMinutes(decision.beforePlannedEffortMinutes)} → ${formatEffortMinutes(
    decision.afterPlannedEffortMinutes
  )}`;

/** 評価revisionにHuman Estimateがない既存Taskを明示する。 */
const formatOutcomeHumanEstimate = (revision: number | null, minutes: number | null): string =>
  revision === null || minutes === null
    ? "未入力"
    : `revision ${revision}・${formatEffortMinutes(minutes)}`;

// 保存後の一覧Responseが変わるたびに空Formへ戻し、直前の見積もりを誤って再送しない。
const {
  closeDialog,
  form: humanEstimateForm,
  handleDialogVisibility,
  submitForm: submitHumanEstimateForm,
} = useDialogForm({
  initialForm: buildHumanEstimateForm(),
  syncSources: [() => props.open, () => props.estimateList],
  buildForm: () => (props.open ? buildHumanEstimateForm() : undefined),
  isBusy,
  canSubmit: () => props.canCreate,
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});

// 採否確定後は次の未採否revisionを選び直し、確定済みrevisionの再送を画面でも防ぐ。
const { form: decisionForm, submitForm: submitDecisionForm } = useDialogForm({
  initialForm: buildTaskEstimateDecisionForm(),
  syncSources: [() => props.open, () => props.estimateList],
  buildForm: () =>
    props.open
      ? buildTaskEstimateDecisionForm(
          undecidedEstimates.value.at(-1)?.taskEstimateSnapshotId ?? null
        )
      : undefined,
  isBusy,
  canSubmit: (value) =>
    props.canDecide &&
    value.taskEstimateSnapshotId !== null &&
    undecidedEstimates.value.some(
      (estimate) => estimate.taskEstimateSnapshotId === value.taskEstimateSnapshotId
    ),
  onClose: () => undefined,
  onSave: (value) => emit("decide", value),
});

// 評価保存後は空Formへ戻し、直前の実利用支援方法や理由を次revisionへ誤って再送しない。
const { form: outcomeForm, submitForm: submitOutcomeForm } = useDialogForm({
  initialForm: buildTaskEstimateOutcomeForm(),
  syncSources: [() => props.open, () => props.estimateList?.outcomes],
  buildForm: () => (props.open ? buildTaskEstimateOutcomeForm() : undefined),
  isBusy,
  canSubmit: () => props.canEvaluate,
  onClose: () => undefined,
  onSave: (value) => emit("evaluate", value),
});

// Reka UIはnullを選択値にできないため、画面専用値をAPI契約のnullへ境界で変換する。
const outcomeVarianceReasonValue = computed({
  get: () => outcomeForm.value.varianceReasonCode ?? NO_VARIANCE_REASON_VALUE,
  set: (value: string) => {
    outcomeForm.value.varianceReasonCode =
      value === NO_VARIANCE_REASON_VALUE
        ? null
        : (value as TaskEstimateOutcomeForm["varianceReasonCode"]);
  },
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
        <div v-if="estimateList" class="mb-5 grid gap-3 md:grid-cols-3">
          <UCard variant="subtle">
            <div class="text-xs text-muted">最新Estimate</div>
            <div class="mt-1 font-medium">
              {{ latestEstimate ? formatTaskEstimateRange(latestEstimate) : "未入力" }}
            </div>
          </UCard>
          <UCard variant="subtle">
            <div class="text-xs text-muted">Final Plan（正式予定）</div>
            <div class="mt-1 font-medium">
              {{
                estimateList.finalPlannedEffortMinutes > 0
                  ? formatEffortMinutes(estimateList.finalPlannedEffortMinutes)
                  : "未入力"
              }}
            </div>
          </UCard>
          <UCard variant="subtle">
            <div class="text-xs text-muted">Actual（実績）</div>
            <div class="mt-1 font-medium">
              {{
                estimateList.actualEffortMinutes > 0
                  ? formatEffortMinutes(estimateList.actualEffortMinutes)
                  : "未入力"
              }}
            </div>
          </UCard>
        </div>

        <UCard v-if="canCreate" variant="outline" class="mb-5">
          <template #header>
            <div>
              <div class="text-base font-normal">Human Estimateを追加</div>
              <p class="mt-1 mb-0 text-xs text-muted">
                AI提案を見る前の見積もりを履歴へ追加します。正式予定工数は変更しません。
              </p>
            </div>
          </template>
          <form @submit.prevent="submitHumanEstimateForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="想定するAI支援">
                  <USelect
                    v-model="humanEstimateForm.assistanceMode"
                    :items="ESTIMATE_ASSISTANCE_MODE_OPTIONS"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="最頻値・単一点（分）" help="必須。1分以上の整数です。">
                  <UInput
                    v-model.nullable="humanEstimateForm.estimateLikelyMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="楽観値（分）" help="単一点見積もりでは空欄にします。">
                  <UInput
                    v-model.nullable="humanEstimateForm.estimateLowMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="悲観値（分）" help="3点見積もりでは楽観値と両方入力します。">
                  <UInput
                    v-model.nullable="humanEstimateForm.estimateHighMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isBusy"
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
              @click="submitHumanEstimateForm"
            >
              見積もりを追加
            </UButton>
          </template>
        </UCard>

        <StatusAlert v-else type="info" variant="soft" class="mb-5">
          このTaskの見積もり履歴は参照できますが、Human
          Estimateを追加する権限または状態ではありません。
        </StatusAlert>

        <UCard v-if="canGenerateAi" variant="outline" class="mb-5">
          <template #header>
            <div>
              <div class="text-base font-normal">AI Estimateを生成</div>
              <p class="mt-1 mb-0 text-xs text-muted">
                外部AIへ送る値を先に確認します。生成結果は提案として履歴へ追加され、Final
                Planは採否を確定するまで変わりません。
              </p>
            </div>
          </template>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <UFormField label="見積もりで仮定するAI支援" class="flex-1">
                <USelect
                  v-model="aiAssistanceMode"
                  :items="ESTIMATE_ASSISTANCE_MODE_OPTIONS"
                  label-key="title"
                  value-key="value"
                  :disabled="isBusy"
                  class="w-full"
                />
              </UFormField>
              <UButton
                variant="outline"
                icon="i-mdi-shield-search-outline"
                :loading="isLoadingAiConfirmation"
                :disabled="isBusy"
                @click="submitAiConfirmation"
              >
                送信内容を確認
              </UButton>
            </div>

            <template v-if="aiConfirmation">
              <StatusAlert type="warning" variant="soft">
                次の内容を{{ aiConfirmation.providerCode }}（{{
                  aiConfirmation.modelIdentifier
                }}）へ送信します。 provider側では最大{{
                  aiConfirmation.providerMaximumRetentionDays
                }}日、Work Managementでは入力を{{
                  aiConfirmation.workManagementInputRetentionDays
                }}日保持します。
              </StatusAlert>

              <dl class="grid gap-3 rounded-sm border border-default p-4 md:grid-cols-3">
                <div>
                  <dt class="text-xs text-muted">残り生成回数</dt>
                  <dd class="mt-1 font-medium">
                    {{ aiConfirmation.quotaRemaining }} / {{ aiConfirmation.quotaLimit }}回
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">quota期間終了</dt>
                  <dd class="mt-1">{{ formatShortDateTime(aiConfirmation.quotaPeriodEnd) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">確認対象Task version</dt>
                  <dd class="mt-1">{{ aiConfirmation.taskVersion }}</dd>
                </div>
              </dl>

              <div class="rounded-sm border border-default p-4">
                <h3 class="text-sm font-medium">外部AIへ送るTask情報</h3>
                <dl class="mt-3 grid gap-x-5 gap-y-3 md:grid-cols-2">
                  <div>
                    <dt class="text-xs text-muted">Task名</dt>
                    <dd class="mt-1 break-words">{{ aiConfirmation.input.taskTitle }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted">種別 / 優先度</dt>
                    <dd class="mt-1">
                      {{ aiConfirmation.input.taskType }} / {{ aiConfirmation.input.priority }}
                    </dd>
                  </div>
                  <div class="md:col-span-2">
                    <dt class="text-xs text-muted">説明</dt>
                    <dd class="mt-1 whitespace-pre-wrap break-words">
                      {{ aiConfirmation.input.taskDescription || "未入力" }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted">予定期間</dt>
                    <dd class="mt-1">
                      {{ aiConfirmation.input.plannedStartDate || "未入力" }} 〜
                      {{ aiConfirmation.input.dueDate || "未入力" }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted">現在のFinal Plan</dt>
                    <dd class="mt-1">
                      {{ formatEffortMinutes(aiConfirmation.input.finalPlannedEffortMinutes) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted">親Task</dt>
                    <dd class="mt-1">{{ aiConfirmation.input.parentTaskTitle || "なし" }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-muted">直接の子Task</dt>
                    <dd class="mt-1">
                      {{ aiConfirmation.input.childTaskTitles.join("、") || "なし" }}
                    </dd>
                  </div>
                </dl>

                <div class="mt-4">
                  <div class="text-xs text-muted">接続する依存Task</div>
                  <ul
                    v-if="aiConfirmation.input.dependencies.length"
                    class="mt-2 space-y-1 text-sm"
                  >
                    <li
                      v-for="dependency in aiConfirmation.input.dependencies"
                      :key="`${dependency.direction}-${dependency.taskTitle}`"
                    >
                      {{ dependency.direction === "PREDECESSOR" ? "先行" : "後続" }}：{{
                        dependency.taskTitle
                      }}（{{ dependency.statusName }}・{{
                        formatEffortMinutes(dependency.plannedEffortMinutes)
                      }}）
                    </li>
                  </ul>
                  <div v-else class="mt-1 text-sm">なし</div>
                </div>
              </div>

              <UCheckbox
                :model-value="aiSendingConfirmed"
                :disabled="isBusy"
                label="送信先、上記の送信内容、保持期間を確認し、外部AIへの送信に同意します。"
                @update:model-value="aiSendingConfirmed = $event === true"
              />
              <div class="flex justify-end">
                <UButton
                  color="primary"
                  icon="i-mdi-auto-fix"
                  :loading="isRequestingAi"
                  :disabled="isBusy || !aiSendingConfirmed || aiConfirmation.quotaRemaining <= 0"
                  @click="submitAiRequest"
                >
                  AI見積もりを生成
                </UButton>
              </div>
            </template>

            <template v-if="aiRequest">
              <div class="rounded-sm border border-default p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium">
                      AI見積もりRequest #{{ aiRequest.requestId }}
                    </h3>
                    <UBadge :color="aiStatusColor(aiRequest.statusCode)" size="sm">
                      {{ formatAiEstimationStatus(aiRequest.statusCode) }}
                    </UBadge>
                  </div>
                  <UButton
                    variant="outline"
                    size="sm"
                    icon="i-mdi-refresh"
                    :loading="isRefreshingAi"
                    :disabled="isBusy"
                    @click="emit('refreshAi')"
                  >
                    状態を再取得
                  </UButton>
                </div>
                <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <div>更新：{{ formatShortDateTime(aiRequest.updatedAt) }}</div>
                  <div>再試行：{{ aiRequest.retryCount }}回</div>
                  <div>残り生成回数：{{ aiRequest.quotaRemaining }}回</div>
                </div>
                <StatusAlert v-if="aiRequest.failureCode" type="error" class="mt-3">
                  {{ formatAiEstimationFailure(aiRequest.failureCode) }}
                  <span class="ms-1 text-xs">（{{ aiRequest.failureCode }}）</span>
                </StatusAlert>

                <div v-if="aiRequest.proposal" class="mt-4 rounded-sm bg-muted p-4">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="font-medium">AI提案 revision {{ aiRequest.proposal.revision }}</h4>
                    <UBadge variant="outline" size="sm">
                      確信度：{{ formatAiEstimateConfidence(aiRequest.proposal.confidence) }}
                    </UBadge>
                  </div>
                  <div class="mt-2 text-lg font-medium">
                    {{ formatEffortMinutes(aiRequest.proposal.estimateLowMinutes) }} /
                    {{ formatEffortMinutes(aiRequest.proposal.estimateLikelyMinutes) }} /
                    {{ formatEffortMinutes(aiRequest.proposal.estimateHighMinutes) }}
                  </div>
                  <div class="mt-1 text-xs text-muted">楽観 / 最頻 / 悲観</div>
                  <div class="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <h5 class="text-sm font-medium">根拠</h5>
                      <ul class="mt-2 list-disc space-y-1 ps-5 text-sm">
                        <li v-for="item in aiRequest.proposal.rationale" :key="item">{{ item }}</li>
                      </ul>
                    </div>
                    <div>
                      <h5 class="text-sm font-medium">不確定要素</h5>
                      <ul
                        v-if="aiRequest.proposal.uncertainties.length"
                        class="mt-2 list-disc space-y-1 ps-5 text-sm"
                      >
                        <li v-for="item in aiRequest.proposal.uncertainties" :key="item">
                          {{ item }}
                        </li>
                      </ul>
                      <div v-else class="mt-2 text-sm">なし</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </UCard>

        <UCard v-if="canDecide && undecidedEstimates.length" variant="outline" class="mb-5">
          <template #header>
            <div>
              <div class="text-base font-normal">見積もりの採否を確定</div>
              <p class="mt-1 mb-0 text-xs text-muted">
                採否はrevisionごとに一度だけ確定できます。確定内容とFinal
                Planの変更前後は監査履歴に残ります。
              </p>
            </div>
          </template>
          <form @submit.prevent="submitDecisionForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="対象revision">
                  <USelect
                    :model-value="decisionForm.taskEstimateSnapshotId ?? undefined"
                    :items="estimateDecisionOptions"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                    @update:model-value="decisionForm.taskEstimateSnapshotId = $event"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="採否">
                  <USelect
                    v-model="decisionForm.decisionCode"
                    :items="ESTIMATE_DECISION_OPTIONS"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div v-if="decisionForm.decisionCode === 'ADJUSTED'" class="w-full p-3 md:w-1/2">
                <UFormField
                  label="調整後のFinal Plan（分）"
                  help="対象revisionの最頻値とは異なる、1分以上の整数です。"
                >
                  <UInput
                    v-model.nullable="decisionForm.adjustedPlannedEffortMinutes"
                    type="number"
                    min="1"
                    step="1"
                    :disabled="isBusy"
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
              :loading="isDeciding"
              @click="submitDecisionForm"
            >
              採否を確定
            </UButton>
          </template>
        </UCard>

        <StatusAlert
          v-else-if="canDecide && estimateList?.estimates.length"
          type="info"
          variant="soft"
          class="mb-5"
        >
          すべての見積もりrevisionで採否が確定しています。
        </StatusAlert>

        <UCard v-if="canEvaluate" variant="outline" class="mb-5">
          <template #header>
            <div>
              <div class="text-base font-normal">完了Taskを評価</div>
              <p class="mt-1 mb-0 text-xs text-muted">
                現在のHuman Estimate、Final Plan、Actualと誤差理由を変更不能なrevisionへ保存します。
              </p>
            </div>
          </template>
          <form @submit.prevent="submitOutcomeForm">
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 md:w-1/2">
                <UFormField label="実際に利用したAI支援">
                  <USelect
                    v-model="outcomeForm.actualAssistanceMode"
                    :items="ESTIMATE_ASSISTANCE_MODE_OPTIONS"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UFormField
                  label="Final PlanとActualの誤差理由"
                  :help="
                    estimateList?.actualEffortMinutes === estimateList?.finalPlannedEffortMinutes
                      ? '差がない場合は「理由なし」を選択できます。'
                      : '差があるため選択が必須です。'
                  "
                >
                  <USelect
                    v-model="outcomeVarianceReasonValue"
                    :items="outcomeVarianceReasonOptions"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3">
                <UFormField
                  label="誤差理由の補足"
                  :help="`任意。その他では必須。${ESTIMATE_VARIANCE_NOTE_MAX_LENGTH}文字以内です。`"
                >
                  <UTextarea
                    v-model="outcomeForm.varianceNote"
                    :maxlength="ESTIMATE_VARIANCE_NOTE_MAX_LENGTH"
                    :disabled="isBusy"
                    :rows="3"
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
              :loading="isEvaluating"
              @click="submitOutcomeForm"
            >
              評価を保存
            </UButton>
          </template>
        </UCard>

        <StatusAlert v-else-if="canCreate && estimateList" type="info" variant="soft" class="mb-5">
          完了Taskの評価には、実績終了日、Final Plan、Actualが必要です。
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

        <template v-if="estimateList?.decisions.length">
          <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
            <h2 class="text-base">採否監査履歴</h2>
            <UBadge size="sm" variant="outline">
              {{ estimateList.decisions.length }} decision
            </UBadge>
          </div>
          <div class="overflow-x-auto">
            <table class="app-table app-table-hover min-w-230 [&_td]:h-13 [&_th]:h-13">
              <thead>
                <tr>
                  <th scope="col">対象</th>
                  <th scope="col">採否</th>
                  <th scope="col">Final Plan（変更前 → 変更後）</th>
                  <th scope="col">Task version</th>
                  <th scope="col">確定者</th>
                  <th scope="col">確定日時</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="decision in estimateList.decisions"
                  :key="decision.taskEstimateDecisionId"
                >
                  <td class="whitespace-nowrap">{{ formatDecisionRevision(decision) }}</td>
                  <td class="whitespace-nowrap">
                    <UBadge
                      :color="decision.decisionCode === 'REJECTED' ? 'warning' : 'success'"
                      size="xs"
                    >
                      {{ formatTaskEstimateDecision(decision.decisionCode) }}
                    </UBadge>
                  </td>
                  <td class="whitespace-nowrap">{{ formatDecisionPlanTransition(decision) }}</td>
                  <td class="whitespace-nowrap">
                    {{ decision.sourceTaskVersion }} → {{ decision.resultTaskVersion }}
                  </td>
                  <td>{{ decision.decidedByAccountId }}</td>
                  <td class="whitespace-nowrap">{{ formatShortDateTime(decision.decidedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="estimateList?.outcomes.length">
          <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
            <h2 class="text-base">完了Task評価履歴</h2>
            <UBadge size="sm" variant="outline">
              {{ estimateList.outcomes.length }} revision
            </UBadge>
          </div>
          <div class="overflow-x-auto">
            <table class="app-table app-table-hover min-w-310 [&_td]:h-13 [&_th]:h-13">
              <thead>
                <tr>
                  <th scope="col">revision</th>
                  <th scope="col">Human Estimate</th>
                  <th scope="col">Final Plan / Actual</th>
                  <th scope="col">実利用AI支援</th>
                  <th scope="col">誤差理由</th>
                  <th scope="col">実績終了日</th>
                  <th scope="col">Task version</th>
                  <th scope="col">評価者</th>
                  <th scope="col">評価日時</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="outcome in estimateList.outcomes" :key="outcome.taskEstimateOutcomeId">
                  <td>{{ outcome.revision }}</td>
                  <td class="whitespace-nowrap">
                    {{
                      formatOutcomeHumanEstimate(
                        outcome.humanEstimateRevision,
                        outcome.humanEstimateMinutes
                      )
                    }}
                  </td>
                  <td class="whitespace-nowrap">
                    {{ formatEffortMinutes(outcome.finalPlannedEffortMinutes) }} /
                    {{ formatEffortMinutes(outcome.actualEffortMinutes) }}
                  </td>
                  <td class="whitespace-nowrap">
                    {{ formatEstimateAssistanceMode(outcome.actualAssistanceMode) }}
                  </td>
                  <td>
                    <template v-if="outcome.varianceReasonCode">
                      {{ formatEstimateVarianceReason(outcome.varianceReasonCode) }}
                      <span v-if="outcome.varianceNote" class="text-muted">
                        ・{{ outcome.varianceNote }}
                      </span>
                    </template>
                    <template v-else>差なし</template>
                  </td>
                  <td class="whitespace-nowrap">{{ outcome.taskActualEndDate }}</td>
                  <td>{{ outcome.sourceTaskVersion }}</td>
                  <td>{{ outcome.evaluatedByAccountId }}</td>
                  <td class="whitespace-nowrap">{{ formatShortDateTime(outcome.evaluatedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isBusy" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
