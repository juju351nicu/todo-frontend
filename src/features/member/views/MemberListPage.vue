<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { onBeforeMount } from "vue";

import { useMemberListPage } from "@/features/member/composables/useMemberListPage";

const {
    deleteSelectedMembers,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    memberList,
    pages,
    selectedIds,
    showMemberDetail,
} = useMemberListPage();

onBeforeMount(initialize);

</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <h2>会員一覧</h2>
    <v-data-table density="compact" show-select v-model="selectedIds" v-model:items-per-page="itemsPerPage"
        item-value="memberId" :headers="headers" :items="memberList" :items-per-page-options="pages"
        items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.actions="{ item }">
            <v-icon size="small" class="me-2" @click="showMemberDetail(item)"> mdi-pencil </v-icon>
        </template>
    </v-data-table>
    <v-btn prepend-icon="mdi-delete" class="mr-4" color="success" @click="deleteSelectedMembers"> 削除確認する </v-btn>
</template>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
