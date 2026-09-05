<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import {
    ATTENDANCE_READ_PERMISSION_CODES,
    TASK_READ_PERMISSION_CODES,
    TASK_WRITE_PERMISSION_CODES,
} from "@/features/auth/types/auth";

interface NavigationLink {
    icon: string;
    text: string;
    url: string;
}

const props = defineProps<{
    drawer: boolean;
}>();

const emit = defineEmits<{
    "update:drawer": [value: boolean];
}>();

const drawer = computed<boolean>({
    get: () => props.drawer,
    set: (value: boolean) => emit("update:drawer", value),
});

const router = useRouter();
const userStore = useUserStore();

const links = computed<NavigationLink[]>(() => {
    const values: NavigationLink[] = [
        { icon: "mdi-account", text: "アカウント", url: "/member/memberList" },
        { icon: "mdi-account-cancel", text: "退会", url: `/member/cancel/${userStore.memberId}` },
    ];
    if (userStore.hasAnyPermission(ATTENDANCE_READ_PERMISSION_CODES)) {
        values.unshift({
            icon: "mdi-clock-outline",
            text: "勤怠",
            url: "/attendance",
        });
    }
    if (userStore.hasPermission("PROJECT_READ")) {
        values.unshift({
            icon: "mdi-view-dashboard-outline",
            text: "Project Board",
            url: "/projects",
        });
    }
    if (userStore.hasAnyPermission(TASK_READ_PERMISSION_CODES)) {
        values.unshift(
            { icon: "mdi-calendar", text: "Todoカレンダー", url: "/todo/calendar" },
            { icon: "mdi-format-list-checks", text: "Todo一覧", url: "/todo/todoList" },
        );
    }
    if (userStore.hasAnyPermission(TASK_WRITE_PERMISSION_CODES)) {
        values.push({ icon: "mdi-plus-box", text: "Todo新規登録", url: "/todo/register" });
    }
    if (userStore.hasPermission("ACCOUNT_READ")) {
        values.push({
            icon: "mdi-account-key",
            text: "アカウント・ロール管理",
            url: "/administration/accounts",
        });
    }
    if (userStore.hasPermission("AUTHORIZATION_AUDIT_READ")) {
        values.push({
            icon: "mdi-history",
            text: "権限変更監査ログ",
            url: "/administration/authorization-audit-logs",
        });
    }
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

const handleLogout = async (): Promise<void> => {
    try {
        await userStore.logout();
    } catch (_error: unknown) {
        // Logout APIが失敗しても、端末上の認証表示を残さずログイン画面へ戻す。
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
