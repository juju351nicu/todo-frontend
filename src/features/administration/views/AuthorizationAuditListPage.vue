<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useAuthorizationAuditListPage } from "@/features/administration/composables/useAuthorizationAuditListPage";
import {
  formatAuthorizationAuditOccurredAt,
  formatRoleCodes,
  getAuthorizationAuditActionColor,
  getAuthorizationAuditActionLabel,
} from "@/features/administration/utils/authorizationAudit";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  auditLogs,
  changePage,
  changePageSize,
  errorMessages,
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
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="pa-6">
    <v-card class="mx-auto" max-width="1400">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-history" />
        権限変更監査ログ
        <v-spacer />
        <span class="text-body-2">全{{ totalElements }}件</span>
        <v-select
          :model-value="pageSize"
          :items="pageSizes"
          label="表示件数"
          density="compact"
          hide-details
          max-width="140"
          :disabled="isLoading"
          @update:model-value="changePageSize"
        />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>

        <v-data-table
          :headers="headers"
          :items="auditLogs"
          :loading="isLoading"
          item-value="authorizationAuditLogId"
          :items-per-page="-1"
          hide-default-footer
          density="compact"
        >
          <template #item.occurredAt="{ value }">
            {{ formatAuthorizationAuditOccurredAt(value) }}
          </template>
          <template #item.actorDisplayName="{ item }">
            {{ item.actorDisplayName }}（ID: {{ item.actorAccountId }}）
          </template>
          <template #item.targetDisplayName="{ item }">
            {{ item.targetDisplayName }}（ID: {{ item.targetAccountId }}）
          </template>
          <template #item.action="{ value }">
            <v-chip :color="getAuthorizationAuditActionColor(value)" size="small">
              {{ getAuthorizationAuditActionLabel(value) }}
            </v-chip>
          </template>
          <template #item.beforeRoleCodes="{ value }">
            {{ formatRoleCodes(value) }}
          </template>
          <template #item.afterRoleCodes="{ value }">
            {{ formatRoleCodes(value) }}
          </template>
          <template #no-data>権限変更監査ログはありません。</template>
        </v-data-table>

        <v-pagination
          v-if="totalPages > 1"
          :model-value="page"
          :length="totalPages"
          :disabled="isLoading"
          class="mt-4"
          @update:model-value="changePage"
        />
      </v-card-text>
    </v-card>
  </v-container>
</template>
