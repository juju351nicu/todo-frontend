<script setup lang="ts">
import { ref, watch } from "vue";

import type { EarnedValueResponse } from "@/features/wbs/types/wbs";
import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
} from "@/features/wbs/utils/earnedValue";

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
const formStatusDate = ref(props.statusDate);

/** 親composableが確定した基準日を再読込後も入力欄へ同期する。 */
watch(
  () => props.statusDate,
  (statusDate) => {
    formStatusDate.value = statusDate;
  }
);

/** 入力中の基準日を検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading) {
    emit("load", formStatusDate.value);
  }
};

/** 1以上を健全とするSPI・CPIを画面の注意色へ変換する。 */
const getRatioColor = (ratio: number | null): string | undefined => {
  if (ratio === null) {
    return undefined;
  }
  return ratio >= 1 ? "success" : "error";
};

/** 0以上を健全とするSV・CVを画面の注意色へ変換する。 */
const getVarianceColor = (variance: number): string =>
  variance >= 0 ? "success" : "error";
</script>

<template>
  <v-card max-width="1600" class="mx-auto mt-4">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <v-icon icon="mdi-chart-timeline-variant-shimmer" />
      EVM（出来高管理）
      <v-spacer />
      <v-chip v-if="metrics" size="small" variant="outlined">
        基準日 {{ metrics.statusDate }}
      </v-chip>
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        active baselineを計画基準として、指定日までのPV・EV・ACとSPI・CPIを表示します。
        計算式と丸めはBackendが一元管理し、この画面はResponseを再計算しません。
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
              v-model="formStatusDate"
              label="EVM基準日"
              type="date"
              :disabled="isLoading"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="3" md="2">
            <v-btn
              type="submit"
              color="primary"
              prepend-icon="mdi-calculator-variant-outline"
              :loading="isLoading"
              block
            >
              集計
            </v-btn>
          </v-col>
        </v-row>
      </v-form>

      <v-skeleton-loader v-if="isLoading" type="article, table" class="mt-4" />
      <template v-else-if="metrics">
        <div class="d-flex flex-wrap align-center ga-2 mt-5 mb-3">
          <v-chip color="primary" variant="tonal">
            baseline #{{ metrics.baselineNumber }} {{ metrics.baselineName }}
          </v-chip>
          <v-chip variant="outlined">作成日 {{ metrics.baselineDate }}</v-chip>
          <v-chip variant="outlined">timezone {{ metrics.businessZoneId }}</v-chip>
        </div>

        <v-row class="mb-1">
          <v-col cols="12" sm="6" md="3">
            <v-sheet class="pa-4 evm-summary" rounded border>
              <div class="text-caption text-medium-emphasis">BAC（総予算）</div>
              <div class="text-h6">{{ formatEarnedValueMinutes(metrics.bac) }}</div>
            </v-sheet>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-sheet class="pa-4 evm-summary" rounded border>
              <div class="text-caption text-medium-emphasis">PV（計画価値）</div>
              <div class="text-h6">{{ formatEarnedValueMinutes(metrics.pv) }}</div>
              <div class="text-caption">
                計画進捗 {{ formatEarnedValuePercent(metrics.plannedProgressPercent) }}
              </div>
            </v-sheet>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-sheet class="pa-4 evm-summary" rounded border>
              <div class="text-caption text-medium-emphasis">EV（出来高）</div>
              <div class="text-h6">{{ formatEarnedValueMinutes(metrics.ev) }}</div>
              <div class="text-caption">
                出来高進捗 {{ formatEarnedValuePercent(metrics.earnedProgressPercent) }}
              </div>
            </v-sheet>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-sheet class="pa-4 evm-summary" rounded border>
              <div class="text-caption text-medium-emphasis">AC（実コスト）</div>
              <div class="text-h6">{{ formatEarnedValueMinutes(metrics.ac) }}</div>
            </v-sheet>
          </v-col>
        </v-row>

        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-chip :color="getVarianceColor(metrics.sv)" variant="tonal">
            SV {{ formatSignedEarnedValueMinutes(metrics.sv) }}
          </v-chip>
          <v-chip :color="getVarianceColor(metrics.cv)" variant="tonal">
            CV {{ formatSignedEarnedValueMinutes(metrics.cv) }}
          </v-chip>
          <v-chip :color="getRatioColor(metrics.spi)" variant="tonal">
            SPI {{ formatEarnedValueRatio(metrics.spi) }}
          </v-chip>
          <v-chip :color="getRatioColor(metrics.cpi)" variant="tonal">
            CPI {{ formatEarnedValueRatio(metrics.cpi) }}
          </v-chip>
          <v-chip
            :color="metrics.baselineAllocationVarianceMinutes === 0 ? 'success' : 'warning'"
            variant="tonal"
          >
            baseline配賦差
            {{ formatSignedEarnedValueMinutes(metrics.baselineAllocationVarianceMinutes) }}
          </v-chip>
          <v-chip
            v-if="metrics.excludedActualEffortMinutes > 0"
            color="warning"
            variant="tonal"
          >
            AC除外 {{ formatEarnedValueMinutes(metrics.excludedActualEffortMinutes) }}
          </v-chip>
        </div>

        <v-alert
          v-if="metrics.warnings.length"
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          <div class="font-weight-medium mb-1">集計上の注意</div>
          <ul class="pl-5">
            <li
              v-for="warning in metrics.warnings"
              :key="`${warning.code}-${warning.taskId ?? 'project'}`"
            >
              {{ warning.message }}
              <span v-if="warning.minutes !== null">
                （{{ formatEarnedValueMinutes(warning.minutes) }}）
              </span>
            </li>
          </ul>
        </v-alert>

        <div v-if="metrics.tasks.length" class="evm-task-table-scroll">
          <v-table hover class="evm-task-table">
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
                  <div class="font-weight-medium">
                    {{ task.wbsCode || "—" }} {{ task.title }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Task ID: {{ task.sourceTaskId }}
                  </div>
                </td>
                <td class="text-no-wrap">
                  {{ task.plannedStartDate }} ～ {{ task.plannedEndDate }}
                </td>
                <td class="text-no-wrap">
                  {{ formatEarnedValueMinutes(task.plannedEffortMinutes) }}
                </td>
                <td class="text-no-wrap">
                  <template v-if="task.progressSnapshotDate !== null">
                    {{ task.progressSnapshotDate }} /
                    {{ formatEarnedValuePercent(task.progressPercent) }}
                  </template>
                  <template v-else>履歴なし</template>
                </td>
                <td class="text-no-wrap">{{ formatEarnedValueMinutes(task.pv) }}</td>
                <td class="text-no-wrap">{{ formatEarnedValueMinutes(task.ev) }}</td>
                <td class="text-no-wrap">{{ formatEarnedValueMinutes(task.ac) }}</td>
                <td class="text-no-wrap">
                  <v-chip :color="getVarianceColor(task.sv)" size="small" variant="tonal">
                    {{ formatSignedEarnedValueMinutes(task.sv) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">
                  <v-chip :color="getVarianceColor(task.cv)" size="small" variant="tonal">
                    {{ formatSignedEarnedValueMinutes(task.cv) }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-else type="info" variant="tonal">
          active baselineにEVM対象の通常Taskはありません。
        </v-alert>
      </template>
      <v-alert v-else type="info" variant="tonal" class="mt-4">
        基準日を指定して集計してください。active baselineがないProjectでは、先に現在計画をbaselineとして保存します。
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.evm-summary {
  height: 100%;
}

.evm-task-table-scroll {
  overflow-x: auto;
}

.evm-task-table {
  min-width: 1320px;
}
</style>
