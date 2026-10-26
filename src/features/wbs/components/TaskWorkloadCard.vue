<script setup lang="ts">
import type { TaskWorkloadDateRange, TaskWorkloadResponse } from "@/features/wbs/types/wbs";
import { formatEffortMinutes, formatSignedEffortMinutes } from "@/features/wbs/utils/effort";
import {
  getWorkloadCapacityColor,
  getWorkloadCapacityLabel,
  getWorkloadVarianceColor,
} from "@/features/wbs/utils/taskWorkload";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useSyncedDraft } from "@/shared/composables/useSyncedDraft";

/** Project workload cardへ親画面から渡す検索条件と確定結果。 */
interface Props {
  dateRange: TaskWorkloadDateRange;
  workload: TaskWorkloadResponse | null;
  isLoading: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  load: [dateRange: TaskWorkloadDateRange];
}>();

// 親composableが確定した検索期間を、再読込・競合回復後も入力欄へ同期する。
const form = useSyncedDraft(
  () => props.dateRange,
  (dateRange) => ({ ...dateRange }),
);

/** 入力中の期間を複製し、検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading) {
    emit("load", { ...form.value });
  }
};
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-account-clock-outline" class="size-6" />
        担当者別workload
        <UBadge size="sm" variant="outline" class="ms-auto">{{ workload?.workloads.length ?? 0 }}行</UBadge>
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      Task日別予定と日別実績を日付・担当者単位で比較します。残容量は「稼働可能 - 予定」です。
      稼働可能時間は個人例外、Project共通例外、曜日既定値の順で決まります。
    </p>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <form @submit.prevent="submit">
      <div class="-m-3 flex flex-wrap items-center">
        <div class="w-full p-3 sm:w-5/12 md:w-1/4">
          <UFormField label="集計開始日" class="pb-0">
            <UInput v-model="form.dateFrom" type="date" :disabled="isLoading" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-5/12 md:w-1/4">
          <UFormField label="集計終了日" class="pb-0">
            <UInput v-model="form.dateTo" type="date" :disabled="isLoading" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/6">
          <UButton type="submit" color="primary" icon="i-mdi-magnify" :loading="isLoading" block>集計</UButton>
        </div>
      </div>
    </form>

    <div v-if="isLoading" class="mt-4 flex flex-col gap-3">
      <USkeleton v-for="row in 5" :key="row" class="h-8 w-full" />
    </div>
    <template v-else-if="workload">
      <div class="mt-5 mb-3 flex flex-wrap gap-2">
        <UBadge color="primary">予定 {{ formatEffortMinutes(workload.totalPlannedEffortMinutes) }}</UBadge>
        <UBadge color="secondary">実績 {{ formatEffortMinutes(workload.totalActualEffortMinutes) }}</UBadge>
        <UBadge :color="getWorkloadVarianceColor(workload.totalVarianceEffortMinutes)">
          差分 {{ formatSignedEffortMinutes(workload.totalVarianceEffortMinutes) }}
        </UBadge>
      </div>

      <div v-if="workload.workloads.length" class="overflow-x-auto">
        <table class="app-table app-table-hover min-w-270 [&_td]:h-13 [&_th]:h-13">
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">担当者</th>
              <th scope="col">予定</th>
              <th scope="col">稼働可能</th>
              <th scope="col">残容量</th>
              <th scope="col">配賦状態</th>
              <th scope="col">実績</th>
              <th scope="col">差分</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in workload.workloads" :key="`${row.workDate}-${row.accountId}`">
              <td class="whitespace-nowrap">{{ row.workDate }}</td>
              <td>
                {{ row.accountDisplayName }}
                <div class="text-xs text-muted">アカウントID: {{ row.accountId }}</div>
              </td>
              <td class="whitespace-nowrap">{{ formatEffortMinutes(row.plannedEffortMinutes) }}</td>
              <td class="whitespace-nowrap">{{ formatEffortMinutes(row.availableMinutes) }}</td>
              <td class="whitespace-nowrap">{{ formatSignedEffortMinutes(row.remainingMinutes) }}</td>
              <td class="whitespace-nowrap">
                <UBadge :color="getWorkloadCapacityColor(row)" size="sm">{{ getWorkloadCapacityLabel(row) }}</UBadge>
              </td>
              <td class="whitespace-nowrap">{{ formatEffortMinutes(row.actualEffortMinutes) }}</td>
              <td class="whitespace-nowrap">
                <UBadge :color="getWorkloadVarianceColor(row.varianceEffortMinutes)" size="sm">
                  {{ formatSignedEffortMinutes(row.varianceEffortMinutes) }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatusAlert v-else type="info" variant="soft" class="mt-4">指定期間の日別予定・実績工数はありません。</StatusAlert>
    </template>
  </UCard>
</template>
