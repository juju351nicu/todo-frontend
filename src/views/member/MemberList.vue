<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { computed, onBeforeMount, ref } from "vue";
import { useRouter } from "vue-router";

import Const from "@/constants/const";
import { useMemberStore } from "@/stores/member";
import type { MemberListItem } from "@/types/member";

interface MemberTableHeader {
    title: string;
    align: "start" | "center" | "end";
    sortable?: boolean;
    key: string;
}

/** ルータ情報 */
const router = useRouter();
/** 会員ストア情報 */
const memberStore = useMemberStore();
/** ローディングフラグ */
const isLoading = computed<boolean>(() => {
    return memberStore.isLoading;
});
/** 会員情報一覧 */
const memberList = computed<MemberListItem[]>(() => {
    return memberStore.memberListInfo;
});
/** チェックボックスにて選択したIds */
const selectedIds = ref<number[]>([]);
/** data-tableの1ページあたりの表示件数（デフォルト）*/
const itemsPerPage = ref<number>(Const.NUMBER_OF_ITEMS);
/** data-tableの表示件数の選択リスト */
const pages = Const.DATA_TABLE_PAGES;
/** テーブルの関連するラベル・プロパティ等の情報 */
const headers: MemberTableHeader[] = [
    {
        title: "ID",
        align: "start",
        sortable: false,
        key: "memberId",
    },
    { title: "苗字", align: "start", key: "lastName" },
    { title: "名前", align: "start", key: "firstName" },
    { title: "ログインID", align: "start", key: "loginId" },
    { title: "パスワード", align: "start", key: "password" },
    { title: "登録日", align: "start", key: "registeredDate" },
    { title: "更新日", align: "start", key: "updatedDate" },
    { title: "最終ログインした時刻", align: "start", key: "lastLogin" },
    { title: "編集", align: "start", key: "actions" },
];
/**
 * 削除ボタン押下の際、チェックボックスで選択したidの会員情報を削除する。
 */
const formSubmit = async (): Promise<void> => {
    await memberStore.deleteMemberList(selectedIds.value);
};
/**
 * 更新画面に遷移する
 * @param item 行情報
 */
const showUpsert = (item: MemberListItem): void => {
    void router.push({ name: "MemberDetail", params: { id: item.memberId } });
};
onBeforeMount(() => {
    void memberStore.findMemberList();
});

</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <h2>会員一覧</h2>
    <v-data-table density="compact" show-select v-model="selectedIds" v-model:items-per-page="itemsPerPage"
        item-value="memberId" :headers="headers" :items="memberList" :items-per-page-options="pages"
        items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.actions="{ item }">
            <v-icon size="small" class="me-2" @click="showUpsert(item)"> mdi-pencil </v-icon>
        </template>
    </v-data-table>
    <div>{{ selectedIds }}</div>
    <v-btn prepend-icon="mdi-delete" class="mr-4" color="success" @click="formSubmit"> 削除確認する </v-btn>
</template>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
