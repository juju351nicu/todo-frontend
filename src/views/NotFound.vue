<template>
    <h1>404: Not Found</h1>
    <p>ページが見つかりません。</p>
    <v-btn class="mt-2" color="success" @click="goHome" size="large" width="150px">
        &laquo; トップページに戻る
    </v-btn>
</template>

<script setup>
import { useRouter } from "vue-router";
const router = useRouter();
/**
 * トップページに戻る
 */
const goHome = () => {
    router.push({ name: "DashBoard" });
};
</script>