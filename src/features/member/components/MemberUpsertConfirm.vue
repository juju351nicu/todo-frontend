<script setup lang="ts">
import type { MemberDetailForm } from "@/features/member/utils/memberForm";

defineProps<{
    memberForm: MemberDetailForm;
}>();

const emit = defineEmits<{
    "close-modal": [];
    "confirm-submit": [];
}>();

/**
 * モーダル画面を閉じる。
 */
const handleCloseModal = (): void => {
    emit("close-modal");
};

/**
 * 確認した会員情報を登録・更新する。
 */
const handleConfirmSubmit = (): void => {
    emit("confirm-submit");
};
</script>
<template>
    <div id="modal">
        <div class="modal">
            <h4> {{ memberForm.memberId > 0 ? '更新' : ' (登録)' }}確認画面</h4>
            <v-container>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ memberForm.lastName }} &nbsp;{{ memberForm.firstName }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ memberForm.loginId }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>パスワード: {{ memberForm.password ? '入力済み' : '変更なし' }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ memberForm.email }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ memberForm.role }}</span>
                    </v-col>
                </v-row>
            </v-container>
            <button type="button" class="modal__btn" @click="handleCloseModal">戻る</button>
            <button type="button" class="modal__btn" @click="handleConfirmSubmit">{{ memberForm.memberId > 0 ? '更新' : '登録'
            }}</button>
        </div>
        <div class="modal-overlay"></div>
    </div>
</template>
<style scoped>
/* ========================================
      Modal css
  ========================================= */

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
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
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
