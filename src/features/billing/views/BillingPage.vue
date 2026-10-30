<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useBillingPage } from "@/features/billing/composables/useBillingPage";
import {
  formatBillingDateTime,
  getBillableFeatureLabel,
  getBillingPlanLabel,
  getBillingSubscriptionStatusColor,
  getBillingSubscriptionStatusLabel,
} from "@/features/billing/utils/billingDisplay";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  billing,
  canOpenPortal,
  canStartCheckout,
  errorMessages,
  informationMessage,
  initialize,
  isLoading,
  isOpeningPortal,
  isPro,
  isStartingCheckout,
  loadBilling,
  openCustomerPortal,
  startCheckout,
} = useBillingPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading && billing === null" />
  <div class="page-surface min-h-full p-6">
    <div class="page-container flex flex-col gap-6">
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <UIcon name="i-mdi-credit-card-outline" class="size-6" />
            <span>料金・契約</span>
            <UButton
              class="ms-auto"
              icon="i-mdi-refresh"
              variant="outline"
              :disabled="isStartingCheckout || isOpeningPortal"
              :loading="isLoading"
              @click="loadBilling"
            >
              契約状態を再読み込み
            </UButton>
          </div>
        </template>

        <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </StatusAlert>
        <StatusAlert v-if="informationMessage" type="info" class="mb-4">
          {{ informationMessage }}
        </StatusAlert>
        <StatusAlert v-if="billing?.cancelAtPeriodEnd" type="warning" class="mb-4">
          現在の契約は期間末で終了する予定です。有料機能は契約期間末まで利用できます。
        </StatusAlert>

        <div class="grid gap-4 md:grid-cols-2">
          <UCard variant="soft">
            <template #header>
              <div class="flex items-center gap-2">
                <span class="text-xl font-bold">Free</span>
                <UBadge v-if="billing?.planCode === 'FREE'" color="info">現在のプラン</UBadge>
              </div>
            </template>
            <p class="mb-4 text-sm text-muted">Project・Task・WBS等の基本機能を利用できます。</p>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <UIcon name="i-mdi-check" class="text-success" />Project・Board・Task
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-mdi-check" class="text-success" />WBS・勤怠・通知・検索
              </li>
            </ul>
          </UCard>

          <UCard variant="soft">
            <template #header>
              <div class="flex items-center gap-2">
                <span class="text-xl font-bold">Pro</span>
                <UBadge v-if="isPro" color="success">現在のプラン</UBadge>
              </div>
            </template>
            <p class="mb-4 text-sm text-muted">
              月額料金はStripe Checkoutで確認できます。カード情報はWork Managementへ保存されません。
            </p>
            <ul class="mb-5 space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <UIcon name="i-mdi-check" class="text-success" />繰り返しTask
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-mdi-check" class="text-success" />Task・Project Template管理
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-mdi-check" class="text-success" />高度Dashboard
              </li>
            </ul>
            <UButton
              v-if="!isPro"
              color="primary"
              icon="i-mdi-open-in-new"
              :disabled="!canStartCheckout"
              :loading="isStartingCheckout"
              @click="startCheckout"
            >
              ProのCheckoutへ進む
            </UButton>
          </UCard>
        </div>
      </UCard>

      <UCard v-if="billing">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <UIcon name="i-mdi-file-document-outline" class="size-6" />
            <span>現在の契約状態</span>
            <UBadge class="ms-auto" :color="isPro ? 'success' : 'neutral'">
              {{ getBillingPlanLabel(billing.planCode) }}
            </UBadge>
          </div>
        </template>

        <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm text-muted">Subscription状態</dt>
            <dd class="mt-1">
              <UBadge :color="getBillingSubscriptionStatusColor(billing.subscriptionStatus)">
                {{ getBillingSubscriptionStatusLabel(billing.subscriptionStatus) }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-sm text-muted">現在契約期間の終了</dt>
            <dd class="mt-1">{{ formatBillingDateTime(billing.currentPeriodEndAt) }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-sm text-muted">利用可能な有料機能</dt>
            <dd v-if="billing.featureCodes.length" class="mt-2 flex flex-wrap gap-2">
              <UBadge v-for="featureCode in billing.featureCodes" :key="featureCode" color="info">
                {{ getBillableFeatureLabel(featureCode) }}
              </UBadge>
            </dd>
            <dd v-else class="mt-1 text-muted">現在利用できる有料機能はありません。</dd>
          </div>
        </dl>

        <template v-if="canOpenPortal" #footer>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="text-sm text-muted">
              支払方法、請求履歴、期間末解約はStripe Customer Portalで管理します。
            </span>
            <UButton
              icon="i-mdi-open-in-new"
              variant="outline"
              :disabled="isStartingCheckout"
              :loading="isOpeningPortal"
              @click="openCustomerPortal"
            >
              請求情報を管理
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
