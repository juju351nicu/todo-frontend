<script setup lang="ts">
import { toRef } from "vue";

import AccountUpsertConfirm from "@/features/account/components/AccountUpsertConfirm.vue";
import { useAccountDetailPage } from "@/features/account/composables/useAccountDetailPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = defineProps<{
  id?: number;
}>();

const {
  accountForm,
  clearForm,
  closeConfirm,
  confirmSubmit,
  isLoading,
  isShowConfirm,
  loadError,
  openConfirm,
  roleLabel,
  submitError,
} = useAccountDetailPage(toRef(props, "id"));
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <AccountUpsertConfirm
    v-if="isShowConfirm"
    :account-form="accountForm"
    @close-modal="closeConfirm"
    @confirm-submit="confirmSubmit"
  />
  <div class="page-container">
    <StatusAlert v-if="loadError" type="error" class="mb-4">
      {{ loadError }}
    </StatusAlert>
    <StatusAlert v-if="submitError" type="error" class="mb-4">
      {{ submitError }}
    </StatusAlert>
    <!-- 幅の狭い画面（390px）でも右が切れないよう、固定幅にせず画面幅に収める（Task一覧の詳細画面と同じ作り）。 -->
    <UCard class="w-full max-w-200">
      <template #header>
        <span>{{ accountForm.accountId > 0 ? accountForm.accountId : " (新規)" }}</span>
      </template>
      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 sm:w-1/2">
          <UFormField label="姓">
            <UInput
              v-model="accountForm.lastName"
              name="lastName"
              placeholder="苗字を入力してください。"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/2">
          <UFormField label="名">
            <UInput
              v-model="accountForm.firstName"
              name="firstName"
              placeholder="名前を入力してください。"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="ログインID">
            <UInput
              v-model="accountForm.loginId"
              name="loginId"
              placeholder="ログインIDを入力してください。"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="パスワード">
            <UInput
              v-model="accountForm.password"
              type="password"
              name="password"
              :placeholder="
                accountForm.accountId > 0
                  ? '変更する場合だけ入力してください。'
                  : 'パスワードを入力してください。'
              "
              :required="accountForm.accountId === 0"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3">
          <UFormField label="Email アドレス">
            <UInput
              v-model="accountForm.email"
              type="email"
              name="email"
              placeholder="emailを入力してください。"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 text-sm">
          <span class="font-medium">権限:</span> {{ roleLabel }}
          <span class="block text-muted">
            権限はこの画面では変えられません。変更は管理者が「アカウント・ロール管理」で行います。新規登録はユーザとして登録します。
          </span>
        </div>
      </div>
      <div>
        <UButton class="me-4" color="success" type="button" @click="openConfirm">
          {{ accountForm.accountId > 0 ? "更新する" : " 登録する" }}
        </UButton>
        <UButton @click="clearForm">クリア</UButton>
      </div>
    </UCard>
  </div>
</template>
