<script setup lang="js">
import { ref, onMounted } from 'vue';
import { useUserStore } from "@/stores/user";
/** サイドメニューフラグ */
const drawer = ref(false);
/** サイドメニュー */
const links = ref([
  { icon: "mdi-home", text: "Home", url: "/todo/calendar" },
  {
    icon: "mdi-account",
    text: "アカウント",
    url: "/member/memberList",
  },
  { icon: "mdi-view-dashboard", text: "ダッシュボード画面", url: "/todo/todoList" },
  { icon: "mdi-account-cancel", text: "退会", url: "/member/cancel" + 1 },
  { icon: "mdi-export", text: "ログアウト", url: "/logout" },
]);
/** Authストア情報 */
const userStore = useUserStore();
const role = userStore.role;

onMounted(() => {
  if (role == 0) {
    links.value.push(
      {
        icon: "mdi-account-plus",
        text: "会員新規登録",
        url: "/member/detail",
      },
    );
  };
  if (role == 0 || role == 1) {
    links.value.push({
      icon: "mdi-account-multiple",
      text: "会員一覧",
      url: "/member/memberList",
    });
  }
});
</script>
<template>
  <nav>
    <v-app-bar color="deep-purple" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>メニュー</v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" absolute>
      <v-list v-for="link in links" :key="link.text" color="primary" variant="plain">
        <v-list-item :href="link.url">
          <template v-slot:prepend>
            <v-icon>{{ link.icon }}</v-icon>
          </template>
          <v-list-item-title>{{ link.text }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
  </nav>
</template>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
