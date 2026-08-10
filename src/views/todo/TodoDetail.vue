<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import UpsertConfirm from "@/components/todo/UpsertConfirm.vue";
import Loading from "@/components/Loading.vue";
import { computed, reactive, ref, watch } from "vue";

import { useTodoStore } from "@/features/task/stores/task";
import { useUserStore } from "@/features/auth/stores/user";
import type { ErrorResponse } from "@/shared/types/error";
import type { AccountRole } from "@/features/member/types/member";
import type { TodoUpsertRequest } from "@/features/task/types/task";
import { createTodoDetailForm, type TodoDetailForm } from "@/utils/detail";

interface PriorityItem {
    priorityLabel: string;
    priority: number;
}

interface DoneFlagItem {
    doneFlagLabel: string;
    doneFlag: 0 | 1;
}

interface UserItem {
    userObjLabel: string;
    userObjId: number;
}

const props = defineProps<{
    id?: number;
}>();

/** Todoストア情報 */
const todoStore = useTodoStore();
const userStore = useUserStore();

/** 送信中フラグ */
const isSubmitting = ref<boolean>(false);

/** ローディングフラグ */
const isLoading = computed<boolean>(() => {
    return todoStore.isLoading || isSubmitting.value;
});

/** ログインユーザーの権限 */
const role = computed<AccountRole>(() => userStore.getRole as AccountRole);

/** Todoの対象ユーザー表示 */
const fullName = computed<string>(() => {
    return myform.userId > 0 ? `ユーザーID: ${myform.userId}` : "対象ユーザーなし";
});

/** URLから受け取ったTodo ID */
const numId = computed<number>(() => {
    const id = props.id ?? 0;
    return Number.isInteger(id) && id > 0 ? id : 0;
});

/** Todo編集フォーム */
const myform = reactive<TodoDetailForm>(createTodoDetailForm());

/** 詳細取得エラー */
const loadError = ref("");

/** 登録・更新完了メッセージ */
const successMessage = ref("");

/**
 * Todo詳細をAPIから取得してフォームを復元する。
 * 新規登録（ID=0）の場合は初期値のまま表示する。
 */
const loadTodoDetail = async (): Promise<void> => {
    Object.assign(myform, createTodoDetailForm());
    loadError.value = "";
    successMessage.value = "";
    if (numId.value === 0) {
        return;
    }

    try {
        const detail = await todoStore.findTodoDetail(numId.value);
        Object.assign(myform, createTodoDetailForm(detail));
    } catch (error) {
        console.error(error);
        loadError.value = "Todo情報を取得できませんでした。Todo一覧から開き直してください。";
    }
};

watch(numId, () => {
    void loadTodoDetail();
}, { immediate: true });

/** モーダルを表示・非表示フラグ */
const isShowModal = ref(false);

const showConfirmModal = (): void => {
    isShowModal.value = true;
};
/**
 * モーダルを非表示にする
 */
const handleCloseModal = (): void => {
    isShowModal.value = false;
};

const priorityItems: PriorityItem[] = [
    { priorityLabel: "低", priority: 1 },
    { priorityLabel: "中", priority: 2 },
    { priorityLabel: "高", priority: 3 },
];
const doneFlagItems: DoneFlagItem[] = [
    { doneFlagLabel: "未完了", doneFlag: 0 },
    { doneFlagLabel: "完了", doneFlag: 1 },
];
const fullNameItems: UserItem[] = [
    { userObjLabel: "全員", userObjId: -1 },
];

const errorMessages = ref<string[]>([]);
/**
 * Todoを新規登録・更新する。
 */
const confirmSubmit = async (): Promise<void> => {
    isShowModal.value = false;
    errorMessages.value = [];
    successMessage.value = "";
    const payload: TodoUpsertRequest = {
        todo_id: myform.todoId,
        date_from: myform.dateFrom,
        date_to: myform.dateTo,
        title: myform.title,
        detail: myform.detail,
        done_flag: myform.doneFlag === 1 ? "1" : "0",
        role: role.value,
        priority: myform.priority,
        version: myform.version,
        user_id: myform.userId,
    };
    isSubmitting.value = true;
    try {
        const response = await todoStore.upsertTodoInfo(payload);
        if (response.ok) {
            const isUpdate = myform.todoId > 0;
            successMessage.value = `Todoを${isUpdate ? '更新' : '登録'}しました。`;
            if (!isUpdate) {
                Object.assign(myform, createTodoDetailForm());
            }
        } else {
            const errorResponse = (await response.json()) as ErrorResponse;
            errorMessages.value = (errorResponse.fieldErrors ?? []).map(
                (fieldError) => fieldError.message
            );
            if (errorMessages.value.length === 0) {
                errorMessages.value = ["Todo情報を保存できませんでした。"];
            }
        }
    } catch (error) {
        console.error(error);
        errorMessages.value = ["Todo情報を保存できませんでした。"];
    } finally {
        isSubmitting.value = false;
    }
};
</script>
<template>
    <TheHeader />
    <Loading v-if="isLoading" />
    <UpsertConfirm v-if="isShowModal" :myform="myform" @close-modal="handleCloseModal"
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
                <span> {{ myform.todoId > 0 ? myform.todoId : ' (新規)' }}</span>
            </v-card-title>
            <v-card-text>
                <v-row>
                    <template v-if="myform.todoId == 0 && role == 0">
                        <v-col cols="12">
                            <v-select name="userId" v-model="myform.userId" :items="fullNameItems"
                                item-title="userObjLabel" item-value="userObjId" label="対象ユーザ"></v-select>
                        </v-col>
                    </template>
                    <!-- <template v-if="myform.id > 0 && role == 0"> 2月3日削除 -->
                    <template v-if="myform.todoId > 0">
                        <v-col cols="12">
                            <v-text-field :model-value="fullName" label="対象ユーザー" readonly></v-text-field>
                        </v-col>
                        <input type="hidden" name="userId" ref="inputUserId">
                    </template>
                    <template v-if="myform.todoId == 0">
                        <input type="hidden" name="userId" ref="inputUserId">
                    </template>
                    <v-col cols="12">
                        <v-text-field name="dateFrom" v-model="myform.dateFrom" label="着手日" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="dateTo" v-model="myform.dateTo" label="期限日" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-select name="priority" v-model="myform.priority" :items="priorityItems"
                            item-title="priorityLabel" item-value="priority" label="重要度"></v-select>
                    </v-col>
                    <v-col cols="12">
                        <v-select name="doneFlag" v-model="myform.doneFlag" :items="doneFlagItems"
                            item-title="doneFlagLabel" item-value="doneFlag" label="完了フラグ"></v-select>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field name="title" v-model="myform.title" label="タイトル" required>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-textarea name="detail" v-model="myform.detail" label="詳細" required>
                        </v-textarea>
                    </v-col>
                    <v-btn class="mr-4" color="success" type="button" @click="showConfirmModal">
                        {{ myform.todoId > 0 ? '更新する' : '登録する' }}
                    </v-btn>
                    <v-btn>
                        クリア
                    </v-btn>
                </v-row>
            </v-card-text>
        </v-card>
    </v-container>
</template>
