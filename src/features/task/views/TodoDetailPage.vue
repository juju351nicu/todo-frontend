<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { computed } from "vue";

import TodoUpsertConfirm from "@/features/task/components/TodoUpsertConfirm.vue";
import { useTodoDetailPage } from "@/features/task/composables/useTodoDetailPage";

const props = defineProps<{
    id?: number;
}>();

const todoId = computed(() => props.id);
const {
    clearForm,
    closeConfirm,
    confirmSubmit,
    doneFlagItems,
    errorMessages,
    fullName,
    fullNameItems,
    isLoading,
    isShowConfirm,
    loadError,
    priorityItems,
    role,
    showConfirm,
    successMessage,
    todoForm,
} = useTodoDetailPage(todoId);
</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <TodoUpsertConfirm v-if="isShowConfirm" :todo-form="todoForm" @close-modal="closeConfirm"
        @confirm-submit="confirmSubmit" />
    <v-container>
        <v-alert v-if="loadError" type="error" class="mb-4">
            {{ loadError }}
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4">
            {{ successMessage }}
        </v-alert>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
            <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>
        <v-card width="800px">
            <v-card-title>
                <span> {{ todoForm.todoId > 0 ? todoForm.todoId : ' (新規)' }}</span>
            </v-card-title>
            <v-card-text>
                <v-row>
                    <template v-if="todoForm.todoId == 0 && role == 0">
                        <v-col cols="12">
                            <v-select name="userId" v-model="todoForm.userId" :items="fullNameItems"
                                item-title="userObjLabel" item-value="userObjId" label="対象ユーザ"></v-select>
                        </v-col>
                    </template>
                    <template v-if="todoForm.todoId > 0">
                        <v-col cols="12">
                            <v-text-field :model-value="fullName" label="対象ユーザー" readonly></v-text-field>
                        </v-col>
                        <input type="hidden" name="userId" ref="inputUserId">
                    </template>
                    <template v-if="todoForm.todoId == 0">
                        <input type="hidden" name="userId" ref="inputUserId">
                    </template>
                    <v-col cols="12">
                        <v-text-field name="dateFrom" v-model="todoForm.dateFrom" label="着手日" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="dateTo" v-model="todoForm.dateTo" label="期限日" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-select name="priority" v-model="todoForm.priority" :items="priorityItems"
                            item-title="priorityLabel" item-value="priority" label="重要度"></v-select>
                    </v-col>
                    <v-col cols="12">
                        <v-select name="doneFlag" v-model="todoForm.doneFlag" :items="doneFlagItems"
                            item-title="doneFlagLabel" item-value="doneFlag" label="完了フラグ"></v-select>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="title" v-model="todoForm.title" label="タイトル" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-textarea name="detail" v-model="todoForm.detail" label="詳細" required>
                        </v-textarea>
                    </v-col>
                    <v-btn class="mr-4" color="success" type="button" @click="showConfirm">
                        {{ todoForm.todoId > 0 ? '更新する' : '登録する' }}
                    </v-btn>
                    <v-btn type="button" @click="clearForm">
                        クリア
                    </v-btn>
                </v-row>
            </v-card-text>
        </v-card>
    </v-container>
</template>
