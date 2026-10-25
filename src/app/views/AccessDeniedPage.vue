<script setup lang="ts">
import { useHomeNavigation } from "@/app/composables/useHomeNavigation";

const { goHome } = useHomeNavigation();
</script>

<template>
  <div class="page-container py-10 text-center">
    <UIcon name="i-mdi-shield-lock-outline" class="size-16 text-warning" />
    <h1 class="mt-4 text-[2em] font-bold">403: 権限がありません</h1>
    <p class="mt-2">この画面を表示するpermissionが付与されていません。</p>
    <UButton class="mt-6" color="primary" @click="goHome">利用可能な画面へ戻る</UButton>
  </div>
</template>
