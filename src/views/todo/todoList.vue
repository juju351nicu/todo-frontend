<template>
    <SideMenu />
    <Loading v-if="isLoading" />
    <v-data-table density="compact" v-model:items-per-page="itemsPerPage"
        item-value="memberId" :headers="headers" :items="todoList" :items-per-page-options="pages"
        items-per-page-text="表示行数" class="elevation-1">
    </v-data-table>
</template>
<script setup lang="js">
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
import { onBeforeMount, computed } from "vue";
import { useTodoStore } from "@/stores/todo";

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
const itemsPerPage = 5;
const pages = [
    { value: 5, title: "5" },
    { value: 10, title: "10" },
    { value: 20, title: "20" },
    { value: -1, title: "$vuetify.dataFooter.itemsPerPageAll" },
];
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
    console.log(value);
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