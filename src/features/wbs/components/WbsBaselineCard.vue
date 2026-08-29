<script setup lang="ts">
import type {
  WbsBaselineComparisonRow,
  WbsBaselineComparisonStatus,
  WbsBaselineDetailResponse,
  WbsBaselineListResponse,
  WbsBaselineSummary,
} from "@/features/wbs/types/wbs";
import {
  formatEffortMinutes,
  formatSignedEffortMinutes,
} from "@/features/wbs/utils/effort";

/** WBS baseline cardへ親画面から渡す一覧・比較結果・操作状態。 */
interface Props {
  baselineList: WbsBaselineListResponse | null;
  activeBaselineDetail: WbsBaselineDetailResponse | null;
  comparisonRows: WbsBaselineComparisonRow[];
  canManage: boolean;
  isLoading: boolean;
  isMutating: boolean;
  activatingBaselineId: number | null;
  errorMessages: string[];
  successMessage: string;
}

defineProps<Props>();
const emit = defineEmits<{
  create: [];
  activate: [baseline: WbsBaselineSummary];
}>();

/** ISO日時を日本語の短い作成日時へ変換し、不正値は元文字列を残す。 */
const formatCreatedAt = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? createdAt
    : new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

/** 比較状態を利用者が計画変更の種類として判断できる日本語へ変換する。 */
const getComparisonStatusLabel = (
  status: WbsBaselineComparisonStatus
): string => {
  const labels: Record<WbsBaselineComparisonStatus, string> = {
    UNCHANGED: "変更なし",
    CHANGED: "予定変更",
    CURRENT_ONLY: "baseline後に追加",
    BASELINE_ONLY: "現在計画から除外",
  };
  return labels[status];
};

/** 比較状態をVuetifyの注意色へ変換する。 */
const getComparisonStatusColor = (
  status: WbsBaselineComparisonStatus
): string => {
  const colors: Record<WbsBaselineComparisonStatus, string> = {
    UNCHANGED: "success",
    CHANGED: "warning",
    CURRENT_ONLY: "primary",
    BASELINE_ONLY: "error",
  };
  return colors[status];
};

/** nullableな予定期間をbaseline比較表用の2行表示へ変換する。 */
const formatPeriod = (dateFrom: string | null, dateTo: string | null): string =>
  dateFrom === null || dateTo === null ? "—" : `${dateFrom} ～ ${dateTo}`;

/** nullableな予定工数を比較対象なしの表記を保ったまま整形する。 */
const formatNullableEffort = (minutes: number | null): string =>
  minutes === null ? "—" : formatEffortMinutes(minutes);
</script>

