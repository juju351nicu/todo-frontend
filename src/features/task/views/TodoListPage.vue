<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { onBeforeMount } from "vue";

import { useTodoListPage } from "@/features/task/composables/useTodoListPage";
import {
    formatRemainingDays,
    getTodoPriorityColor,
    getTodoPriorityLabel,
    truncateTodoDetail,
} from "@/features/task/utils/taskDisplay";

const {
    completeTodo,
    errorMessages,
    headers,
    initialize,
    isLoading,
    itemsPerPage,
    pages,
    search,
    searchTitle,
    selectedDoneFlag,
    showTodoDetail,
    todoList,
} = useTodoListPage();

onBeforeMount(initialize);
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
            <v-btn color="success" @click="search">検索</v-btn>
        </v-card-text>
    </v-card>
    <br />
    <v-data-table density="compact" v-model:items-per-page="itemsPerPage" :headers="headers" :items="todoList"
        :items-per-page-options="pages" items-per-page-text="表示行数" class="elevation-1">
        <template v-slot:item.priority="{ value }">
            <v-chip :color="getTodoPriorityColor(value)">
                {{ getTodoPriorityLabel(value) }}
            </v-chip>
        </template>
        <template v-slot:item.remainingDays="{ value }">
            {{ formatRemainingDays(value) }}
        </template>
        <template v-slot:item.detail="{ value }">
            <span> {{ truncateTodoDetail(value) }}</span>
        </template>
        <template v-slot:item.doneFlag="{ value }">
            {{ value ? '完了' : '未完了' }}
        </template>
        <template v-slot:item.actions="{ item }">
            <v-row>
                <v-btn icon="mdi-pencil" size="x-small" class="col ma-1" @click="showTodoDetail(item)"></v-btn>
                <v-btn icon="mdi-delete" size="x-small" class="col ma-1" @click="completeTodo(item)"></v-btn>
            </v-row>
        </template>
    </v-data-table>
</template>
