<script setup lang="ts">
import { useRouter } from "vue-router";

import { resolveAuthenticatedHomeRouteName } from "@/app/router/authorization";
import { useUserStore } from "@/features/auth/stores/user";

const router = useRouter();
const userStore = useUserStore();

/** 現在のpermissionで参照できる既定画面へ戻る。 */
const goHome = (): void => {
  const routeName = resolveAuthenticatedHomeRouteName(userStore.permissionCodes);
  if (routeName === "AccessDenied") {
    void router.push({ name: "Login" });
    return;
  }
  void router.push({ name: routeName });
};
</script>

<template>
  <v-container class="py-10 text-center">
    <v-icon color="warning" size="64">mdi-shield-lock-outline</v-icon>
    <h1 class="mt-4">403: 権限がありません</h1>
    <p class="mt-2">この画面を表示するpermissionが付与されていません。</p>
    <v-btn class="mt-6" color="primary" @click="goHome">
      利用可能な画面へ戻る
    </v-btn>
  </v-container>
</template>
