<script setup lang="ts">
import { getTodoPriorityColor, getTodoPriorityLabel } from "@/features/task/utils/taskDisplay";

/**
 * Project Task（My Tasks・Task検索・Dashboard）の優先度（1:低、2:中、3:高）を色付きbadgeで表示する。
 * 色は固定のhex値（`getTodoPriorityColor`）のため、Nuxt UIのcolorで指定できない。文字をその色にし、背景を同じ色の12%で塗る。
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
