<script setup lang="ts">
import NotificationBell from "@/features/notification/components/NotificationBell.vue";
import CurrentTaskTimer from "@/features/time-tracking/components/CurrentTaskTimer.vue";

/** アプリ上部の固定ヘッダー。開閉状態は親の`AppLayout`が保持し、ここではメニュー開閉の要求だけを通知する。 */
const emit = defineEmits<{
  "toggle-menu": [];
}>();
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-1006 flex h-16 items-center bg-material-deep-purple-500 px-2.5 text-white shadow-elevation-4">
    <UButton
      icon="i-mdi-menu"
      variant="ghost"
      size="lg"
      square
      class="size-12 text-white hover:bg-white/4"
      :ui="{ leadingIcon: 'size-6' }"
      aria-label="メニューを開く"
      @click="emit('toggle-menu')"
    />
    <span class="ms-5 text-xl">メニュー</span>
    <div class="ms-auto flex items-center">
      <CurrentTaskTimer />
      <NotificationBell />
    </div>
  </header>
</template>
