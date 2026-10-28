<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useAuthorizationAuditListPage } from "@/features/administration/composables/useAuthorizationAuditListPage";
import {
  formatAuthorizationAuditOccurredAt,
  getAuthorizationAuditActionColor,
  getAuthorizationAuditActionLabel,
} from "@/features/administration/utils/authorizationAudit";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  auditLogs,
  changePage,
  changePageSize,
  errorMessages,
  formatRole,
  formatRoles,
  headers,
  initialize,
  isLoading,
  page,
  pageSize,
  pageSizes,
  totalElements,
  totalPages,
} = useAuthorizationAuditListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="p-6">
    <UCard class="mx-auto max-w-350">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-history" class="size-6" />
          権限変更監査ログ
          <span class="ms-auto text-sm font-normal tracking-normal">全{{ totalElements }}件</span>
          <UFormField label="表示件数" class="w-35 pb-0 text-base font-normal tracking-normal">
            <USelect
              :model-value="pageSize"
              :items="pageSizes"
              size="sm"
              :disabled="isLoading"
              class="w-full"
              @update:model-value="changePageSize"
            />
          </UFormField>
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>

      <AppDataTable
        :headers="headers"
        :items="auditLogs"
        :loading="isLoading"
        item-value="authorizationAuditLogId"
        hide-footer
        no-data-text="権限変更監査ログはありません。"
      >
        <template #occurredAt-cell="{ item }">
          {{ formatAuthorizationAuditOccurredAt(item.occurredAt) }}
        </template>
        <template #actorDisplayName-cell="{ item }">
          {{ item.actorDisplayName }}（ID: {{ item.actorAccountId }}）
        </template>
        <template #targetDisplayName-cell="{ item }">
          {{ item.targetDisplayName }}（ID: {{ item.targetAccountId }}）
        </template>
        <template #action-cell="{ item }">
          <UBadge :color="getAuthorizationAuditActionColor(item.action)" size="sm">
            {{ getAuthorizationAuditActionLabel(item.action) }}
          </UBadge>
        </template>
        <template #roleCode-cell="{ item }">
          {{ formatRole(item.roleCode) }}
        </template>
        <template #beforeRoleCodes-cell="{ item }">
          {{ formatRoles(item.beforeRoleCodes) }}
        </template>
        <template #afterRoleCodes-cell="{ item }">
          {{ formatRoles(item.afterRoleCodes) }}
        </template>
      </AppDataTable>

      <div v-if="totalPages > 1" class="mt-4 flex justify-center">
        <UPagination
          :page="page"
          :total="totalElements"
          :items-per-page="pageSize"
          :disabled="isLoading"
          @update:page="changePage"
        />
      </div>
    </UCard>
  </div>
</template>
