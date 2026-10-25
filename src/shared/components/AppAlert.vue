<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

import StatusAlert from "@/shared/components/StatusAlert.vue";
import type { StatusAlertType } from "@/shared/types/color";

/** 表示から4秒後、または閉じる操作で非表示になる通知。Vuetify v-alertのcompact・closable表示を踏襲する。 */
defineProps<{
  message: string;
  type: StatusAlertType;
}>();

const AUTO_CLOSE_MILLISECONDS = 4000;
// ログイン失敗等の一時通知は、移行前から画面内alertより明るいMaterial redで表示している。

const isVisible = ref<boolean>(true);

const autoCloseTimer = setTimeout(() => {
  isVisible.value = false;
}, AUTO_CLOSE_MILLISECONDS);

// 4秒以内に画面遷移した場合、破棄済みComponentの状態を更新しないようtimerを止める。
onBeforeUnmount(() => clearTimeout(autoCloseTimer));
</script>

<template>
  <StatusAlert
    v-if="isVisible"
    :type="type"
    density="compact"
    class="m-1.25 max-w-100"
    :class="{ 'bg-[#F44336]': type === 'error' }"
    closable
    @close="isVisible = false"
  >
    {{ message }}
  </StatusAlert>
</template>
