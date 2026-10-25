<script setup lang="ts">
import type { NavigationLink } from "@/app/composables/useAppNavigation";

/**
 * ヘッダー下に表示するサイドメニュー。表示項目と開閉状態は`useAppNavigation`が算出し、
 * このComponentは表示とログアウト要求の通知だけを担当する。
 */
defineProps<{
  isOpen: boolean;
  links: NavigationLink[];
}>();

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <nav
    class="absolute start-0 top-16 bottom-0 z-1004 w-64 overflow-y-auto border-e border-default bg-default transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
    :class="isOpen ? 'translate-x-0' : '-translate-x-[110%]'"
    :inert="!isOpen"
    aria-label="メインメニュー"
  >
    <ul class="py-2">
      <li v-for="link in links" :key="link.label">
        <RouterLink
          :to="link.to"
          class="flex min-h-12 items-center gap-8 px-4 text-base text-default opacity-62 transition-opacity hover:opacity-100"
          active-class="text-primary! opacity-100"
        >
          <UIcon :name="link.icon" class="size-6 shrink-0" />
          <span class="truncate">{{ link.label }}</span>
        </RouterLink>
      </li>
      <li>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-8 px-4 text-base text-default opacity-62 transition-opacity hover:opacity-100"
          @click="emit('logout')"
        >
          <UIcon name="i-mdi-export" class="size-6 shrink-0" />
          <span>ログアウト</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
