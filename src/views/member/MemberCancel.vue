<template>
    <SideMenu />
    <Loading v-if="isLoading" />
    <v-container>
        <p>アカウントを削除して退会されたい場合は、以下の注意事項をご確認の上、お手続きいただきますようお願いいたします。</p>
        <ul>
            <li>アカウントを削除されますと、関連するすべてのデータが削除されます。また、操作の取り消しはできません。</li>
            <li>アカウントを削除した後、同じユーザー名で再登録はできません。<span class="fwn">同じユーザー名で再登録されたい場合は、ユーザー名を変更してからアカウントを削除してください。</span>
            </li>
        </ul>
        <p>ご了承いただけましたらパスワードを入力して「上記に同意してアカウントを削除する」をクリックしてください。</p>

        <v-card-title class="text-center pa-8">
            <h4 class="fill-width">会員情報入力</h4>
        </v-card-title>
        <v-divider></v-divider>
        <v-text-field v-model="password" type="password" name="password" label="パスワード"></v-text-field>
        <v-btn class="mr-4" color="success" @click="confirmSubmit($event)">
            上記に同意してアカウントを削除する
        </v-btn>
        <v-btn>
            クリア
        </v-btn>
        <p style="color: red">{{ message }}</p>
    </v-container>
</template>
<script setup lang="js">
import SideMenu from "@/components/SideMenu.vue";
import Loading from "@/components/Loading.vue";
import { computed, ref } from 'vue';
import { useMemberStore } from "@/stores/member";
const props = defineProps({
    id: Number,
});
/** 会員ストア情報 */
const memberStore = useMemberStore();

/** ローディングフラグ */
const isLoading = computed(() => {
    return memberStore.isLoading;
});

/** 会員詳細情報 */
const memberId = computed(() => {
    return props.id;
});

/** メッセージ */
const message = ref("");

/** パスワード */
const password = ref("");

/**
 * 会員情報を新規登録・更新する。
 */
const confirmSubmit = ((event) => {
    // submitイベントの本来の動作を止める
    event.preventDefault();
    const payload = {
        "memberId": memberId.value,
        "password": password.value,
    };
    memberStore.cancelMemberInfo(payload);
});

</script>