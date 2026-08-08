<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
/**
 * トップページに戻る
 */
const goHome = (): void => {
    void router.push({ name: "TodoCalendar" });
};
</script>
<template>
    <h1>404: Not Found</h1>
    <p>ページが見つかりません。</p>
    <v-btn class="mt-2" color="success" @click="goHome" size="large" width="150px">
        &laquo; トップページに戻る
    </v-btn>
</template>
