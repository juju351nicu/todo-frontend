<template>
    <SideMenu />
    <Loading v-if="isLoading" />
    <v-data-table density="compact" v-model:items-per-page="itemsPerPage" :headers="headers" :items="todoList"
        :items-per-page-options="pages" items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.priority="{ value }">
            <v-chip :color="getColor(value)">
                {{ setPriority(value) }}
            </v-chip>
        </template>
        <template v-slot:item.remainingDays="{ value }">
            {{ setRemainingDays(value) }}
        </template>
        <template v-slot:item.detail="{ value }">
            <span> {{ setDetail(value) }}</span>
        </template>
        <template v-slot:item.doneFlag="{ value }">
            {{ value ? '完了' : '未完了' }}
        </template>
        <template v-slot:item.actions="{ item }">
            <v-row>
                <v-btn icon="mdi-pencil" size="x-small" class="col ma-1" @click="showUpsert(item)"></v-btn>
                <v-btn icon="mdi-delete" size="x-small" class="col ma-1" @click="doDoneFlag(item)"></v-btn>
            </v-row>
        </template>
    </v-data-table>
</template>
<script setup lang="js">
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
import { onBeforeMount, computed } from "vue";
import { useTodoStore } from "@/stores/todo";
import Const from "@/constants/const.js";
/** Todoストア情報 */
const todoStore = useTodoStore();
/** ローディングフラグ */
const isLoading = computed(() => {
    return todoStore.isLoading;
});
/** Todo情報一覧 */
const todoList = computed(() => {
    return todoStore.todoListInfo;
});
/** data-tableの1ページあたりの表示件数（デフォルト）*/
const itemsPerPage = Const.NUMBER_OF_ITEMS;
/** data-tableの表示件数の選択リスト */
const pages = Const.DATA_TABLE_PAGES;

const headers = [
    { title: '重要度', align: 'start', key: 'priority' },
    { title: '着手日', align: 'start', key: 'dateFrom' },
    { title: '期限日', align: 'start', key: 'dateTo' },
    { title: '残り日数', align: 'start', key: 'remainingDays' },
    { title: 'タイトル', align: 'start', key: 'title' },
    { title: '詳細情報', align: 'start', key: 'detail' },
    { title: '完了フラグ', align: 'start', key: 'doneFlag' },
    { title: '編集', align: 'start', key: 'actions' },
];


const getColor = ((priority) => {
    switch (priority) {
        case 1:
            return '#000080'
        case 2:
            return '#ff00ff'
        default:
            return '#ff0000'
    }
});
const setPriority = ((priority) => {
    switch (priority) {
        case 1:
            return '高'
        case 2:
            return '中'
        default:
            return '低'
    }
});
const setRemainingDays = ((value) => {
    return '残り' + value + '日間'
});
const setDetail = ((value) => {
    return value.substring(0, 3)
});
const setDoneFlag = ((doneFlag) => {
    if (doneFlag) return '完了'
    else return '未完了'
});
const showUpsert = ((item) => {
    console.log(item);
    location.href = '/todo/upsert?todoId=' + item.todoId + '&userId=' + item.userId;
});
const doDoneFlag = ((item) => {
    console.log(item);
    location.href = '/todo/doneFlag?todoId=' + item.todoId;
});
onBeforeMount(() => {
    todoStore.findTodoList();
});
</script>