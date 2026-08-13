<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useAccountAdministrationPage } from "@/features/administration/composables/useAccountAdministrationPage";
import {
  getAccountStatusColor,
  getAccountStatusLabel,
} from "@/features/administration/utils/accountStatus";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

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
  openRoleEditor,
  pages,
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
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="pa-6">
    <v-card class="mx-auto" max-width="1200">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-account-key" />
        アカウント・ロール管理
        <v-spacer />
        <v-text-field
          v-model="searchText"
          label="アカウント検索"
          placeholder="表示名・メール・ロール"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          hide-details
          clearable
          max-width="360"
        />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4">
          {{ successMessage }}
        </v-alert>
        <v-alert v-if="!canEditRoles" type="info" class="mb-4">
          現在のロールを参照できます。変更にはACCOUNT_ROLE_UPDATE permissionが必要です。
        </v-alert>

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="filteredAccounts"
          :items-per-page-options="pages"
          :loading="isLoading"
          item-value="accountId"
          items-per-page-text="表示行数"
          density="compact"
        >
          <template #item.email="{ value }">
            {{ value || "未登録" }}
          </template>
          <template #item.status="{ value }">
            <v-chip :color="getAccountStatusColor(value)" size="small">
              {{ getAccountStatusLabel(value) }}
            </v-chip>
          </template>
          <template #item.roleCodes="{ value }">
            <div class="d-flex flex-wrap ga-1 py-1">
              <v-chip v-for="roleCode in value" :key="roleCode" size="small">
                {{ getRoleName(roleCode) }}
              </v-chip>
            </div>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              v-if="canEditRoles"
              icon="mdi-account-edit"
              size="x-small"
              aria-label="ロールを編集"
              @click="openRoleEditor(item)"
            />
            <span v-else class="text-medium-emphasis">参照のみ</span>
          </template>
          <template #no-data>
            検索条件に一致するアカウントはありません。
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>

  <v-dialog
    v-model="isEditorOpen"
    :persistent="isSaving"
    max-width="560"
  >
    <v-card v-if="selectedAccount">
      <v-card-title>ロール編集</v-card-title>
      <v-card-subtitle>
        {{ selectedAccount.displayName }}（ID: {{ selectedAccount.accountId }}）
      </v-card-subtitle>
      <v-card-text>
        <v-alert v-if="isEditingCurrentAccount" type="warning" class="mb-4">
          自分のロールを変更すると、保存後に再ログインが必要です。
        </v-alert>
        <p class="mb-2">ロールを1件以上選択してください。</p>
        <v-checkbox
          v-for="role in roles"
          :key="role.roleCode"
          v-model="selectedRoleCodes"
          :label="`${role.roleName}（${role.roleCode}）`"
          :value="role.roleCode"
          :disabled="isSaving"
          hide-details
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="closeRoleEditor">キャンセル</v-btn>
        <v-btn
          color="primary"
          :disabled="!canSaveRoles"
          :loading="isSaving"
          @click="saveRoles"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
