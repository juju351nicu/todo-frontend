<script setup lang="ts">
import AppSideMenu from "@/app/layouts/AppSideMenu.vue";
import { ref } from "vue";

/** サイドメニューフラグ */
const drawer = ref<boolean>(false);

</script>
<template>
  <nav>
    <v-app-bar color="deep-purple" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>メニュー</v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>
    <AppSideMenu v-model:drawer="drawer" />
  </nav>
</template>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
