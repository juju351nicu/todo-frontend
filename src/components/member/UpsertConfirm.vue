<template>
    <div id="modal">
        <div class="modal">
            <h4> {{ myform.memberId > 0 ? '更新' : ' (登録)' }}確認画面</h4>
            <v-container>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ myform.lastName }} &nbsp;{{ myform.firstName }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ myform.loginId }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ myform.password }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ myform.email }}</span>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="6">
                        <span>{{ myform.role }}</span>
                    </v-col>
                </v-row>
            </v-container>
            <button class="modal__btn" @click="handleCloseModal($event)">戻る</button>
            <button class="modal__btn" @click="handkeConfirmSubmit($event)">{{ myform.memberId > 0 ? '更新' : '登録'
                }}</button>
        </div>
        <div class="modal-overlay"></div>
    </div>
</template>
<script setup lang="js">
import { computed } from 'vue';
const props = defineProps({
    myform: Object,
});

const emit = defineEmits(["close-modal", "confirm-submit"]);

/** 会員情報 */
const myform = computed(() => {
    return props.myform;
});
/**
 * モーダル画面を閉じる。
 */
const handleCloseModal = ((event) => {
    // submitイベントの本来の動作を止める
    event.preventDefault();
    emit("close-modal");
});
/**
 * 確認した会員情報を登録・更新する。
 */
const handkeConfirmSubmit = ((event) => {
    // submitイベントの本来の動作を止める
    event.preventDefault();
    emit("confirm-submit");
});
</script>
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