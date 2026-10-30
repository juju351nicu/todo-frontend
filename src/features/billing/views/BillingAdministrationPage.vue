<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useBillingAdministrationPage } from "@/features/billing/composables/useBillingAdministrationPage";
import {
  formatBillingDateTime,
  getBillableFeatureLabel,
  getBillingPlanLabel,
  getBillingSubscriptionStatusColor,
  getBillingSubscriptionStatusLabel,
  getReconciliationErrorLabel,
} from "@/features/billing/utils/billingDisplay";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { getAccountStatusColor, getAccountStatusLabel } from "@/shared/utils/accountStatus";

const {
  accounts,
  canReconcile,
  canReconcileAccount,
  changePage,
  changePageSize,
  errorMessages,
  headers,
  initialize,
  isLoading,
  page,
  pageSize,
  pageSizes,
  reconcileAccount,
  reconcilingAccountId,
  successMessage,
  totalElements,
  totalPages,
} = useBillingAdministrationPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="page-surface min-h-full p-6">
    <UCard class="mx-auto max-w-400">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-credit-card-search-outline" class="size-6" />
          <span>課金管理</span>
          <span class="ms-auto text-sm font-normal tracking-normal">全{{ totalElements }}件</span>
          <UFormField label="表示件数" class="w-35 pb-0 text-base font-normal tracking-normal">
            <USelect
              :model-value="pageSize"
              :items="pageSizes"
              size="sm"
              :disabled="isLoading || reconcilingAccountId !== null"
              class="w-full"
              @update:model-value="changePageSize"
            />
          </UFormField>
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </StatusAlert>
      <StatusAlert v-if="!canReconcile" type="info" class="mb-4">
        課金状態を参照できます。Stripeとの手動再照合にはBILLING_RECONCILE permissionが必要です。
      </StatusAlert>

      <AppDataTable
        :headers="headers"
        :items="accounts"
        :loading="isLoading"
        item-value="accountId"
        hide-footer
        no-data-text="課金状態を表示できるアカウントはありません。"
      >
        <template #account-cell="{ item }">
          <div class="min-w-34">
            <div>{{ item.displayName }}</div>
            <div class="text-xs text-muted">ID: {{ item.accountId }}</div>
          </div>
        </template>
        <template #accountStatus-cell="{ item }">
          <div class="flex min-w-28 flex-col items-start gap-1">
            <UBadge :color="getAccountStatusColor(item.accountStatus)" size="sm">
              {{ getAccountStatusLabel(item.accountStatus) }}
            </UBadge>
            <span class="text-xs text-muted">
              Customer {{ item.billingCustomerConfigured ? "設定済み" : "未作成" }}
            </span>
          </div>
        </template>
        <template #subscription-cell="{ item }">
          <div class="flex min-w-32 flex-col items-start gap-1">
            <UBadge :color="item.subscriptionAccessible ? 'success' : 'neutral'" size="sm">
              {{ getBillingPlanLabel(item.planCode) }}
            </UBadge>
            <UBadge :color="getBillingSubscriptionStatusColor(item.subscriptionStatus)" size="sm">
              {{ getBillingSubscriptionStatusLabel(item.subscriptionStatus) }}
            </UBadge>
            <span v-if="item.cancelAtPeriodEnd" class="text-xs text-warning">期間末解約予定</span>
          </div>
        </template>
        <template #featureCodes-cell="{ item }">
          <div v-if="item.featureCodes.length" class="flex min-w-44 flex-wrap gap-1 py-1">
            <UBadge
              v-for="featureCode in item.featureCodes"
              :key="featureCode"
              color="info"
              size="sm"
            >
              {{ getBillableFeatureLabel(featureCode) }}
            </UBadge>
          </div>
          <span v-else class="text-muted">なし</span>
        </template>
        <template #periods-cell="{ item }">
          <dl class="min-w-48 text-xs">
            <div>
              <dt class="inline text-muted">契約末:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.currentPeriodEndAt) }}</dd>
            </div>
            <div>
              <dt class="inline text-muted">支払済:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.paidThroughAt) }}</dd>
            </div>
            <div>
              <dt class="inline text-muted">猶予末:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.graceUntilAt) }}</dd>
            </div>
          </dl>
        </template>
        <template #reconciliation-cell="{ item }">
          <dl class="min-w-54 text-xs">
            <div>
              <dt class="inline text-muted">同期:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.lastSyncedAt) }}</dd>
            </div>
            <div>
              <dt class="inline text-muted">最終照合:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.lastReconciledAt) }}</dd>
            </div>
            <div>
              <dt class="inline text-muted">次回:</dt>
              <dd class="inline">{{ formatBillingDateTime(item.nextReconcileAt) }}</dd>
            </div>
            <div>
              <dt class="inline text-muted">結果:</dt>
              <dd class="inline" :class="item.lastReconcileErrorCode ? 'text-error' : ''">
                {{
                  item.reconciliationInProgress
                    ? "処理中"
                    : getReconciliationErrorLabel(item.lastReconcileErrorCode)
                }}
              </dd>
            </div>
          </dl>
        </template>
        <template #actions-cell="{ item }">
          <UButton
            icon="i-mdi-sync"
            size="xs"
            variant="outline"
            :aria-label="`${item.displayName}の課金状態をStripeと再照合`"
            :disabled="!canReconcileAccount(item)"
            :loading="reconcilingAccountId === item.accountId"
            @click="reconcileAccount(item)"
          >
            再照合
          </UButton>
        </template>
      </AppDataTable>

      <div v-if="totalPages > 1" class="mt-4 flex justify-center">
        <UPagination
          :page="page"
          :total="totalElements"
          :items-per-page="pageSize"
          :disabled="isLoading || reconcilingAccountId !== null"
          @update:page="changePage"
        />
      </div>
    </UCard>
  </div>
</template>
