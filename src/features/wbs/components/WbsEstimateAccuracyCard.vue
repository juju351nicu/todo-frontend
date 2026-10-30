<script setup lang="ts">
import { computed } from "vue";

import { useEstimateAccuracyChart } from "@/features/wbs/composables/useEstimateAccuracyChart";
import WbsEstimateOutcomeComparison from "@/features/wbs/components/WbsEstimateOutcomeComparison.vue";
import type { EstimateAccuracyResponse } from "@/features/wbs/types/wbs";
import {
  formatEffortMinutes,
  formatOptionalEffortMinutes,
  formatSignedEffortMinutes,
} from "@/features/wbs/utils/effort";
import {
  describeEstimateBias,
  formatEstimateAccuracyTaskLabel,
  formatOptionalSignedEffortMinutes,
  formatWithinToleranceRate,
  isEstimateAccuracyReferenceOnly,
} from "@/features/wbs/utils/estimateAccuracy";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/** 見積もり精度cardへ親画面から渡す確定結果と取得状態。 */
interface Props {
  /** Backendが確定した見積もり精度。未取得の場合はnull。 */
  estimateAccuracy: EstimateAccuracyResponse | null;
  isLoading: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  /** 最新の予定・実績で再集計する。API取得は親composableが行う。 */
  load: [];
}>();

const { activePoint, chart, hidePoint, showPoint, tasksByAbsoluteError } = useEstimateAccuracyChart(
  () => props.estimateAccuracy
);

/**
 * SVGの座標系。横軸・縦軸の描画領域を同じ長さにし、対角線が45度の「予定どおり」線になるようにする。
 * 右端の目盛り文字（例: `16時間`）が切れないよう、描画領域の右に余白を取る。
 */
const PLOT = { left: 72, top: 16, size: 320, width: 432, height: 392 } as const;

/** 0〜1の割合で表した点を、SVGのpixel座標（左上原点）へ変換する。 */
const toSvgX = (ratio: number): number => PLOT.left + ratio * PLOT.size;
const toSvgY = (ratio: number): number => PLOT.top + (1 - ratio) * PLOT.size;

