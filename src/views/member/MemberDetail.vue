<template>
    <v-container>
        <v-card width="800px">
            <v-card-title>
                <span> {{ myform.memberId > 0 ? myform.memberId : ' (新規)' }}</span>
            </v-card-title>
            <v-card-text>
                <form ref="form" :model="myform">
                    <v-row>
                        <v-col cols="12" sm="6">
                            <v-text-field name="lastName" v-model="myform.lastName" color="purple darken-2" label="姓"
                                placeholder="苗字を入力してください。" required>
                            </v-text-field>
                        </v-col>
                        <v-col cols="12" sm="6">
                            <v-text-field name="firstName" v-model="myform.firstName" color="blue darken-2" label="名"
                                placeholder="名前を入力してください。" required>
                            </v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field name="loginId" v-model="myform.loginId" label="ログインID"
                                placeholder="ログインIDを入力してください。" required>
                            </v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field type="password" name="password" v-model="myform.password" label="パスワード"
                                placeholder="passwordを入力してください。" required>
                            </v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field type="email" name="email" v-model="myform.email" label="Email アドレス"
                                placeholder="emailを入力してください。" required>
                            </v-text-field>
                        </v-col>
                        <!-- <th:block th:if="${session.user.role == 0}">
                            <v-col cols="12">
                                <v-select name="role" v-model="myform.role" :items="roleItems" item-title="roleLabel"
                                    item-value="role" label="管理者権限"></v-select>
                            </v-col>
                        </th:block>
                        <th:block th:unless="${session.user.role == 0}">
                            <input type="hidden" name="role" :value="myform.role">
                        </th:block> -->
                    </v-row>
                    <v-btn class="mr-4" color="success" type="submit" @click="formSubmit">
                        {{ myform.memberId > 0 ? '更新する' : ' 登録する' }}
                    </v-btn>
                    <v-btn>
                        クリア
                    </v-btn>
                </form>
            </v-card-text>
        </v-card>
    </v-container>
</template>
<script setup lang="js">
import { computed, reactive, ref } from 'vue';
import util from "@/utils/util.js";
import { useMemberStore } from "@/stores/member";
const props = defineProps({
    id: Number,
});
/** 会員ストア情報 */
const memberStore = useMemberStore();
/**
 * Noから配列のindexを取得する
 * @param {string} id id
 * @returns index番号
 */
const getFindIndex = ((id) => {
    const index = memberStore.memberListInfo.findIndex(
        (member) => member.memberId === id
    );
    // 下記の部分、見直し
    return util.isEmpty(id) ? 0 : index;;
});
/** 会員詳細情報 */
const numId = computed(() => {
    return util.isEmpty(props.id) ? 0 : props.id;
});
/** 会員詳細情報 */
const memberInfo = computed(() => {
    const index = getFindIndex(numId.value);
    return memberStore.memberListInfo[index];
});

const myform = reactive({
    memberId: memberInfo.value.memberId,
    lastName: memberInfo.value.lastName,
    firstName: memberInfo.value.firstName,
    loginId: memberInfo.value.loginId,
    password: memberInfo.value.password,
    email: memberInfo.value.email,
    role: memberInfo.value.role,
    version: memberInfo.value.version,
});
const roleItems = ref([
    { roleLabel: '管理者', role: 0 },
    { roleLabel: '閲覧管理者', role: 1 },
    { roleLabel: 'ユーザ', role: 2 }]);
/**
 * 新規登録・更新のパラメータを/member/upsertに送る。
 */
const formSubmit = (() => {
    this.$refs.form.value = this.myform.memberId;
    this.$refs.form.value = this.myform.lastName;
    this.$refs.form.value = this.myform.firstName;
    this.$refs.form.value = this.myform.loginId;
    this.$refs.form.value = this.myform.password;
    this.$refs.form.value = this.myform.email;
    this.$refs.form.value = this.myform.role;
    this.$refs.form.value = this.myform.version;
    this.$refs.form.method = 'POST';
    this.$refs.form.action = '/member/upsert';
    this.$refs.form.submit();
});

</script>