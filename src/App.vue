<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import AppLayout from "@/app/layouts/AppLayout.vue";
import { resolveRouterViewKey } from "@/app/router/routerViewKey";

const route = useRoute();
const isBlankLayout = computed<boolean>(() => route.meta.layout === "blank");
const routerViewKey = computed(() => resolveRouterViewKey(route.params));
</script>

<template>
  <UApp>
    <RouterView v-if="isBlankLayout" />
    <AppLayout v-else>
      <RouterView :key="routerViewKey" />
    </AppLayout>
  </UApp>
</template>
