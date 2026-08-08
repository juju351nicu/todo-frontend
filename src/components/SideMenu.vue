<script setup lang="js">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/stores/user";

const props = defineProps(["drawer"]);
const emit = defineEmits(["update:drawer"]);

const drawer = computed({
    get: () => props.drawer,
    set: (value) => emit("update:drawer", value),
});

const router = useRouter();
const userStore = useUserStore();

const links = computed(() => {
    const values = [
        { icon: "mdi-home", text: "Home", url: "/todo/calendar" },
        { icon: "mdi-account", text: "アカウント", url: "/member/memberList" },
        { icon: "mdi-view-dashboard", text: "ダッシュボード画面", url: "/todo/todoList" },
        { icon: "mdi-account-cancel", text: "退会", url: `/member/cancel/${userStore.memberId}` },
    ];
    if (userStore.hasRole("SYSTEM_ADMIN")) {
        values.push({
            icon: "mdi-account-plus",
            text: "会員新規登録",
            url: "/member/detail",
        });
    }
    if (userStore.hasRole("SYSTEM_ADMIN") || userStore.hasRole("READ_ONLY_ADMIN")) {
        values.push({
            icon: "mdi-account-multiple",
            text: "会員一覧",
            url: "/member/memberList",
        });
    }
    return values;
});

const handleLogout = async () => {
    try {
        await userStore.logout();
    } catch (error) {
        console.error(error);
    } finally {
        drawer.value = false;
        await router.push({ name: "Login" });
    }
};
</script>

<template>
    <v-navigation-drawer v-model="drawer" absolute>
        <v-list color="primary" variant="plain">
            <v-list-item v-for="link in links" :key="link.text" :to="link.url">
                <template #prepend>
                    <v-icon>{{ link.icon }}</v-icon>
                </template>
                <v-list-item-title>{{ link.text }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="handleLogout">
                <template #prepend>
                    <v-icon>mdi-export</v-icon>
                </template>
                <v-list-item-title>ログアウト</v-list-item-title>
            </v-list-item>
        </v-list>
    </v-navigation-drawer>
</template>

<style scoped></style>
