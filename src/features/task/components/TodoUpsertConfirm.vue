<script setup lang="ts">
import type { TodoDetailForm } from "@/features/task/utils/taskForm";

defineProps<{
    todoForm: TodoDetailForm;
}>();

const emit = defineEmits<{
    "close-modal": [];
    "confirm-submit": [];
}>();

/** 確認内容を保存せずモーダル画面を閉じる。 */
const handleCloseModal = (): void => {
    emit("close-modal");
};

/** 確認したTodo情報の登録・更新を親画面へ依頼する。 */
const handleConfirmSubmit = (): void => {
    emit("confirm-submit");
};
</script>
<template>
    <div id="modal">
        <div class="modal">
            <h4> {{ todoForm.todoId > 0 ? '更新' : ' (登録)' }}確認画面</h4>
            <v-container>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ todoForm.title }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ todoForm.dateFrom }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ todoForm.dateTo }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ todoForm.detail }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ todoForm.doneFlag }}</span>
                    </v-col>
                </v-row>
            </v-container>
            <button type="button" class="modal__btn" @click="handleCloseModal">戻る</button>
            <button type="button" class="modal__btn" @click="handleConfirmSubmit">{{ todoForm.todoId > 0 ? '更新' : '登録'
            }}</button>
        </div>
        <div class="modal-overlay"></div>
    </div>
</template>
<style scoped>
.modal {
    padding: 10px 20px;
    border: 2px solid #a5272a;
    background: #faebd7;
    z-index: 2;
    display: block;
    text-align: center;
    position: fixed;
    width: 600px;
    height: 600px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 10px;
    user-select: none;
}

.modal__message {
    margin-top: 10px;
}

.modal__cancel {
    margin-right: 30px;
}

.modal__cancel:hover {
    cursor: pointer;
    color: rgb(14, 48, 240);
    font-weight: bold;
}

.modal__btn {
    display: inline-block;
    margin: 30px auto;
    text-decoration: none;
    width: 80px;
    height: 30px;
    text-decoration: none;
    color: #000000;
    border: solid 2px #a5272a;
    border-radius: 3px;
    transition: 0.4s;
    text-align: center;
    vertical-align: middle;
    background-color: #faebd7;
}

.modal__btn:hover {
    background: #a5272a;
    color: white;
    cursor: pointer;
}

.modal-overlay {
    z-index: 1;
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 120%;
    background-color: rgba(0, 0, 0, 0.75);
}
</style>
