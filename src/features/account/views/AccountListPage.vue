<script setup lang="ts">
import { onBeforeMount } from "vue";

import {
  formatAccountDateTime,
  useAccountListPage,
} from "@/features/account/composables/useAccountListPage";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  accounts,
  canDeleteAccounts,
  deleteSelectedAccounts,
  errorMessages,
  headers,
  initialize,
  isLoading,
  itemsPerPage,
  itemsPerPageOptions,
  selectedIds,
  showAccountDetail,
} = useAccountListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <h2 class="text-[1.5em] font-bold">アカウント一覧</h2>
  <StatusAlert v-for="message in errorMessages" :key="message" type="error" class="my-2">
    {{ message }}
  </StatusAlert>
  <AppDataTable
    v-model:selected="selectedIds"
    v-model:items-per-page="itemsPerPage"
    :headers="headers"
    :items="accounts"
    item-value="accountId"
    :items-per-page-options="itemsPerPageOptions"
    :selectable="canDeleteAccounts"
    class="rounded-sm ring ring-default"
  >
    <template #createdAt-cell="{ item }">{{ formatAccountDateTime(item.createdAt) }}</template>
    <template #updatedAt-cell="{ item }">{{ formatAccountDateTime(item.updatedAt) }}</template>
    <template #lastLoginAt-cell="{ item }">{{ formatAccountDateTime(item.lastLoginAt) }}</template>
    <template #actions-cell="{ item }">
      <button
        type="button"
        class="me-2 align-middle"
        aria-label="アカウントを編集"
        @click="showAccountDetail(item)"
      >
        <UIcon name="i-mdi-pencil" class="size-4" />
      </button>
    </template>
  </AppDataTable>
  <UButton
    v-if="canDeleteAccounts"
    icon="i-mdi-delete"
    color="success"
    class="me-4"
    @click="deleteSelectedAccounts"
  >
    削除確認する
  </UButton>
</template>
