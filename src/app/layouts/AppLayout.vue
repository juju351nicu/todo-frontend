<script setup lang="ts">
import { useAppNavigation } from "@/app/composables/useAppNavigation";
import AppHeader from "@/app/layouts/AppHeader.vue";
import AppSideMenu from "@/app/layouts/AppSideMenu.vue";

/**
 * 認証後画面と問い合わせ画面の共通レイアウト。ヘッダー、サイドメニュー、本文領域を配置する。
 * routeの`meta.layout`が`"blank"`の画面では使用しない（`src/App.vue`）。
 */
const { isDrawerOpen, navigationLinks, toggleDrawer, logout } = useAppNavigation();
</script>

<template>
  <div class="relative min-h-screen">
    <AppHeader @toggle-menu="toggleDrawer" />
    <AppSideMenu :is-open="isDrawerOpen" :links="navigationLinks" @logout="logout" />
    <!-- メニューを開くと、本文を重ねずに右へ押し出す（本文の左端がメニューに隠れないようにするため）。 -->
    <main
      class="pt-16 transition-[padding] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="isDrawerOpen ? 'ps-64' : 'ps-0'"
    >
      <slot />
    </main>
  </div>
</template>
