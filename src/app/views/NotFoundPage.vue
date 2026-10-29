<script setup lang="ts">
import { useHomeNavigation } from "@/app/composables/useHomeNavigation";

const { goHome } = useHomeNavigation();
</script>

<template>
  <h1 class="my-[0.67em] text-[2em] font-bold">404: Not Found</h1>
  <p>ページが見つかりません。</p>
  <UButton class="mt-2 w-37.5" color="success" size="lg" @click="goHome"
    >&laquo; トップページに戻る</UButton
  >
</template>
