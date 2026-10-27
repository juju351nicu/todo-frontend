<script setup lang="ts">
import type { WbsReportType } from "@/features/wbs/types/wbs";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { useSyncedDraft } from "@/shared/composables/useSyncedDraft";

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

// EVM集計等で親composableの共通基準日が変わった場合に入力欄へ同期する。
const formStatusDate = useSyncedDraft(() => props.statusDate);

/** 二重送信を避け、選択した期間と入力中の基準日を親composableへ渡す。 */
const requestDownload = (reportType: WbsReportType): void => {
  if (props.exportingReportType === null) {
    emit("download", reportType, formStatusDate.value);
  }
};
</script>

<template>
  <UCard class="mx-auto mt-4 max-w-400">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-file-excel-outline" class="size-6" />
        WBS Excel帳票
        <UBadge size="sm" variant="outline" class="ms-auto">.xlsx</UBadge>
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">
      active baselineのEVM、現在WBS、担当者別工数、警告を週次または月次のExcelへ出力します。 基準日はEVM集計と共通です。
    </p>

    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>

    <div class="-m-3 flex flex-wrap items-center">
      <div class="w-full p-3 sm:w-5/12 md:w-1/4">
        <UFormField label="帳票基準日" class="pb-0">
          <UInput v-model="formStatusDate" type="date" :disabled="exportingReportType !== null" class="w-full" />
        </UFormField>
      </div>
      <div class="w-full p-3 sm:w-1/4 md:w-1/6">
        <UButton
          color="success"
          icon="i-mdi-calendar-week"
          :loading="exportingReportType === 'weekly'"
          :disabled="exportingReportType !== null"
          data-wbs-report-control="weekly"
          block
          @click="requestDownload('weekly')"
        >
          週次Excel
        </UButton>
      </div>
      <div class="w-full p-3 sm:w-1/4 md:w-1/6">
        <UButton
          color="success"
          variant="soft"
          icon="i-mdi-calendar-month"
          :loading="exportingReportType === 'monthly'"
          :disabled="exportingReportType !== null"
          data-wbs-report-control="monthly"
          block
          @click="requestDownload('monthly')"
        >
          月次Excel
        </UButton>
      </div>
    </div>

    <p class="mt-3 mb-0 text-xs text-muted">週次は基準日を含む月曜日から、月次は基準月の1日から基準日までを対象にします。</p>
  </UCard>
</template>
