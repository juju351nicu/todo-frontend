<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { onBeforeMount, ref } from "vue";
import { useRouter } from "vue-router";

import Const from "@/constants/const";
import { useTodoStore } from "@/stores/todo";
import type { ErrorResponse } from "@/shared/types/error";
import type { TodoListItem, TodoListRequest, TodoListResponse } from "@/types/todo";
import { getTodoPriorityLabel } from "@/utils/todo";
import Util from "@/utils/util";

interface TodoTableHeader {
    title: string;
    align: "start" | "center" | "end";
    key: string;
}

/** ルータ情報 */
const router = useRouter();
/** Todoストア情報 */
const todoStore = useTodoStore();
/** ローディングフラグ */
const isLoading = ref<boolean>(false);
/** エラーメッセージ */
const errorMessages = ref<string[]>([]);
/** Todo情報一覧 */
const todoList = ref<TodoListItem[]>([]);
/** data-tableの1ページあたりの表示件数（デフォルト）*/
const itemsPerPage = ref<number>(Const.NUMBER_OF_ITEMS);
/** data-tableの表示件数の選択リスト */
const pages = Const.DATA_TABLE_PAGES;

const headers: TodoTableHeader[] = [
    { title: "重要度", align: "start", key: "priority" },
    { title: "着手日", align: "start", key: "start" },
    { title: "期限日", align: "start", key: "end" },
    { title: "残り日数", align: "start", key: "remainingDays" },
    { title: "タイトル", align: "start", key: "title" },
    { title: "詳細情報", align: "start", key: "detail" },
    { title: "完了フラグ", align: "start", key: "doneFlag" },
    { title: "編集", align: "start", key: "actions" },
];

const getColor = (priority: number | string): string => {
    switch (priority) {
        case 1:
        case "1":
            return "#000080";
        case 2:
        case "2":
            return "#ff00ff";
        default:
            return "#ff0000";
    }
};
const setRemainingDays = (value: number): string => `残り${value}日間`;
const setDetail = (value: string): string => value.slice(0, 3);
const showUpsert = (item: TodoListItem): void => {
    void router.push({ name: "TodoDetail", params: { id: item.todoId } });
};
const doDoneFlag = async (item: TodoListItem): Promise<void> => {
    isLoading.value = true;
    try {
        const response = await todoStore.completeTodo(item.todoId);
        if (!response.ok) {
            throw new Error("Todoの完了更新に失敗しました。");
        }
        item.doneFlag = true;
    } catch (error) {
        console.error(error);
    } finally {
        isLoading.value = false;
    }
};
/** 検索用タイトル */
const searchTitle = ref<string>("");
/** 検索用完了・未完了フラグチェックボックス */
const selectedDoneFlag = ref<string[]>(["0", "1"]);

const createSearchRequest = (): TodoListRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: Util.getNumberList(selectedDoneFlag.value),
});

const setResponseErrors = (errorResponse: ErrorResponse): void => {
    errorMessages.value = (errorResponse.fieldErrors ?? []).map(
        (fieldError) => fieldError.message
    );
    if (errorMessages.value.length === 0) {
        errorMessages.value = ["Todo情報を取得できませんでした。"];
    }
};

const loadTodoList = async (payload: TodoListRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
        const response = await todoStore.findTodoList(payload);
        if (!response.ok) {
            setResponseErrors((await response.json()) as ErrorResponse);
            return;
        }
        const data = (await response.json()) as TodoListResponse;
        todoList.value = data.todoList;
        todoStore.setTodoList(data.todoList);
    } catch (error: unknown) {
        console.error(error);
        if (errorMessages.value.length === 0) {
            errorMessages.value = ["Backendへ接続できませんでした。"];
        }
    } finally {
        isLoading.value = false;
    }
};

/**
 * 検索ボタン押下の際、TODO情報を検索する。
 */
const formSubmit = async (): Promise<void> => {
    await loadTodoList(createSearchRequest());
};
/** 初期表示 */
onBeforeMount(() => {
    void loadTodoList(createSearchRequest());
});
</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <v-alert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>
    <v-card class="mx-auto" max-width="1000">
        <v-card-item>
            <v-card-title>
                Todo検索
                <v-row>
                    <v-col>
                        <v-text-field v-model="searchTitle" color="purple darken-2" placeholder="タイトル">
                        </v-text-field>
                    </v-col>
                    <!--  <v-col>
                        <input type="text" name="date_from" placeholder="日付(date_from)" />
                        <input type="text" name="date_to" placeholder="日付(date_to)" />
                    </v-col> -->
                    <v-col>
                        <v-checkbox v-model="selectedDoneFlag" value="0" label="未完了のみ">
                        </v-checkbox>
                    </v-col>
                    <v-col>
                        <v-checkbox v-model="selectedDoneFlag" value="1" label="完了のみ">
                        </v-checkbox>
                    </v-col>
                </v-row>
            </v-card-title>
            <v-card-subtitle style="text-align: right">
                11月8日
            </v-card-subtitle>
        </v-card-item>
        <v-card-text style="text-align: right">
            <v-btn color="success" @click="formSubmit">検索</v-btn>
        </v-card-text>
    </v-card>
    <br />
    <v-data-table density="compact" v-model:items-per-page="itemsPerPage" :headers="headers" :items="todoList"
        :items-per-page-options="pages" items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.priority="{ value }">
            <v-chip :color="getColor(value)">
                {{ getTodoPriorityLabel(value) }}
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
