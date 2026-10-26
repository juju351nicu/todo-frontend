<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import AppLayout from "@/app/layouts/AppLayout.vue";

const route = useRoute();
const isBlankLayout = computed<boolean>(() => route.meta.layout === "blank");
</script>

<template>
  <UApp>
    <RouterView v-if="isBlankLayout" />
    <AppLayout v-else>
      <RouterView />
    </AppLayout>
  </UApp>
</template>
