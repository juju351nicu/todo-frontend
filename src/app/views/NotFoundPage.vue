<script setup lang="ts">
import { useRouter } from "vue-router";

import { resolveAuthenticatedHomeRouteName } from "@/app/router/authorization";
import { useUserStore } from "@/features/auth/stores/user";

const router = useRouter();
const userStore = useUserStore();
/**
 * 現在のpermissionで参照できる既定画面へ戻る。
 */
const goHome = (): void => {
    const routeName = userStore.isAuthenticated
        ? resolveAuthenticatedHomeRouteName(userStore.permissionCodes)
        : "Login";
    void router.push({ name: routeName });
};
</script>
<template>
    <h1>404: Not Found</h1>
    <p>ページが見つかりません。</p>
    <v-btn class="mt-2" color="success" @click="goHome" size="large" width="150px">
        &laquo; トップページに戻る
    </v-btn>
</template>
