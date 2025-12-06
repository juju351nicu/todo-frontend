<script setup lang="js">
import SideMenu from "@/components/SideMenu.vue";
import MessageModal from "@/components/MessageModal.vue";
import UpsertConfirm from "@/components/todo/UpsertConfirm.vue";
import Loading from "@/components/Loading.vue";
import { computed, onMounted, reactive, ref } from 'vue';
import Util from "@/utils/util.js";
import { useTodoStore } from "@/stores/todo";
const props = defineProps({
    id: Number,
});
/** Todoストア情報 */
const todoStore = useTodoStore();

/** ローディングフラグ */
const isLoading = ref(false);
/**
 * Noから配列のindexを取得する
 * @param {string} id id
 * @returns index番号
 */
const getFindIndex = ((id) => {
    const index = todoStore.todoListInfo.findIndex(
        (todo) => todo.todoId === id
    );
    // 下記の部分、見直し
    return Util.isEmpty(id) ? 0 : index;;
});
/**
  * 
  * @returns 
  */
const fullName = computed(() => {
    // return (this.myform.userId in this.myform.idMemberMap) ? this.myform.idMemberMap[this.myform.userId].lastName + this.myform.idMemberMap[this.myform.userId].firstName : '削除されたユーザ';
    return "";
});
/** Todo詳細情報 */
const numId = computed(() => {
    return Util.isEmpty(props.id) ? 0 : props.id;
});
/** Todo詳細情報 */
const todoInfo = computed(() => {
    const index = getFindIndex(numId.value);
    return todoStore.todoListInfo[index];
});
/** Todo詳細情報 */
const myform = reactive({
    todoId: todoInfo.value.todoId,
    dateFrom: todoInfo.value.start,
    dateTo: todoInfo.value.end,
    title: todoInfo.value.title,
    detail: todoInfo.value.detail,
    userId: 1,
    doneFlag: 0,
    priority: 3,
    version: 0,
    idMemberMap: [],
    userList: [],
});

/** モーダルを表示・非表示フラグ */
const isShowModal = ref(false);

const showMessageModal = () => {
    isShowModal.value = true;
};
/**
 * モーダルを非表示にする
 */
const handleCloseModal = (() => {
    isShowModal.value = false;
});

const priorityItems = [
    { priorityLabel: '低', priority: 1 },
    { priorityLabel: '中', priority: 2 },
    { priorityLabel: '高', priority: 3 },];
const doneFlagItems = [
    { doneFlagLabel: '未完了', doneFlag: 0 },
    { doneFlagLabel: '完了', doneFlag: 1 },];
const fullNameItems = [
    { userObjLabel: '全員', userObjId: -1 }
];

/** 初期表示 */
onMounted(() => {
    // console.log('priority' + (this.myform.priority == 0));
    // console.log('doneFlag' + (this.myform.doneFlag == false) + '値' + this.myform.doneFlag);
    // console.log('判定結果:' + (this.myform.userId in this.myform.idMemberMap));
    // if (this.myform.doneFlag == null || this.myform.doneFlag == 'false') {
    //     this.myform.doneFlag = { doneFlagLabel: '未完了', doneFlag: 0 };
    // };
    // if (this.myform.priority == 0) {
    //     this.myform.priority = { priorityLabel: '低', priority: 1 }
    // };
    // if (role == 0 && this.myform.todoId == 0) {
    //     for (let i = 0; i < this.myform.userList.length; i++) {
    //         this.fullNameItems.push({
    //             userObjLabel: this.myform.userList[i].lastName + this.myform.userList[i].firstName,
    //             userObjId: this.myform.userList[i].id
    //         })
    //     }
    // }
});
const errorMessages = ref([]);
/**
 * Todoを新規登録・更新する。
 */
const confirmSubmit = ((event) => {
    // submitイベントの本来の動作を止める
    // event.preventDefault();
    const payload = {
        "todo_id": myform.todoId,
        "date_from": myform.dateFrom,
        "date_to": myform.dateTo,
        "title": myform.title,
        "detail": myform.detail,
        "done_flag": myform.doneFlag,
        "role": myform.role,
        "priority": myform.priority,
        "version": myform.version,
        "user_id": myform.userId
    };
    // if (role == 0) {
    //             if (this.myform.todoId == 0) {
    //                 this.$refs.form.value = this.myform.userId;
    //             } else {
    //                 this.$refs.inputUserId.value = this.myform.userId;
    //             }
    //         } else {
    //             this.$refs.inputUserId.value = this.sessionUserId;
    //         }
    isLoading.value = true;
    try {
        todoStore.upsertTodoInfo(payload).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                console.log(data);
                isLoading.value = false;
            } else {
                const err = await response.json();
                if (!Util.isEmpty(err.fieldErrors)) {
                    showMessageModal();
                    err.fieldErrors.forEach((fieldError) => {
                        errorMessages.value.push(fieldError.message);
                    });
                    isLoading.value = false;
                }
                throw new Error("There's an error upstream and it says");
            }
        })
    } catch (error) {
        console.log(error);
    };
});
</script>
<template>
    <SideMenu />
    <Loading v-if="isLoading" />
    <UpsertConfirm v-if="isShowModal" :myform="myform" @close-modal="handleCloseModal"
        @confirm-submit="confirmSubmit" />
    <v-container>
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
                            <v-text-field>{{ fullName }}
                            </v-text-field>
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
                    <v-btn class="mr-4" color="success" type="submit" @click="showMessageModal($event)">
                        更新する
                    </v-btn>
                    <v-btn>
                        クリア
                    </v-btn>
                </v-row>
            </v-card-text>
        </v-card>
    </v-container>
</template>