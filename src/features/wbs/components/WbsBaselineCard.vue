<script setup lang="ts">
import type {
  WbsBaselineComparisonRow,
  WbsBaselineDetailResponse,
  WbsBaselineListResponse,
  WbsBaselineSummary,
} from "@/features/wbs/types/wbs";
import {
  formatEffortMinutes,
  formatOptionalEffortMinutes,
  formatSignedEffortMinutes,
} from "@/features/wbs/utils/effort";
import {
  formatBaselineCreatedAt,
  formatBaselinePeriod,
  getBaselineComparisonStatusColor,
  getBaselineComparisonStatusLabel,
  resolveEmptyBaselineGuidance,
} from "@/features/wbs/utils/wbsBaseline";
import {
  buildBaselineActivateControlKey,
  WBS_BASELINE_CONTROL,
} from "@/features/wbs/composables/useWbsBaselines";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** WBS baseline cardへ親画面から渡す一覧・比較結果・操作状態。 */
interface Props {
  baselineList: WbsBaselineListResponse | null;
  activeBaselineDetail: WbsBaselineDetailResponse | null;
  comparisonRows: WbsBaselineComparisonRow[];
  canManage: boolean;
  /** Projectが利用中（ACTIVE）か。baselineがないときの案内の出し分けに使う。 */
  isProjectActive: boolean;
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
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-camera-timer-outline" class="size-6" />
        WBS baseline
        <UBadge size="sm" variant="outline" class="ms-auto"
          >{{ baselineList?.baselines.length ?? 0 }}件</UBadge
        >
        <UButton
          v-if="canManage"
          color="primary"
          variant="soft"
          icon="i-mdi-camera-plus-outline"
          :disabled="isLoading || isMutating"
          :data-wbs-baseline-control="WBS_BASELINE_CONTROL.create"
          @click="emit('create')"
        >
          現在計画を保存
        </UButton>
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      現在計画を固定snapshotとして残し、active baselineとの差分をTask ID単位で確認します。
      baselineは実績値を変更せず、計画変更の比較基準として使用します。
    </p>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4">{{
      successMessage
    }}</StatusAlert>

    <div v-if="isLoading" class="flex flex-col gap-3">
      <USkeleton v-for="row in 5" :key="row" class="h-8 w-full" />
    </div>
    <template v-else-if="baselineList?.baselines.length">
      <div class="mb-5 overflow-x-auto">
        <table class="app-table app-table-hover min-w-230 [&_td]:h-13 [&_th]:h-13">
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
            <tr v-for="baseline in baselineList.baselines" :key="baseline.baselineId">
              <td>
                <div class="font-medium">#{{ baseline.baselineNumber }} {{ baseline.name }}</div>
                <div class="text-xs text-muted">
                  ID: {{ baseline.baselineId }} / version: {{ baseline.version }}
                </div>
              </td>
              <td>{{ baseline.description || "—" }}</td>
              <td class="whitespace-nowrap">{{ formatBaselineCreatedAt(baseline.createdAt) }}</td>
              <td>
                <UBadge :color="baseline.active ? 'success' : 'neutral'" size="sm">
                  {{ baseline.active ? "比較中" : "保存済み" }}
                </UBadge>
              </td>
              <td v-if="canManage">
                <UButton
                  v-if="!baseline.active"
                  size="sm"
                  variant="ghost"
                  color="primary"
                  icon="i-mdi-check-circle-outline"
                  :loading="activatingBaselineId === baseline.baselineId"
                  :disabled="isMutating"
                  :data-wbs-baseline-control="buildBaselineActivateControlKey(baseline.baselineId)"
                  @click="emit('activate', baseline)"
                >
                  比較対象にする
                </UButton>
                <span v-else class="text-xs text-muted">active</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-if="activeBaselineDetail">
        <div class="mb-4 flex flex-wrap gap-2">
          <UBadge variant="outline">Task {{ activeBaselineDetail.tasks.length }}件</UBadge>
          <UBadge variant="outline"
            >依存関係 {{ activeBaselineDetail.dependencies.length }}件</UBadge
          >
          <UBadge variant="outline"
            >日別予定 {{ activeBaselineDetail.effortPlans.length }}件</UBadge
          >
          <UBadge color="info"
            >予定 {{ formatEffortMinutes(activeBaselineDetail.plannedEffortMinutes) }}</UBadge
          >
          <UBadge color="secondary"
            >配賦済み {{ formatEffortMinutes(activeBaselineDetail.allocatedEffortMinutes) }}</UBadge
          >
          <UBadge
            :color="activeBaselineDetail.unallocatedEffortMinutes === 0 ? 'success' : 'warning'"
          >
            未配賦 {{ formatSignedEffortMinutes(activeBaselineDetail.unallocatedEffortMinutes) }}
          </UBadge>
          <UBadge color="warning">変更 {{ comparisonRows.length }}件</UBadge>
        </div>

        <div v-if="comparisonRows.length" class="overflow-x-auto">
          <table class="app-table app-table-hover min-w-310 [&_td]:h-13 [&_th]:h-13">
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
                  <div class="font-medium">{{ row.wbsCode || "—" }} {{ row.title }}</div>
                  <div class="text-xs text-muted">Task ID: {{ row.sourceTaskId }}</div>
                </td>
                <td>
                  <UBadge :color="getBaselineComparisonStatusColor(row.status)" size="sm">
                    {{ getBaselineComparisonStatusLabel(row.status) }}
                  </UBadge>
                </td>
                <td class="whitespace-nowrap">
                  {{
                    formatBaselinePeriod(row.baselinePlannedStartDate, row.baselinePlannedEndDate)
                  }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatBaselinePeriod(row.currentPlannedStartDate, row.currentPlannedEndDate) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatOptionalEffortMinutes(row.baselinePlannedEffortMinutes) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatOptionalEffortMinutes(row.currentPlannedEffortMinutes) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatSignedEffortMinutes(row.plannedEffortDifferenceMinutes) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <StatusAlert v-else type="success" variant="soft"
          >active baselineからTask予定の変更はありません。</StatusAlert
        >
      </template>
    </template>
    <StatusAlert v-else type="info" variant="soft">
      {{ resolveEmptyBaselineGuidance({ canManage, isProjectActive }) }}
    </StatusAlert>
  </UCard>
</template>
