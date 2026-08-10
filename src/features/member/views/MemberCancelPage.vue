<script setup lang="ts">
import TheHeader from "@/components/TheHeader.vue";
import Loading from "@/components/Loading.vue";
import { computed } from "vue";

import { useMemberCancelPage } from "@/features/member/composables/useMemberCancelPage";

const props = defineProps<{
    id: number;
}>();
const memberId = computed<number>(() => {
    return props.id;
});

const {
    clearPassword,
    confirmCancellation,
    isLoading,
    message,
    password,
} = useMemberCancelPage(memberId);

</script>
<template>
    <TheHeader />
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
        <v-btn class="mr-4" color="success" @click="confirmCancellation">
            上記に同意してアカウントを削除する
        </v-btn>
        <v-btn @click="clearPassword">
            クリア
        </v-btn>
        <p style="color: red">{{ message }}</p>
    </v-container>
</template>
