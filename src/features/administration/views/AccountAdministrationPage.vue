<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useAccountAdministrationPage } from "@/features/administration/composables/useAccountAdministrationPage";
import {
  getAccountStatusColor,
  getAccountStatusLabel,
} from "@/shared/utils/accountStatus";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import SearchField from "@/shared/components/SearchField.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canEditRoles,
  canSaveRoles,
  closeRoleEditor,
  errorMessages,
  filteredAccounts,
  getRoleName,
  headers,
  initialize,
  isEditorOpen,
  isEditingCurrentAccount,
  isLoading,
  isSaving,
  itemsPerPage,
  itemsPerPageOptions,
  openRoleEditor,
  roles,
  saveRoles,
  searchText,
  selectedAccount,
  selectedRoleCodes,
  successMessage,
} = useAccountAdministrationPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="p-6">
    <UCard class="mx-auto max-w-300">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-account-key" class="size-6" />
          アカウント・ロール管理
          <SearchField v-model="searchText" label="アカウント検索" placeholder="表示名・メール・ロール" class="ms-auto w-90" />
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">
        {{ successMessage }}
      </StatusAlert>
      <StatusAlert v-if="!canEditRoles" type="info" class="mb-4">
        現在のロールを参照できます。変更にはACCOUNT_ROLE_UPDATE permissionが必要です。
      </StatusAlert>

      <AppDataTable
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="filteredAccounts"
        :items-per-page-options="itemsPerPageOptions"
        :loading="isLoading"
        item-value="accountId"
        no-data-text="検索条件に一致するアカウントはありません。"
      >
        <template #email-cell="{ value }">
          {{ value || "未登録" }}
        </template>
        <template #status-cell="{ item }">
          <UBadge :color="getAccountStatusColor(item.status)" size="sm">
            {{ getAccountStatusLabel(item.status) }}
          </UBadge>
        </template>
        <template #roleCodes-cell="{ item }">
          <div class="flex flex-wrap gap-1 py-1">
            <UBadge v-for="roleCode in item.roleCodes" :key="roleCode" size="sm">
              {{ getRoleName(roleCode) }}
            </UBadge>
          </div>
        </template>
        <template #actions-cell="{ item }">
          <UButton
            v-if="canEditRoles"
            icon="i-mdi-account-edit"
            size="xs"
            square
            class="size-8"
            aria-label="ロールを編集"
            @click="openRoleEditor(item)"
          />
          <span v-else class="text-muted">参照のみ</span>
        </template>
      </AppDataTable>
    </UCard>
  </div>

  <UModal
    v-model:open="isEditorOpen"
    :dismissible="!isSaving"
    title="ロール編集"
    :description="selectedAccount ? `${selectedAccount.displayName}（ID: ${selectedAccount.accountId}）` : undefined"
    :ui="{ content: 'max-w-140' }"
  >
    <template v-if="selectedAccount" #body>
      <StatusAlert v-if="isEditingCurrentAccount" type="warning" class="mb-4">
        自分のロールを変更すると、保存後に再ログインが必要です。
      </StatusAlert>
      <p class="mb-2">ロールを1件以上選択してください。</p>
      <UCheckboxGroup
        v-model="selectedRoleCodes"
        :items="roles.map((role) => ({ label: `${role.roleName}（${role.roleCode}）`, value: role.roleCode }))"
        :disabled="isSaving"
      />
    </template>
    <template v-if="selectedAccount" #footer>
      <UButton variant="ghost" :disabled="isSaving" @click="closeRoleEditor">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :disabled="!canSaveRoles" :loading="isSaving" @click="saveRoles">
        保存
      </UButton>
    </template>
  </UModal>
</template>
