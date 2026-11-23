<script setup lang="ts">
import { computed, watch } from "vue";
import type { ExecutionComparison, ExecutionSettingForm } from "@/features/wbs/types/taskExecution";
import type { WbsTask } from "@/features/wbs/types/wbs";
import {
  createExecutionSettingForm,
  EXECUTION_SETTING_LIMITS,
  formatExecutionMode,
  isWithinExecutionSession,
} from "@/features/wbs/utils/taskExecution";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useDialogForm } from "@/shared/composables/useDialogForm";
import { BUSINESS_TIME_ZONE } from "@/shared/utils/businessDate";

/** 本人のTask・期間比較と設定申告。APIと認証は画面composableへ委ねる。 */
const props = defineProps<{
  open: boolean;
  task: WbsTask | null;
  comparison: ExecutionComparison | null;
  dateFrom: string;
  dateTo: string;
  canRecord: boolean;
  isLoading: boolean;
  isSaving: boolean;
  errorMessages: string[];
  successMessage: string;
}>();
const emit = defineEmits<{
  close: [];
  load: [];
  save: [form: ExecutionSettingForm];
  "update:dateFrom": [value: string];
  "update:dateTo": [value: string];
}>();
const { form, closeDialog, handleDialogVisibility, submitForm } = useDialogForm({
  initialForm: createExecutionSettingForm(),
  syncSources: [() => props.open, () => props.task?.taskId],
  buildForm: () => (props.open ? createExecutionSettingForm() : undefined),
  isBusy: () => props.isSaving,
  canSubmit: (value) =>
    !props.isLoading &&
    props.canRecord &&
    value.timerSessionId > 0 &&
    value.assistanceMode !== "UNSELECTED",
  onClose: () => emit("close"),
  onSave: (value) => emit("save", value),
});
const busy = computed(() => props.isLoading || props.isSaving);
const title = computed(() => `${props.task?.title ?? "Task"}：本人の設定別実績`);
const sessions = computed(() => [
  { value: 0, label: "停止したTimerを選択" },
  ...(props.comparison?.sessions ?? [])
    .filter((session) => session.settings === null)
    .map((session) => ({
      value: session.timerSessionId,
      label: `#${session.timerSessionId} ${formatTime(session.startedAt)}〜${formatTime(session.stoppedAt)}`,
    })),
]);
const measurements = computed(() => {
  const session = props.comparison?.sessions.find(
    (candidate) => candidate.timerSessionId === form.value.timerSessionId
  );
  return [
    { value: 0, label: "関連付けない" },
    ...(props.comparison?.measurements ?? [])
      .filter(
        (measurement) =>
          session &&
          measurement.timerSessionId === null &&
          isWithinExecutionSession(measurement.recordedAt, session)
      )
      .map((measurement) => ({
        value: measurement.measurementId,
        label: `計測#${measurement.measurementId} ${measurement.progressPercent}% (${measurement.schemaId})`,
      })),
  ];
});
const modeOptions = [
  { value: "UNSELECTED", label: "支援modeを選択" },
  { value: "NONE", label: "AI支援なし" },
  { value: "GENERAL_AI", label: "汎用AI" },
  { value: "CODING_AGENT", label: "Coding Agent" },
];
const settingFields = [
  { key: "agentName", label: "Agent / client", placeholder: "例：Codex" },
  { key: "modelIdentifier", label: "モデル", placeholder: "実際に使用したモデル識別子" },
  { key: "reasoningEffort", label: "推論強度", placeholder: "例：high" },
  { key: "serviceTier", label: "service tier", placeholder: "例：default" },
] as const;
/** UTCの保存時刻を利用者の業務timezoneへ表示する。 */
const formatTime = (value: string): string =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
/** 計測なしと実測0ptを区別する。 */
const formatDelta = (value: number | null): string =>
  value === null ? "未計測" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pt`;
watch(
  () => form.value.timerSessionId,
  () => {
    form.value.progressMeasurementId = 0;
  }
);
watch(
  () => props.comparison,
  () => {
    if (!sessions.value.some((session) => session.value === form.value.timerSessionId))
      form.value.timerSessionId = 0;
  }
);
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="!isSaving"
    :ui="{ content: 'max-w-6xl' }"
    @update:open="handleDialogVisibility"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4"
        ><div v-for="message in errorMessages" :key="message">{{ message }}</div></StatusAlert
      >
      <StatusAlert v-if="successMessage" type="success" class="mb-4">{{
        successMessage
      }}</StatusAlert>
      <form class="mb-5 flex flex-wrap items-end gap-3" @submit.prevent="emit('load')">
        <UFormField label="開始業務日"
          ><UInput
            :model-value="dateFrom"
            type="date"
            :disabled="busy"
            @update:model-value="emit('update:dateFrom', String($event))"
        /></UFormField>
        <UFormField label="終了業務日"
          ><UInput
            :model-value="dateTo"
            type="date"
            :disabled="busy"
            @update:model-value="emit('update:dateTo', String($event))"
        /></UFormField>
        <UButton type="submit" icon="i-mdi-refresh" :loading="isLoading" :disabled="isSaving"
          >比較を更新</UButton
        >
      </form>
      <p class="mb-4 text-sm text-muted">
        本人・同じTask・期間の記録を比較します。設定は申告値です。未記録の設定は推測せず、手入力や後編集の差は設定へ割り当てません。
        設定を切り替える場合はTimerを分けて記録してください。
      </p>
      <template v-if="comparison">
        <h3 class="mb-2 text-base font-medium">設定別のTimer配賦</h3>
        <div v-if="comparison.groups.length" class="mb-5 overflow-x-auto">
          <table class="app-table min-w-240">
            <thead>
              <tr>
                <th scope="col">支援mode</th>
                <th scope="col">Agent</th>
                <th scope="col">モデル</th>
                <th scope="col">推論強度</th>
                <th scope="col">tier</th>
                <th scope="col">Session</th>
                <th scope="col">配賦時間</th>
                <th scope="col">進捗差</th>
                <th scope="col">計測schema</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(group, index) in comparison.groups" :key="index">
                <td>{{ formatExecutionMode(group.settings) }}</td>
                <td>{{ group.settings?.agentName ?? "未記録" }}</td>
                <td>{{ group.settings?.modelIdentifier ?? "未記録" }}</td>
                <td>{{ group.settings?.reasoningEffort ?? "未記録" }}</td>
                <td>{{ group.settings?.serviceTier ?? "未記録" }}</td>
                <td>{{ group.sessionCount }}回 / {{ group.activeDays }}日</td>
                <td>{{ group.creditedMinutes }}分（{{ group.elapsedSeconds }}秒）</td>
                <td>
                  {{ formatDelta(group.progressDeltaPoints) }} / {{ group.measurementCount }}件
                </td>
                <td>{{ group.schemaId ?? "未関連" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <StatusAlert v-else type="info" class="mb-5"
          >この期間に本人の停止済みTimer配賦はありません。</StatusAlert
        >
        <p class="mb-4 text-xs text-muted">
          進捗差は明示的に関連付いた元計測のみです。Taskやschemaの違う進捗差を合算しません。作業内容が違う記録から設定の優劣を断定しません。
        </p>
        <h3 class="mb-2 text-base font-medium">日次の実績と配賦差</h3>
        <div v-if="comparison.days.length" class="mb-5 overflow-x-auto">
          <table class="app-table">
            <thead>
              <tr>
                <th scope="col">業務日</th>
                <th scope="col">現行実績</th>
                <th scope="col">Timer配賦</th>
                <th scope="col">手入力・後編集の差</th>
                <th scope="col">設定別の内訳</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in comparison.days" :key="day.workDate">
                <td>{{ day.workDate }}</td>
                <td>{{ day.actualEffortMinutes }}分</td>
                <td>{{ day.timerCreditedMinutes }}分</td>
                <td>{{ day.adjustmentMinutes }}分</td>
                <td>
                  <ul v-if="day.groups?.length" class="space-y-1">
                    <li v-for="(group, index) in day.groups" :key="index">
                      {{ formatExecutionMode(group.settings) }} /
                      {{ group.settings?.agentName ?? "Agent未記録" }} /
                      {{ group.settings?.modelIdentifier ?? "モデル未記録" }} /
                      {{ group.settings?.reasoningEffort ?? "推論強度未記録" }} /
                      {{ group.settings?.serviceTier ?? "tier未記録" }}：
                      {{ group.creditedMinutes }}分・{{
                        formatDelta(group.progressDeltaPoints)
                      }}
                      （{{ group.schemaId ?? "計測未関連" }}）
                    </li>
                  </ul>
                  <span v-else>Timer配賦なし</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mb-5 text-sm text-muted">この期間の本人実績はありません。</p>
        <h3 class="mb-2 text-base font-medium">日次の元計測</h3>
        <div v-if="comparison.measurements.length" class="mb-5 overflow-x-auto">
          <table class="app-table">
            <thead>
              <tr>
                <th scope="col">計測ID</th>
                <th scope="col">業務日</th>
                <th scope="col">進捗率</th>
                <th scope="col">適用差</th>
                <th scope="col">Timer</th>
                <th scope="col">schema</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="measurement in comparison.measurements" :key="measurement.measurementId">
                <td>#{{ measurement.measurementId }}</td>
                <td>{{ measurement.businessDate }}</td>
                <td>{{ measurement.progressPercent }}%</td>
                <td>{{ formatDelta(measurement.progressDeltaPoints) }}</td>
                <td>
                  {{
                    measurement.timerSessionId === null
                      ? "未関連"
                      : `#${measurement.timerSessionId}`
                  }}
                </td>
                <td>{{ measurement.schemaId }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mb-5 text-sm text-muted">この期間の本人の進捗計測はありません。</p>
        <UCard v-if="canRecord && sessions.length > 1" variant="outline"
          ><template #header>停止した本人Timerの実行設定を記録</template>
          <p class="mb-4 text-sm text-muted">
            実際に使用した公開設定だけを入力してください。API
            key・config本文・promptは入力しないでください。記録後の上書きはできません。
          </p>
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submitForm">
            <UFormField label="停止Timer"
              ><USelect
                v-model="form.timerSessionId"
                :items="sessions"
                :disabled="busy"
                class="w-full"
            /></UFormField>
            <UFormField label="支援mode"
              ><USelect
                v-model="form.assistanceMode"
                :items="modeOptions"
                :disabled="busy"
                class="w-full"
            /></UFormField>
            <UFormField v-for="field in settingFields" :key="field.key" :label="field.label"
              ><UInput
                v-model="form[field.key]"
                :maxlength="EXECUTION_SETTING_LIMITS[field.key]"
                :placeholder="field.placeholder"
                :disabled="busy || form.assistanceMode === 'NONE'"
                class="w-full"
            /></UFormField>
            <UFormField label="関連する進捗計測" class="md:col-span-2"
              ><USelect
                v-model="form.progressMeasurementId"
                :items="measurements"
                :disabled="busy"
                class="w-full"
            /></UFormField>
            <div class="md:col-span-2">
              <UButton
                type="submit"
                :disabled="
                  busy || form.timerSessionId === 0 || form.assistanceMode === 'UNSELECTED'
                "
                :loading="isSaving"
                >確認した設定を記録</UButton
              >
            </div>
          </form>
        </UCard>
      </template>
    </template>
    <template #footer
      ><UButton variant="ghost" color="neutral" :disabled="isSaving" @click="closeDialog"
        >閉じる</UButton
      ></template
    >
  </UModal>
</template>
