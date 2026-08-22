<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  WorkingCalendarDateRange,
  WorkingCalendarDay,
  WorkingCalendarResponse,
  WorkingCalendarTargetOption,
} from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import {
  getWorkingDayOverride,
  getWorkingDaySourceLabel,
  getWorkingDayTypeLabel,
  parseWorkingCalendarTargetKey,
} from "@/features/wbs/utils/workingCalendar";

/** 稼働日calendar cardへ親画面から渡す検索条件、認可状態、確定結果。 */
interface Props {
  dateRange: WorkingCalendarDateRange;
  calendar: WorkingCalendarResponse | null;
  targetOptions: WorkingCalendarTargetOption[];
  selectedTargetKey: string;
  canEditSelectedTarget: boolean;
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
const dateRangeForm = ref<WorkingCalendarDateRange>({ ...props.dateRange });
const targetKeyForm = ref(props.selectedTargetKey);

const selectedTarget = computed(() =>
  parseWorkingCalendarTargetKey(props.selectedTargetKey)
);

/** 親composableで確定した期間・対象を初期表示、再取得、競合回復後に検索欄へ同期する。 */
watch(
  () => [props.dateRange, props.selectedTargetKey] as const,
  ([dateRange, targetKey]) => {
    dateRangeForm.value = { ...dateRange };
    targetKeyForm.value = targetKey;
  },
  { deep: true }
);

/** 入力中の期間・対象を複製し、検証とAPI取得を担当する親composableへ渡す。 */
const submit = (): void => {
  if (!props.isLoading && !props.isMutating) {
    emit("load", { ...dateRangeForm.value }, targetKeyForm.value);
  }
};

/** 現在の表示対象階層に保存された例外を返す。既定値だけの日はnull。 */
const findSelectedOverride = (day: WorkingCalendarDay) =>
  selectedTarget.value === null
    ? null
    : getWorkingDayOverride(day, selectedTarget.value);

/** 設定元をDEFAULT、Project、memberで見分けるVuetify色へ変換する。 */
const getSourceColor = (day: WorkingCalendarDay): string => {
  if (day.source === "MEMBER") {
    return "secondary";
  }
  return day.source === "PROJECT" ? "primary" : "default";
};
</script>

<template>
  <v-card max-width="1600" class="mx-auto mt-4">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <v-icon icon="mdi-calendar-cog-outline" />
      稼働日calendar
      <v-spacer />
      <v-chip size="small" variant="outlined">
        {{ calendar?.days.length ?? 0 }}日
      </v-chip>
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        平日480分・土日0分の既定値へ、Project共通例外、個人例外の順で上書きします。個人例外を表示するとProject共通設定も確認できます。
      </p>
      <v-alert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">
          {{ message }}
        </div>
      </v-alert>
      <v-alert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </v-alert>

      <v-form @submit.prevent="submit">
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-select
              v-model="targetKeyForm"
              label="表示対象"
              :items="targetOptions"
              :disabled="isLoading || isMutating"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="5" md="3">
            <v-text-field
              v-model="dateRangeForm.dateFrom"
              label="開始日"
              type="date"
              :disabled="isLoading || isMutating"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="5" md="3">
            <v-text-field
              v-model="dateRangeForm.dateTo"
              label="終了日"
              type="date"
              :disabled="isLoading || isMutating"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="2" md="2">
            <v-btn
              type="submit"
              color="primary"
              prepend-icon="mdi-magnify"
              :loading="isLoading"
              :disabled="isMutating || targetOptions.length === 0"
              block
            >
              表示
            </v-btn>
          </v-col>
        </v-row>
      </v-form>

      <v-alert
        v-if="!canEditSelectedTarget"
        type="info"
        variant="tonal"
        class="mt-4"
      >
        この表示対象は参照専用です。Project共通設定はOWNER・MANAGER・SYSTEM_ADMIN、個人例外は本人またはProject管理者が変更できます。
      </v-alert>

      <v-skeleton-loader v-if="isLoading" type="table" class="mt-4" />
      <template v-else-if="calendar">
        <div v-if="calendar.days.length" class="calendar-table-scroll mt-4">
          <v-table hover class="calendar-table">
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
                <td class="text-no-wrap">{{ day.workDate }}</td>
                <td>
                  <v-chip
                    :color="day.dayType === 'HOLIDAY' ? 'warning' : 'success'"
                    size="small"
                    variant="tonal"
                  >
                    {{ getWorkingDayTypeLabel(day.dayType) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">
                  {{ formatEffortMinutes(day.availableMinutes) }}
                </td>
                <td>
                  <v-chip :color="getSourceColor(day)" size="small" variant="outlined">
                    {{ getWorkingDaySourceLabel(day.source) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">
                  <template v-if="day.projectOverride">
                    {{ getWorkingDayTypeLabel(day.projectOverride.dayType) }}・{{ formatEffortMinutes(day.projectOverride.availableMinutes) }}
                  </template>
                  <span v-else class="text-medium-emphasis">未設定</span>
                </td>
                <td v-if="calendar.accountId !== null" class="text-no-wrap">
                  <template v-if="day.memberOverride">
                    {{ getWorkingDayTypeLabel(day.memberOverride.dayType) }}・{{ formatEffortMinutes(day.memberOverride.availableMinutes) }}
                  </template>
                  <span v-else class="text-medium-emphasis">未設定</span>
                </td>
                <td>
                  <div v-if="canEditSelectedTarget" class="d-flex ga-1">
                    <v-btn
                      icon="mdi-pencil-outline"
                      size="small"
                      variant="text"
                      :disabled="isMutating"
                      :aria-label="`${day.workDate}の稼働日例外を${findSelectedOverride(day) ? '編集' : '登録'}`"
                      @click="emit('edit', day.workDate)"
                    />
                    <v-btn
                      v-if="findSelectedOverride(day)"
                      icon="mdi-delete-outline"
                      color="error"
                      size="small"
                      variant="text"
                      :disabled="isMutating"
                      :aria-label="`${day.workDate}の稼働日例外を削除`"
                      @click="emit('requestDelete', day.workDate)"
                    />
                  </div>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-else type="info" variant="tonal" class="mt-4">
          指定期間のcalendar日付はありません。
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.calendar-table-scroll {
  overflow-x: auto;
}

.calendar-table {
  min-width: 1120px;
}
</style>
