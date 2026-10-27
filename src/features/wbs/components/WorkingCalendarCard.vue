<script setup lang="ts">
import { computed } from "vue";

import type {
  WorkingCalendarDateRange,
  WorkingCalendarDay,
  WorkingCalendarResponse,
  WorkingCalendarTargetOption,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import {
  getWorkingDayOverride,
  getWorkingDaySourceColor,
  getWorkingDaySourceLabel,
  getWorkingDayTypeLabel,
  parseWorkingCalendarTargetKey,
} from "@/features/wbs/utils/workingCalendar";
import {
  WORKING_CALENDAR_SUBMIT_CONTROL,
  workingDayEditControlKey,
} from "@/features/wbs/composables/useWbsWorkingCalendar";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useSyncedDraft } from "@/shared/composables/useSyncedDraft";

/** 稼働日calendar cardへ親画面から渡す検索条件、認可状態、確定結果。 */
interface Props {
  dateRange: WorkingCalendarDateRange;
  calendar: WorkingCalendarResponse | null;
  targetOptions: WorkingCalendarTargetOption[];
  selectedTargetKey: string;
  canEditSelectedTarget: boolean;
  /** 変更できない理由の案内。変更できる場合はnull。 */
  readOnlyMessage: string | null;
  isLoading: boolean;
  isMutating: boolean;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  load: [dateRange: WorkingCalendarDateRange, targetKey: string];
  edit: [workDate: string];
  requestDelete: [workDate: string];
}>();

// 親composableで確定した期間・対象を、初期表示・再取得・競合回復後に検索欄へ同期する。
const dateRangeForm = useSyncedDraft(
  () => props.dateRange,
  (dateRange) => ({ ...dateRange }),
);
const targetKeyForm = useSyncedDraft(() => props.selectedTargetKey);

const selectedTarget = computed(() => parseWorkingCalendarTargetKey(props.selectedTargetKey));

/** 入力中の期間・対象を複製し、検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading && !props.isMutating) {
    emit("load", { ...dateRangeForm.value }, targetKeyForm.value);
  }
};

/** 現在の表示対象階層に保存された例外を返す。既定値だけの日はnull。 */
const findSelectedOverride = (day: WorkingCalendarDay) =>
  selectedTarget.value === null ? null : getWorkingDayOverride(day, selectedTarget.value);
</script>

