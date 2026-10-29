<script setup lang="ts">
import { onScopeDispose, watch } from "vue";

import type { StatusAlertType } from "@/shared/types/color";

/**
 * 画面下部中央に一時表示し、時間がたつと自動で消える通知。
 *
 * 表示状態は親が`open`で所有し、`timeout`経過または閉じる操作で`update:open`へfalseを通知する。
 * 本文はdefault slotへ渡す。
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    color: StatusAlertType;
    /** 自動で閉じるまでのミリ秒。0以下の場合は自動で閉じない。 */
    timeout?: number;
  }>(),
  { timeout: 5000 }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const BACKGROUND_CLASSES: Record<StatusAlertType, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
};

let closeTimer: ReturnType<typeof setTimeout> | null = null;

const clearCloseTimer = (): void => {
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
};

// 表示のたびにtimerを張り直し、連続した通知でも最後の表示から`timeout`だけ残す。
watch(
  () => props.open,
  (open) => {
    clearCloseTimer();
    if (open && props.timeout > 0) {
      closeTimer = setTimeout(() => emit("update:open", false), props.timeout);
    }
  },
  { immediate: true }
);

onScopeDispose(clearCloseTimer);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="scale-80 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        role="status"
        class="fixed bottom-2 left-1/2 z-2000 flex min-h-12 w-[calc(100vw-16px)] max-w-168 min-w-86 -translate-x-1/2 items-center gap-2 rounded-sm py-1.5 ps-4 pe-2 text-sm text-white shadow-elevation-8 sm:w-auto"
        :class="BACKGROUND_CLASSES[color]"
      >
        <div class="flex-1 py-1.5">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
