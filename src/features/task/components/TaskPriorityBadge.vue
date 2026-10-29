<script setup lang="ts">
import type { TaskPriority } from "@/features/project/types/project";
import { getTaskPriorityColor, getTaskPriorityLabel } from "@/features/task/utils/taskDisplay";

/**
 * Project Task（My Tasks・Task検索・Dashboard）の優先度（1:低、2:中、3:高）を色付きbadgeで表示する。
 * 色はBoardのTask cardと同じ`getTaskPriorityColor`（高=error、中=warning、低=info）にし、同じTaskが画面ごとに
 * 違う色で見えないようにする。文字を優先度の色にした薄い背景（soft）で出す。
 */
withDefaults(
  defineProps<{
    priority: TaskPriority;
    size?: "xs" | "sm" | "md";
  }>(),
  { size: "sm" }
);
</script>

<template>
  <UBadge :color="getTaskPriorityColor(priority)" variant="soft" :size="size">
    {{ getTaskPriorityLabel(priority) }}
  </UBadge>
</template>