<template>
  <v-card max-width="1600" class="mx-auto mt-4">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <v-icon icon="mdi-camera-timer-outline" />
      WBS baseline
      <v-spacer />
      <v-chip size="small" variant="outlined">
        {{ baselineList?.baselines.length ?? 0 }}件
      </v-chip>
      <v-btn
        v-if="canManage"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-camera-plus-outline"
        :disabled="isLoading || isMutating"
        @click="emit('create')"
      >
        現在計画を保存
      </v-btn>
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        現在計画を固定snapshotとして残し、active baselineとの差分をTask ID単位で確認します。
        baselineは実績値を変更せず、計画変更の比較基準として使用します。
      </p>
      <v-alert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">
          {{ message }}
        </div>
      </v-alert>
      <v-alert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </v-alert>

      <v-skeleton-loader v-if="isLoading" type="table" />
      <template v-else-if="baselineList?.baselines.length">
        <div class="baseline-list-scroll mb-5">
          <v-table hover class="baseline-list-table">
            <thead>
              <tr>
                <th scope="col">baseline</th>
                <th scope="col">説明</th>
                <th scope="col">作成日時</th>
                <th scope="col">状態</th>
                <th v-if="canManage" scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="baseline in baselineList.baselines"
                :key="baseline.baselineId"
              >
                <td>
                  <div class="font-weight-medium">
                    #{{ baseline.baselineNumber }} {{ baseline.name }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    ID: {{ baseline.baselineId }} / version: {{ baseline.version }}
                  </div>
                </td>
                <td>{{ baseline.description || "—" }}</td>
                <td class="text-no-wrap">{{ formatCreatedAt(baseline.createdAt) }}</td>
                <td>
                  <v-chip
                    :color="baseline.active ? 'success' : undefined"
                    size="small"
                    variant="tonal"
                  >
                    {{ baseline.active ? "比較中" : "保存済み" }}
                  </v-chip>
                </td>
                <td v-if="canManage">
                  <v-btn
                    v-if="!baseline.active"
                    size="small"
                    variant="text"
                    color="primary"
                    prepend-icon="mdi-check-circle-outline"
                    :loading="activatingBaselineId === baseline.baselineId"
                    :disabled="isMutating"
                    @click="emit('activate', baseline)"
                  >
                    比較対象にする
                  </v-btn>
                  <span v-else class="text-caption text-medium-emphasis">
                    active
                  </span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <template v-if="activeBaselineDetail">
          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip variant="outlined">
              Task {{ activeBaselineDetail.tasks.length }}件
            </v-chip>
            <v-chip variant="outlined">
              依存関係 {{ activeBaselineDetail.dependencies.length }}件
            </v-chip>
            <v-chip variant="outlined">
              日別予定 {{ activeBaselineDetail.effortPlans.length }}件
            </v-chip>
            <v-chip color="primary" variant="tonal">
              予定 {{ formatEffortMinutes(activeBaselineDetail.plannedEffortMinutes) }}
            </v-chip>
            <v-chip color="secondary" variant="tonal">
              配賦済み {{ formatEffortMinutes(activeBaselineDetail.allocatedEffortMinutes) }}
            </v-chip>
            <v-chip
              :color="activeBaselineDetail.unallocatedEffortMinutes === 0 ? 'success' : 'warning'"
              variant="tonal"
            >
              未配賦 {{ formatSignedEffortMinutes(activeBaselineDetail.unallocatedEffortMinutes) }}
            </v-chip>
            <v-chip color="warning" variant="tonal">
              変更 {{ comparisonRows.length }}件
            </v-chip>
          </div>

          <div v-if="comparisonRows.length" class="baseline-comparison-scroll">
            <v-table hover class="baseline-comparison-table">
              <thead>
                <tr>
                  <th scope="col">WBS / Task</th>
                  <th scope="col">変更</th>
                  <th scope="col">baseline予定期間</th>
                  <th scope="col">現在予定期間</th>
                  <th scope="col">baseline工数</th>
                  <th scope="col">現在工数</th>
                  <th scope="col">差分</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in comparisonRows" :key="row.sourceTaskId">
                  <td>
                    <div class="font-weight-medium">{{ row.wbsCode || "—" }} {{ row.title }}</div>
                    <div class="text-caption text-medium-emphasis">Task ID: {{ row.sourceTaskId }}</div>
                  </td>
                  <td>
                    <v-chip
                      :color="getComparisonStatusColor(row.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ getComparisonStatusLabel(row.status) }}
                    </v-chip>
                  </td>
                  <td class="text-no-wrap">
                    {{ formatPeriod(row.baselinePlannedStartDate, row.baselinePlannedEndDate) }}
                  </td>
                  <td class="text-no-wrap">
                    {{ formatPeriod(row.currentPlannedStartDate, row.currentPlannedEndDate) }}
                  </td>
                  <td class="text-no-wrap">
                    {{ formatNullableEffort(row.baselinePlannedEffortMinutes) }}
                  </td>
                  <td class="text-no-wrap">
                    {{ formatNullableEffort(row.currentPlannedEffortMinutes) }}
                  </td>
                  <td class="text-no-wrap">
                    {{ formatSignedEffortMinutes(row.plannedEffortDifferenceMinutes) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
          <v-alert v-else type="success" variant="tonal">
            active baselineからTask予定の変更はありません。
          </v-alert>
        </template>
      </template>
      <v-alert v-else type="info" variant="tonal">
        baselineはまだありません。重要な計画変更の前に現在計画を保存してください。
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.baseline-list-scroll,
.baseline-comparison-scroll {
  overflow-x: auto;
}

.baseline-list-table {
  min-width: 920px;
}

.baseline-comparison-table {
  min-width: 1240px;
}
</style>
