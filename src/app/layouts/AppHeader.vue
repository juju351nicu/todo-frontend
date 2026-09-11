<script setup lang="ts">
import AppSideMenu from "@/app/layouts/AppSideMenu.vue";
import NotificationBell from "@/features/notification/components/NotificationBell.vue";
import { ref } from "vue";

const drawer = ref<boolean>(false);
</script>
<template>
  <nav>
    <v-app-bar color="deep-purple" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>メニュー</v-toolbar-title>
      <v-spacer></v-spacer>
      <NotificationBell />
    </v-app-bar>
    <AppSideMenu v-model:drawer="drawer" />
  </nav>
</template>
<style scoped></style>
