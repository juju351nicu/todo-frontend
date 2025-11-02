<template>
    <div id="modal">
        <div class="modal">
            <h4> {{ messages }}</h4>
            <button class="modal__btn" @click="handleCloseModal($event)">戻る</button>
        </div>
        <div class="modal-overlay"></div>
    </div>
</template>
<script setup lang="js">
import { computed } from 'vue';
const props = defineProps({
    messages: Array,
});

const emit = defineEmits(["close-modal"]);

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