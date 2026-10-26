<script setup lang="ts">
import { getTodoPriorityColor, getTodoPriorityLabel } from "@/features/task/utils/taskDisplay";

/**
 * Todo・Taskの重要度（1:低、2:中、3以上:高）を色付きbadgeで表示する。
 * 重要度色はsemantic colorではなく固定のhex値（`getTodoPriorityColor`）のため、移行前のVuetify tonal chipと同じく
 * 文字をその色にし、背景を同じ色の12%で塗る。
 */
withDefaults(
  defineProps<{
    priority: number | string;
    size?: "xs" | "sm" | "md";
  }>(),
  { size: "sm" },
);
</script>

<template>
  <UBadge color="neutral" variant="soft" :size="size" class="bg-current/12" :style="{ color: getTodoPriorityColor(priority) }">
    {{ getTodoPriorityLabel(priority) }}
  </UBadge>
</template>
