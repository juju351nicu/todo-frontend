<template>
    <h2>Todoリスト</h2>
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
        <template v-slot:item.detail="{ value }" v-if="role == 0">
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
<script>
export default {
    name: "TodoList",
    data() {
        return {
            id: 1,
            todoList: [],
            itemsPerPage: 5,
            pages: [
                { value: 5, title: '5' },
                { value: 10, title: '10' },
                { value: 20, title: '20' },
                { value: -1, title: '$vuetify.dataFooter.itemsPerPageAll' }
            ],
            headers: [
                { title: '重要度', align: 'start', key: 'priority' },
                { title: '着手日', align: 'start', key: 'dateFrom' },
                { title: '期限日', align: 'start', key: 'dateTo' },
                { title: '残り日数', align: 'start', key: 'remainingDays' },
                { title: 'タイトル', align: 'start', key: 'title' },
                { title: '詳細情報', align: 'start', key: 'detail' },
                { title: '完了フラグ', align: 'start', key: 'doneFlag' },
                { title: '編集', align: 'start', key: 'actions' },
            ],
            role: 0,
        }
    },
    methods: {
        getColor(priority) {
            switch (priority) {
                case 1:
                    return '#000080'
                case 2:
                    return '#ff00ff'
                default:
                    return '#ff0000'
            }
        },
        setPriority(priority) {
            switch (priority) {
                case 1:
                    return '高'
                case 2:
                    return '中'
                default:
                    return '低'
            }
        },
        setRemainingDays(value) {
            console.log(value);
            return '残り' + value + '日間'
        },
        setDetail(value) {
            return value.substring(0, 3)
        },
        setDoneFlag(doneFlag) {
            if (doneFlag) return '完了'
            else return '未完了'
        },
        showUpsert(item) {
            console.log(item);
            location.href = '/todo/upsert?todoId=' + item.todoId + '&userId=' + item.userId;
        },
        doDoneFlag(item) {
            console.log(item);
            location.href = '/todo/doneFlag?todoId=' + item.todoId;
        },
    }
};
</script>