/** 「見積もりどおり」の帯を描くSVG polygonの頂点列。 */
const toleranceBandPoints = computed(
  () =>
    chart.value?.toleranceBand
      .map((vertex) => `${toSvgX(vertex.x)},${toSvgY(vertex.y)}`)
      .join(" ") ?? ""
);
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-chart-scatter-plot" class="size-6" />
        見積もり精度
        <UBadge size="sm" variant="outline" class="ms-auto"
          >完了Task {{ estimateAccuracy?.completedTaskCount ?? 0 }}件</UBadge
        >
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      完了した通常Taskの予定工数と、日別実績の合計を比べます。予定どおりなら点は対角線の上に並びます。
      帯の中は誤差が予定工数の±{{
        estimateAccuracy?.tolerancePercent ?? 20
      }}%以内です。AIの利用による短縮効果は表しません。
    </p>
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <UButton
      icon="i-mdi-refresh"
      color="primary"
      variant="soft"
      :loading="isLoading"
      @click="emit('load')"
      >再集計</UButton
    >

    <div v-if="isLoading" class="mt-4 flex flex-col gap-3">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
    <template v-else-if="estimateAccuracy">
      <dl class="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt class="text-xs text-muted">誤差の中央値</dt>
          <dd class="text-xl font-medium">
            {{ formatOptionalEffortMinutes(estimateAccuracy.medianAbsoluteErrorMinutes) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            見積もりどおり（±{{ estimateAccuracy.tolerancePercent }}%以内）
          </dt>
          <dd class="text-xl font-medium">{{ formatWithinToleranceRate(estimateAccuracy) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">傾向（実績 - 予定の中央値）</dt>
          <dd class="text-xl font-medium">
            {{ formatOptionalSignedEffortMinutes(estimateAccuracy.medianSignedVarianceMinutes) }}
          </dd>
          <dd class="text-xs text-muted">
            {{ describeEstimateBias(estimateAccuracy.medianSignedVarianceMinutes) }}
          </dd>
        </div>
      </dl>

      <StatusAlert
        v-if="estimateAccuracy.sampleCount > 0 && isEstimateAccuracyReferenceOnly(estimateAccuracy)"
        type="info"
        variant="soft"
        class="mt-4"
      >
        比較できたTaskが{{ estimateAccuracy.sampleCount }}件のため参考値です。{{
          estimateAccuracy.minimumSampleCount
        }}件以上で傾向として読めます。
      </StatusAlert>
      <p
        v-if="estimateAccuracy.missingPlanTaskCount || estimateAccuracy.missingActualTaskCount"
        class="mt-3 mb-0 text-xs text-muted"
      >
        予定工数が未入力のため除外:
        {{ estimateAccuracy.missingPlanTaskCount }}件／実績が未入力のため除外:
        {{ estimateAccuracy.missingActualTaskCount }}件
      </p>

      <div v-if="chart" class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <!-- 1列表示の狭い画面でも文字が拡大されすぎないよう、散布図の幅に上限を設ける。 -->
        <figure class="relative m-0 w-full max-w-[520px]">
          <svg
            :viewBox="`0 0 ${PLOT.width} ${PLOT.height}`"
            class="block h-auto w-full"
            role="img"
            :aria-label="`予定工数と実績工数の散布図。${estimateAccuracy.sampleCount}件。詳細は右の一覧を参照してください。`"
          >
            <g class="text-muted" fill="currentColor" font-size="11">
              <template v-for="tick in chart.ticks" :key="tick.minutes">
                <line
                  :x1="toSvgX(0)"
                  :x2="toSvgX(1)"
                  :y1="toSvgY(tick.ratio)"
                  :y2="toSvgY(tick.ratio)"
                  stroke="var(--ui-border)"
                />
                <line
                  :x1="toSvgX(tick.ratio)"
                  :x2="toSvgX(tick.ratio)"
                  :y1="toSvgY(0)"
                  :y2="toSvgY(1)"
                  stroke="var(--ui-border)"
                />
                <text :x="toSvgX(0) - 8" :y="toSvgY(tick.ratio) + 4" text-anchor="end">
                  {{ tick.label }}
                </text>
                <text :x="toSvgX(tick.ratio)" :y="toSvgY(0) + 18" text-anchor="middle">
                  {{ tick.label }}
                </text>
              </template>
              <text :x="toSvgX(0.5)" :y="PLOT.height - 6" text-anchor="middle" font-size="12">
                予定工数
              </text>
              <text
                :x="14"
                :y="toSvgY(0.5)"
                text-anchor="middle"
                font-size="12"
                :transform="`rotate(-90 14 ${toSvgY(0.5)})`"
              >
                実績工数
              </text>
            </g>
            <polygon :points="toleranceBandPoints" fill="var(--ui-primary)" fill-opacity="0.08" />
            <line
              :x1="toSvgX(0)"
              :y1="toSvgY(0)"
              :x2="toSvgX(1)"
              :y2="toSvgY(1)"
              stroke="var(--ui-border-accented)"
              stroke-width="2"
              stroke-dasharray="6 4"
            />
            <g
              v-for="point in chart.points"
              :key="point.task.taskId"
              tabindex="0"
              class="cursor-pointer outline-none"
              :aria-label="`${formatEstimateAccuracyTaskLabel(point.task)}: 予定${formatEffortMinutes(point.task.plannedEffortMinutes)}、実績${formatEffortMinutes(point.task.actualEffortMinutes)}`"
              @mouseenter="showPoint(point.task.taskId)"
              @mouseleave="hidePoint(point.task.taskId)"
              @focus="showPoint(point.task.taskId)"
              @blur="hidePoint(point.task.taskId)"
            >
              <!-- 点より大きい透明な円をhit targetにし、小さな点でもhoverしやすくする。 -->
              <circle :cx="toSvgX(point.x)" :cy="toSvgY(point.y)" r="12" fill="transparent" />
              <circle
                :cx="toSvgX(point.x)"
                :cy="toSvgY(point.y)"
                :r="activePoint?.task.taskId === point.task.taskId ? 7 : 5"
                fill="var(--ui-primary)"
                stroke="var(--ui-bg)"
                stroke-width="2"
              />
            </g>
          </svg>
          <div
            v-if="activePoint"
            class="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-sm bg-inverted px-3 py-2 text-xs text-inverted shadow-md"
            :style="{
              left: `${(toSvgX(activePoint.x) / PLOT.width) * 100}%`,
              top: `calc(${(toSvgY(activePoint.y) / PLOT.height) * 100}% - 12px)`,
            }"
            role="tooltip"
          >
            <div class="mb-1 font-medium">
              {{ formatEstimateAccuracyTaskLabel(activePoint.task) }}
            </div>
            <div>予定 {{ formatEffortMinutes(activePoint.task.plannedEffortMinutes) }}</div>
            <div>実績 {{ formatEffortMinutes(activePoint.task.actualEffortMinutes) }}</div>
            <div>差 {{ formatSignedEffortMinutes(activePoint.task.signedVarianceMinutes) }}</div>
          </div>
          <!-- 対角線・帯の意味は、データの点と重ならないよう描画領域の外の凡例で示す。 -->
          <figcaption class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span class="inline-flex items-center gap-2">
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke="var(--ui-border-accented)"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                />
              </svg>
              予定どおり（実績 = 予定）
            </span>
            <span class="inline-flex items-center gap-2">
              <span class="inline-block h-3 w-5 rounded-xs bg-primary/8" aria-hidden="true" />
              誤差が予定の±{{ estimateAccuracy.tolerancePercent }}%以内
            </span>
          </figcaption>
        </figure>

        <div class="overflow-x-auto">
          <table class="app-table app-table-hover min-w-120 [&_td]:h-11 [&_th]:h-11">
            <caption class="pb-2 text-start text-sm text-muted">
              誤差の大きいTask順
            </caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">予定</th>
                <th scope="col">実績</th>
                <th scope="col">差</th>
                <th scope="col">判定</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasksByAbsoluteError" :key="task.taskId">
                <td>{{ formatEstimateAccuracyTaskLabel(task) }}</td>
                <td class="whitespace-nowrap">
                  {{ formatEffortMinutes(task.plannedEffortMinutes) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatEffortMinutes(task.actualEffortMinutes) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ formatSignedEffortMinutes(task.signedVarianceMinutes) }}
                </td>
                <td class="whitespace-nowrap">
                  <UBadge v-if="task.withinTolerance" size="sm" variant="outline" icon="i-mdi-check"
                    >範囲内</UBadge
                  >
                  <UBadge
                    v-else
                    size="sm"
                    variant="outline"
                    color="neutral"
                    icon="i-mdi-arrow-expand-horizontal"
                  >
                    範囲外
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <StatusAlert v-else type="info" variant="soft" class="mt-4">
        予定工数と実績の両方がある完了Taskはまだありません。予定工数を入れたTaskを完了し、日別実績を登録すると表示されます。
      </StatusAlert>

      <WbsEstimateOutcomeComparison :comparison="estimateAccuracy.outcomeComparison" />
    </template>
  </UCard>
</template>
