<script setup lang="ts">
import { computed } from "vue";

import type { TaskEstimateOutcomeComparison } from "@/features/wbs/types/wbs";
import { formatOptionalEffortMinutes } from "@/features/wbs/utils/effort";
import {
  describeEstimateBias,
  formatOptionalSignedEffortMinutes,
  formatOutcomeActualEndDateRange,
  formatOutcomeWithinToleranceRate,
  isOutcomeComparisonReferenceOnly,
} from "@/features/wbs/utils/estimateAccuracy";
import {
  formatEstimateAssistanceMode,
  formatEstimateVarianceReason,
} from "@/features/wbs/utils/taskEstimate";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** 最新完了評価revisionの比較表示へ渡すBackend確定済み集計。 */
interface Props {
  comparison: TaskEstimateOutcomeComparison;
}

const props = defineProps<Props>();

const accuracyMetrics = computed(() => [
  {
    key: "human-estimate",
    title: "Human Estimate",
    description: "AI提案を見る前に保存した見積もり",
    metric: props.comparison.humanEstimate,
  },
  {
    key: "final-plan",
    title: "Final Plan",
    description: "採否・調整後の正式予定",
    metric: props.comparison.finalPlan,
  },
]);
</script>

<template>
  <section class="mt-8 border-t border-default pt-6" aria-labelledby="estimate-outcome-heading">
    <div class="flex flex-wrap items-center gap-2">
      <h3 id="estimate-outcome-heading" class="text-base font-medium">評価revision比較</h3>
      <UBadge size="sm" variant="outline" class="ms-auto">
        評価済み {{ comparison.evaluatedTaskCount }}件
      </UBadge>
    </div>
    <p class="mt-2 mb-0 text-sm text-muted">
      Taskごとの最新評価revisionを使い、Human EstimateとFinal
      Planを同じActualに対して比べます。観測値であり、AI支援による短縮効果は表しません。
    </p>

    <StatusAlert v-if="comparison.evaluatedTaskCount === 0" type="info" variant="soft" class="mt-4">
      完了Taskの評価はまだありません。見積もり履歴から完了Taskを評価すると比較できます。
    </StatusAlert>

    <template v-else>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt class="text-xs text-muted">ペア比較できたTask</dt>
          <dd class="font-medium">{{ comparison.pairedSampleCount }}件</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Human Estimate未入力</dt>
          <dd class="font-medium">{{ comparison.missingHumanEstimateTaskCount }}件</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">実績終了日の範囲</dt>
          <dd class="font-medium">{{ formatOutcomeActualEndDateRange(comparison) }}</dd>
        </div>
      </dl>

      <StatusAlert
        v-if="isOutcomeComparisonReferenceOnly(comparison)"
        type="info"
        variant="soft"
        class="mt-4"
      >
        ペア比較できたTaskが{{ comparison.pairedSampleCount }}件のため参考値です。{{
          comparison.minimumSampleCount
        }}件以上で傾向として読めます。
      </StatusAlert>
      <StatusAlert
        v-else-if="comparison.pairedSampleCount === 0"
        type="info"
        variant="soft"
        class="mt-4"
      >
        評価済みTaskにHuman Estimateがないため、HumanとFinalの精度をまだ比較できません。
      </StatusAlert>

      <div v-if="comparison.pairedSampleCount > 0" class="mt-4 grid gap-4 md:grid-cols-2">
        <UCard v-for="accuracy in accuracyMetrics" :key="accuracy.key" variant="subtle">
          <div class="font-medium">{{ accuracy.title }}</div>
          <p class="mt-1 mb-3 text-xs text-muted">{{ accuracy.description }}</p>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted">絶対誤差の平均</dt>
              <dd class="font-medium">
                {{ formatOptionalEffortMinutes(accuracy.metric.meanAbsoluteErrorMinutes) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">絶対誤差の中央値</dt>
              <dd class="font-medium">
                {{ formatOptionalEffortMinutes(accuracy.metric.medianAbsoluteErrorMinutes) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">±{{ comparison.tolerancePercent }}%以内</dt>
              <dd class="font-medium">
                {{
                  formatOutcomeWithinToleranceRate(accuracy.metric, comparison.pairedSampleCount)
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">実績との差の中央値</dt>
              <dd class="font-medium">
                {{ formatOptionalSignedEffortMinutes(accuracy.metric.medianSignedVarianceMinutes) }}
              </dd>
              <dd class="text-xs text-muted">
                {{ describeEstimateBias(accuracy.metric.medianSignedVarianceMinutes) }}
              </dd>
            </div>
          </dl>
        </UCard>
      </div>

      <div class="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h4 class="text-sm font-medium">実際に利用したAI支援</h4>
          <div class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="item in comparison.actualAssistanceModes"
              :key="item.code"
              color="neutral"
              variant="outline"
            >
              {{ formatEstimateAssistanceMode(item.code) }} {{ item.count }}件
            </UBadge>
          </div>
        </div>
        <div>
          <h4 class="text-sm font-medium">Final PlanとActualの誤差理由</h4>
          <div class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="item in comparison.varianceReasons"
              :key="item.code"
              color="neutral"
              variant="outline"
            >
              {{ formatEstimateVarianceReason(item.code) }} {{ item.count }}件
            </UBadge>
            <UBadge v-if="comparison.noVarianceTaskCount" color="neutral" variant="outline">
              差なし {{ comparison.noVarianceTaskCount }}件
            </UBadge>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
