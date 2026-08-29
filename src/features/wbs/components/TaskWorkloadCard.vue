<script setup lang="ts">
import { ref, watch } from "vue";

import type {
  TaskWorkloadDateRange,
  TaskWorkloadResponse,
  TaskWorkloadRow,
} from "@/features/wbs/types/wbs";
import {
  formatEffortMinutes,
  formatSignedEffortMinutes,
} from "@/features/wbs/utils/effort";
import {
  resolveWorkloadCapacityStatus,
  type WorkloadCapacityStatus,
} from "@/features/wbs/utils/taskWorkload";

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
const form = ref<TaskWorkloadDateRange>({ ...props.dateRange });

/** 親composableが確定した検索期間を再読込・競合回復後も入力欄へ同期する。 */
watch(
  () => props.dateRange,
  (dateRange) => {
    form.value = { ...dateRange };
  },
  { deep: true }
);

/** 入力中の期間を複製し、検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading) {
    emit("load", { ...form.value });
  }
};

/** 実績-予定の差分を画面上の注意度へ変換する。 */
const getVarianceColor = (varianceEffortMinutes: number): string => {
  if (varianceEffortMinutes > 0) {
    return "error";
  }
  return varianceEffortMinutes < 0 ? "warning" : "success";
};

/** 容量状態を警告の強さへ変換する。 */
const getCapacityColor = (workload: Readonly<TaskWorkloadRow>): string => {
  return resolveWorkloadCapacityStatus(workload) === "WITHIN_CAPACITY"
    ? "success"
    : "error";
};

/** 容量状態を担当者が判断できる日本語表示へ変換する。 */
const getCapacityLabel = (workload: Readonly<TaskWorkloadRow>): string => {
  const labels: Record<WorkloadCapacityStatus, string> = {
    WITHIN_CAPACITY: "配賦内",
    OVER_ALLOCATED: "過配賦",
    HOLIDAY_ALLOCATION: "休日配賦",
  };
  return labels[resolveWorkloadCapacityStatus(workload)];
};
</script>

<template>
  <v-card max-width="1600" class="mx-auto mt-4">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <v-icon icon="mdi-account-clock-outline" />
      担当者別workload
      <v-spacer />
      <v-chip size="small" variant="outlined">
        {{ workload?.workloads.length ?? 0 }}行
      </v-chip>
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Task日別予定と日別実績を日付・担当者単位で比較します。残容量は「稼働可能 - 予定」です。
        稼働可能時間は個人例外、Project共通例外、曜日既定値の順で決まります。
      </p>
      <v-alert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">
          {{ message }}
        </div>
      </v-alert>
      <v-form @submit.prevent="submit">
        <v-row align="center">
          <v-col cols="12" sm="5" md="3">
            <v-text-field
              v-model="form.dateFrom"
              label="集計開始日"
              type="date"
              :disabled="isLoading"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="5" md="3">
            <v-text-field
              v-model="form.dateTo"
              label="集計終了日"
              type="date"
              :disabled="isLoading"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="2" md="2">
            <v-btn
              type="submit"
              color="primary"
              prepend-icon="mdi-magnify"
              :loading="isLoading"
              block
            >
              集計
            </v-btn>
          </v-col>
        </v-row>
      </v-form>

      <v-skeleton-loader v-if="isLoading" type="table" class="mt-4" />
      <template v-else-if="workload">
        <div class="d-flex flex-wrap ga-2 mt-5 mb-3">
          <v-chip color="primary" variant="tonal">
            予定 {{ formatEffortMinutes(workload.totalPlannedEffortMinutes) }}
          </v-chip>
          <v-chip color="secondary" variant="tonal">
            実績 {{ formatEffortMinutes(workload.totalActualEffortMinutes) }}
          </v-chip>
          <v-chip
            :color="getVarianceColor(workload.totalVarianceEffortMinutes)"
            variant="tonal"
          >
            差分 {{ formatSignedEffortMinutes(workload.totalVarianceEffortMinutes) }}
          </v-chip>
        </div>

        <div v-if="workload.workloads.length" class="workload-table-scroll">
          <v-table hover class="workload-table">
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
              <tr
                v-for="row in workload.workloads"
                :key="`${row.workDate}-${row.accountId}`"
              >
                <td class="text-no-wrap">{{ row.workDate }}</td>
                <td>
                  {{ row.accountDisplayName }}
                  <div class="text-caption text-medium-emphasis">
                    アカウントID: {{ row.accountId }}
                  </div>
                </td>
                <td class="text-no-wrap">
                  {{ formatEffortMinutes(row.plannedEffortMinutes) }}
                </td>
                <td class="text-no-wrap">
                  {{ formatEffortMinutes(row.availableMinutes) }}
                </td>
                <td class="text-no-wrap">
                  {{ formatSignedEffortMinutes(row.remainingMinutes) }}
                </td>
                <td class="text-no-wrap">
                  <v-chip
                    :color="getCapacityColor(row)"
                    size="small"
                    variant="tonal"
                  >
                    {{ getCapacityLabel(row) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">
                  {{ formatEffortMinutes(row.actualEffortMinutes) }}
                </td>
                <td class="text-no-wrap">
                  <v-chip
                    :color="getVarianceColor(row.varianceEffortMinutes)"
                    size="small"
                    variant="tonal"
                  >
                    {{ formatSignedEffortMinutes(row.varianceEffortMinutes) }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-else type="info" variant="tonal" class="mt-4">
          指定期間の日別予定・実績工数はありません。
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.workload-table-scroll {
  overflow-x: auto;
}

.workload-table {
  min-width: 1080px;
}
</style>
