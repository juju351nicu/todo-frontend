<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useMemberListPage } from "@/features/member/composables/useMemberListPage";
import AppDataTable from "@/shared/components/AppDataTable.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  deleteSelectedMembers,
  headers,
  initialize,
  isLoading,
  itemsPerPage,
  itemsPerPageOptions,
  memberList,
  selectedIds,
  showMemberDetail,
} = useMemberListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <h2 class="text-[1.5em] font-bold">会員一覧</h2>
  <AppDataTable
    v-model:selected="selectedIds"
    v-model:items-per-page="itemsPerPage"
    :headers="headers"
    :items="memberList"
    item-value="memberId"
    :items-per-page-options="itemsPerPageOptions"
    selectable
    class="shadow-elevation-1"
  >
    <template #actions-cell="{ item }">
      <button type="button" class="me-2 align-middle" aria-label="会員を編集" @click="showMemberDetail(item)">
        <UIcon name="i-mdi-pencil" class="size-4" />
      </button>
    </template>
  </AppDataTable>
  <UButton icon="i-mdi-delete" color="success" class="me-4" @click="deleteSelectedMembers">削除確認する</UButton>
</template>
