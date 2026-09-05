<script setup lang="ts">
import { ref, watch } from "vue";

import type { WbsReportType } from "@/features/wbs/types/wbs";

/** WBS Excel出力cardへ親画面から渡す共通基準日とdownload状態。 */
interface Props {
  statusDate: string;
  exportingReportType: WbsReportType | null;
  errorMessages: string[];
  successMessage: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  download: [reportType: WbsReportType, statusDate: string];
}>();
const formStatusDate = ref(props.statusDate);

/** EVM集計等で親composableの共通基準日が変わった場合に入力欄へ同期する。 */
watch(
  () => props.statusDate,
  (statusDate) => {
    formStatusDate.value = statusDate;
  }
);

/** 二重送信を避け、選択した期間と入力中の基準日を親composableへ渡す。 */
const requestDownload = (reportType: WbsReportType): void => {
  if (props.exportingReportType === null) {
    emit("download", reportType, formStatusDate.value);
  }
};
</script>

<template>
  <v-card max-width="1600" class="mx-auto mt-4">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <v-icon icon="mdi-file-excel-outline" />
      WBS Excel帳票
      <v-spacer />
      <v-chip size="small" variant="outlined">.xlsx</v-chip>
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        active baselineのEVM、現在WBS、担当者別工数、警告を週次または月次のExcelへ出力します。
        基準日はEVM集計と共通です。
      </p>

      <v-alert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">
          {{ message }}
        </div>
      </v-alert>
      <v-alert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </v-alert>

      <v-row align="center">
        <v-col cols="12" sm="5" md="3">
          <v-text-field
            v-model="formStatusDate"
            label="帳票基準日"
            type="date"
            :disabled="exportingReportType !== null"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="3" md="2">
          <v-btn
            color="success"
            prepend-icon="mdi-calendar-week"
            :loading="exportingReportType === 'weekly'"
            :disabled="exportingReportType !== null"
            block
            @click="requestDownload('weekly')"
          >
            週次Excel
          </v-btn>
        </v-col>
        <v-col cols="12" sm="3" md="2">
          <v-btn
            color="success"
            variant="tonal"
            prepend-icon="mdi-calendar-month"
            :loading="exportingReportType === 'monthly'"
            :disabled="exportingReportType !== null"
            block
            @click="requestDownload('monthly')"
          >
            月次Excel
          </v-btn>
        </v-col>
      </v-row>

      <p class="text-caption text-medium-emphasis mt-3 mb-0">
        週次は基準日を含む月曜日から、月次は基準月の1日から基準日までを対象にします。
      </p>
    </v-card-text>
  </v-card>
</template>
