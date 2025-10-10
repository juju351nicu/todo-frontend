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
<script setup lang="js">
import { ref, onMounted } from 'vue';

/** サイドメニューフラグ */
const drawer = ref(false);
/** サイドメニュー */
const links = ref([
  { icon: "mdi-home", text: "Home", url: "" },
  {
    icon: "mdi-account",
    text: "アカウント",
    url: "/member/upsert?memberId=" + 1,
  },
  { icon: "mdi-format-list-bulleted", text: "お知らせ一覧", url: "../news/list" },
  { icon: "mdi-view-dashboard", text: "ダッシュボード画面", url: "/todo/Top" },
  { icon: "mdi-account-cancel", text: "退会", url: "/member/cancel" + 1 },
  { icon: "mdi-export", text: "ログアウト", url: "/logout" },
]);
const role = ref(0);

onMounted(() => {
  if (role.value == 0) {
    links.value.push(
      {
        icon: "mdi-account-plus",
        text: "会員新規登録",
        url: "../member/upsert?memberId=0",
      },
      {
        icon: "mdi-bell-plus",
        text: "お知らせ新規登録",
        url: "../news/upsert?newsId=0",
      }
    );
  };
  if (role.value == 0 || role.value == 1) {
    links.value.push({
      icon: "mdi-account-multiple",
      text: "会員一覧",
      url: "../member/list",
    });
  }
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
