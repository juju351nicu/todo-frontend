<script setup lang="ts">
import { computed } from "vue";

import type { StatusAlertType } from "@/shared/types/color";

/**
 * 成功・情報・警告・エラーを表示する共通alert。Nuxt UIの`UAlert`へ、種類に応じた色・MDIアイコン・`role="alert"`を補う。
 *
 * - `variant`: `solid`は塗りつぶし、`soft`は種類の色を薄くした背景にする。
 * - `density`: `compact`は上下の余白を狭める。
 * - 本文はdefault slotへ渡す。`closable`がtrueの場合、閉じる操作で`close`を通知する（非表示化は呼出側が行う）。
 */
const props = withDefaults(
  defineProps<{
    type: StatusAlertType;
    variant?: "solid" | "soft" | "outline";
    density?: "default" | "compact";
    title?: string;
    closable?: boolean;
  }>(),
  {
    variant: "solid",
    density: "default",
    title: undefined,
    closable: false,
  }
);

const emit = defineEmits<{
  close: [];
}>();

const STATUS_ICONS: Record<StatusAlertType, string> = {
  success: "i-mdi-check-circle",
  info: "i-mdi-information",
  warning: "i-mdi-alert-circle",
  error: "i-mdi-close-circle",
};

const icon = computed<string>(() => STATUS_ICONS[props.type]);
const densityClass = computed<string>(() => (props.density === "compact" ? "py-2" : "py-4"));
</script>

<template>
  <UAlert
    role="alert"
    :color="type"
    :variant="variant"
    :icon="icon"
    :title="title"
    :close="closable"
    :class="densityClass"
    :ui="density === 'compact' ? { icon: 'size-6' } : undefined"
    @update:open="emit('close')"
  >
    <template #description>
      <slot />
    </template>
  </UAlert>
</template>