<template>
  <!--
    操作結果のmessageを画面上端に固定するため、cardの外枠のoverflow-hiddenを外す（stickyはoverflowを持つ祖先の中でしか効かない）。
  -->
  <UCard class="mx-auto mt-4 max-w-400" :ui="{ root: 'overflow-visible' }">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-calendar-cog-outline" class="size-6" />
        稼働日calendar
        <UBadge size="sm" variant="outline" class="ms-auto">{{ calendar?.days.length ?? 0 }}日</UBadge>
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      平日480分・土日0分の既定値へ、Project共通例外、個人例外の順で上書きします。個人例外を表示するとProject共通設定も確認できます。
    </p>
    <!--
      操作結果のmessageは、calendarを下へスクロールしている間も画面上端（固定ヘッダーの下）に出す。
      月末の行で登録・削除すると、card上端のmessageが画面外になり結果が分からなかったため（動作確認/19_workload_稼働日calendar G-3・G-5）。
      負のmarginとpaddingでcard本文の左右の余白（nuxtUiTheme.ts の card.body の p-4）まで覆い、下を流れる表が透けないようにする。
    -->
    <div v-if="errorMessages.length || successMessage" class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-default px-4 pt-2 pb-4">
      <StatusAlert v-if="errorMessages.length" type="error">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success">{{ successMessage }}</StatusAlert>
    </div>

    <form @submit.prevent="submit">
      <div class="-m-3 flex flex-wrap items-center">
        <div class="w-full p-3 md:w-1/3">
          <UFormField label="表示対象" class="pb-0">
            <USelect
              v-model="targetKeyForm"
              :items="targetOptions"
              label-key="title"
              value-key="value"
              :disabled="isLoading || isMutating"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-5/12 md:w-1/4">
          <UFormField label="開始日" class="pb-0">
            <UInput v-model="dateRangeForm.dateFrom" type="date" :disabled="isLoading || isMutating" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-5/12 md:w-1/4">
          <UFormField label="終了日" class="pb-0">
            <UInput v-model="dateRangeForm.dateTo" type="date" :disabled="isLoading || isMutating" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/6">
          <UButton
            type="submit"
            color="primary"
            icon="i-mdi-magnify"
            :loading="isLoading"
            :disabled="isMutating || targetOptions.length === 0"
            :data-working-calendar-control="WORKING_CALENDAR_SUBMIT_CONTROL"
            block
          >
            表示
          </UButton>
        </div>
      </div>
    </form>

    <StatusAlert v-if="readOnlyMessage" type="info" variant="soft" class="mt-4">{{ readOnlyMessage }}</StatusAlert>

    <div v-if="isLoading" class="mt-4 flex flex-col gap-3">
      <USkeleton v-for="row in 5" :key="row" class="h-8 w-full" />
    </div>
    <template v-else-if="calendar">
      <div v-if="calendar.days.length" class="mt-4 overflow-x-auto">
        <table class="app-table app-table-hover min-w-280 [&_td]:h-13 [&_th]:h-13">
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">有効種別</th>
              <th scope="col">稼働可能時間</th>
              <th scope="col">設定元</th>
              <th scope="col">Project共通</th>
              <th v-if="calendar.accountId !== null" scope="col">個人例外</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in calendar.days" :key="day.workDate">
              <td class="whitespace-nowrap">{{ day.workDate }}</td>
              <td>
                <UBadge :color="day.dayType === 'HOLIDAY' ? 'warning' : 'success'" size="sm">
                  {{ getWorkingDayTypeLabel(day.dayType) }}
                </UBadge>
              </td>
              <td class="whitespace-nowrap">{{ formatEffortMinutes(day.availableMinutes) }}</td>
              <td>
                <UBadge :color="getWorkingDaySourceColor(day.source)" size="sm" variant="outline">
                  {{ getWorkingDaySourceLabel(day.source) }}
                </UBadge>
              </td>
              <td class="whitespace-nowrap">
                <template v-if="day.projectOverride">
                  {{ getWorkingDayTypeLabel(day.projectOverride.dayType) }}・{{ formatEffortMinutes(day.projectOverride.availableMinutes) }}
                </template>
                <span v-else class="text-muted">未設定</span>
              </td>
              <td v-if="calendar.accountId !== null" class="whitespace-nowrap">
                <template v-if="day.memberOverride">
                  {{ getWorkingDayTypeLabel(day.memberOverride.dayType) }}・{{ formatEffortMinutes(day.memberOverride.availableMinutes) }}
                </template>
                <span v-else class="text-muted">未設定</span>
              </td>
              <td>
                <div v-if="canEditSelectedTarget" class="flex gap-1">
                  <UButton
                    icon="i-mdi-pencil-outline"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="isMutating"
                    :data-working-calendar-control="workingDayEditControlKey(day.workDate)"
                    :aria-label="`${day.workDate}の稼働日例外を${findSelectedOverride(day) ? '編集' : '登録'}`"
                    @click="emit('edit', day.workDate)"
                  />
                  <UButton
                    v-if="findSelectedOverride(day)"
                    icon="i-mdi-delete-outline"
                    color="error"
                    size="sm"
                    variant="ghost"
                    square
                    :disabled="isMutating"
                    :aria-label="`${day.workDate}の稼働日例外を削除`"
                    @click="emit('requestDelete', day.workDate)"
                  />
                </div>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatusAlert v-else type="info" variant="soft" class="mt-4">指定期間のcalendar日付はありません。</StatusAlert>
    </template>
  </UCard>
</template>
