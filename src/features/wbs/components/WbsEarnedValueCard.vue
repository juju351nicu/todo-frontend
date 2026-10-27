<script setup lang="ts">
import type { EarnedValueResponse } from "@/features/wbs/types/wbs";
import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
  getEarnedValueRatioColor,
  getEarnedValueVarianceColor,
} from "@/features/wbs/utils/earnedValue";
import { EARNED_VALUE_SUBMIT_CONTROL } from "@/features/wbs/composables/useWbsEarnedValue";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useSyncedDraft } from "@/shared/composables/useSyncedDraft";

/** WBS EVM cardへ親画面から渡す基準日、Backend確定値、取得状態。 */
interface Props {
  statusDate: string;
  metrics: EarnedValueResponse | null;
  isLoading: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  load: [statusDate: string];
}>();

// 親composableが確定した基準日を、再読込後も入力欄へ同期する。
const formStatusDate = useSyncedDraft(() => props.statusDate);

/** 入力中の基準日を、検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading) {
    emit("load", formStatusDate.value);
  }
};
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-chart-timeline-variant-shimmer" class="size-6" />
        EVM（出来高管理）
        <UBadge v-if="metrics" size="sm" variant="outline" class="ms-auto">基準日 {{ metrics.statusDate }}</UBadge>
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      active baselineを計画基準として、指定日までのPV・EV・ACとSPI・CPIを表示します。
      計算式と丸めはBackendが一元管理し、この画面はResponseを再計算しません。
    </p>

    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>

    <form @submit.prevent="submit">
      <div class="-m-3 flex flex-wrap items-end">
        <div class="w-full p-3 sm:w-5/12 md:w-1/4">
          <UFormField label="EVM基準日" class="pb-0">
            <UInput v-model="formStatusDate" type="date" :disabled="isLoading" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/4 md:w-1/6">
          <UButton
            type="submit"
            color="primary"
            icon="i-mdi-calculator-variant-outline"
            :loading="isLoading"
            :data-earned-value-control="EARNED_VALUE_SUBMIT_CONTROL"
            block
          >
            集計
          </UButton>
        </div>
      </div>
    </form>

    <div v-if="isLoading" class="mt-4 flex flex-col gap-3">
      <USkeleton class="h-6 w-1/3" />
      <USkeleton class="h-4 w-full" />
      <USkeleton v-for="row in 4" :key="row" class="h-10 w-full" />
    </div>
    <template v-else-if="metrics">
      <div class="mt-5 mb-3 flex flex-wrap items-center gap-2">
        <UBadge color="neutral">baseline #{{ metrics.baselineNumber }} {{ metrics.baselineName }}</UBadge>
        <UBadge variant="outline">作成日 {{ metrics.baselineDate }}</UBadge>
        <UBadge variant="outline">timezone {{ metrics.businessZoneId }}</UBadge>
      </div>

      <div class="-m-3 mb-1 flex flex-wrap">
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <div class="h-full rounded-sm border border-default p-4">
            <div class="text-xs text-muted">BAC（総予算）</div>
            <div class="text-xl font-medium">{{ formatEarnedValueMinutes(metrics.bac) }}</div>
          </div>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <div class="h-full rounded-sm border border-default p-4">
            <div class="text-xs text-muted">PV（計画価値）</div>
            <div class="text-xl font-medium">{{ formatEarnedValueMinutes(metrics.pv) }}</div>
            <div class="text-xs">計画進捗 {{ formatEarnedValuePercent(metrics.plannedProgressPercent) }}</div>
          </div>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <div class="h-full rounded-sm border border-default p-4">
            <div class="text-xs text-muted">EV（出来高）</div>
            <div class="text-xl font-medium">{{ formatEarnedValueMinutes(metrics.ev) }}</div>
            <div class="text-xs">出来高進捗 {{ formatEarnedValuePercent(metrics.earnedProgressPercent) }}</div>
          </div>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <div class="h-full rounded-sm border border-default p-4">
            <div class="text-xs text-muted">AC（実コスト）</div>
            <div class="text-xl font-medium">{{ formatEarnedValueMinutes(metrics.ac) }}</div>
          </div>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <UBadge :color="getEarnedValueVarianceColor(metrics.sv)">SV {{ formatSignedEarnedValueMinutes(metrics.sv) }}</UBadge>
        <UBadge :color="getEarnedValueVarianceColor(metrics.cv)">CV {{ formatSignedEarnedValueMinutes(metrics.cv) }}</UBadge>
        <UBadge :color="getEarnedValueRatioColor(metrics.spi)">SPI {{ formatEarnedValueRatio(metrics.spi) }}</UBadge>
        <UBadge :color="getEarnedValueRatioColor(metrics.cpi)">CPI {{ formatEarnedValueRatio(metrics.cpi) }}</UBadge>
        <UBadge :color="metrics.baselineAllocationVarianceMinutes === 0 ? 'success' : 'warning'">
          baseline配賦差 {{ formatSignedEarnedValueMinutes(metrics.baselineAllocationVarianceMinutes) }}
        </UBadge>
        <UBadge v-if="metrics.excludedActualEffortMinutes > 0" color="warning">
          AC除外 {{ formatEarnedValueMinutes(metrics.excludedActualEffortMinutes) }}
        </UBadge>
      </div>

      <StatusAlert v-if="metrics.warnings.length" type="warning" variant="soft" class="mb-4">
        <div class="mb-1 font-medium">集計上の注意</div>
        <ul class="list-disc ps-5">
          <li v-for="warning in metrics.warnings" :key="`${warning.code}-${warning.taskId ?? 'project'}`">
            {{ warning.message }}
            <span v-if="warning.minutes !== null">（{{ formatEarnedValueMinutes(warning.minutes) }}）</span>
          </li>
        </ul>
      </StatusAlert>

      <div v-if="metrics.tasks.length" class="overflow-x-auto">
        <table class="app-table app-table-hover min-w-330 [&_td]:h-13 [&_th]:h-13">
          <thead>
            <tr>
              <th scope="col">WBS / Task</th>
              <th scope="col">予定期間</th>
              <th scope="col">予定工数</th>
              <th scope="col">進捗snapshot</th>
              <th scope="col">PV</th>
              <th scope="col">EV</th>
              <th scope="col">AC</th>
              <th scope="col">SV</th>
              <th scope="col">CV</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in metrics.tasks" :key="task.sourceTaskId">
              <td>
                <div class="font-medium">{{ task.wbsCode || "—" }} {{ task.title }}</div>
                <div class="text-xs text-muted">Task ID: {{ task.sourceTaskId }}</div>
              </td>
              <td class="whitespace-nowrap">{{ task.plannedStartDate }} ～ {{ task.plannedEndDate }}</td>
              <td class="whitespace-nowrap">{{ formatEarnedValueMinutes(task.plannedEffortMinutes) }}</td>
              <td class="whitespace-nowrap">
                <template v-if="task.progressSnapshotDate !== null">
                  {{ task.progressSnapshotDate }} / {{ formatEarnedValuePercent(task.progressPercent) }}
                </template>
                <template v-else>履歴なし</template>
              </td>
              <td class="whitespace-nowrap">{{ formatEarnedValueMinutes(task.pv) }}</td>
              <td class="whitespace-nowrap">{{ formatEarnedValueMinutes(task.ev) }}</td>
              <td class="whitespace-nowrap">{{ formatEarnedValueMinutes(task.ac) }}</td>
              <td class="whitespace-nowrap">
                <UBadge :color="getEarnedValueVarianceColor(task.sv)" size="sm">{{ formatSignedEarnedValueMinutes(task.sv) }}</UBadge>
              </td>
              <td class="whitespace-nowrap">
                <UBadge :color="getEarnedValueVarianceColor(task.cv)" size="sm">{{ formatSignedEarnedValueMinutes(task.cv) }}</UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatusAlert v-else type="info" variant="soft">active baselineにEVM対象の通常Taskはありません。</StatusAlert>
    </template>
    <StatusAlert v-else type="info" variant="soft" class="mt-4">
      基準日を指定して集計してください。active baselineがないProjectでは、先に現在計画をbaselineとして保存します。
    </StatusAlert>
  </UCard>
</template>
