<script setup lang="ts">
import { getTodoPriorityColor, getTodoPriorityLabel } from "@/features/todo/utils/todoDisplay";

/**
 * 旧Todo一覧の重要度（1:低、2:中、3以上:高）を色付きbadgeで表示する。
 * 重要度色はsemantic colorではなく固定のhex値（`getTodoPriorityColor`）のため、Nuxt UIのcolorで指定できない。
 * 文字をその色にし、背景を同じ色の12%で塗る。
 */
withDefaults(
  defineProps<{
    priority: number | string;
    size?: "xs" | "sm" | "md";
  }>(),
  { size: "sm" }
);
</script>

<template>
  <UBadge
    color="neutral"
    variant="soft"
    :size="size"
    class="bg-current/12"
    :style="{ color: getTodoPriorityColor(priority) }"
  >
    {{ getTodoPriorityLabel(priority) }}
  </UBadge>
</template>
