<script setup lang="ts">
import { ref } from "vue";

defineProps<{
    message: string;
    type: "success" | "info" | "warning" | "error";
}>();

const alertFlag = ref<boolean>(true);

setTimeout(() => {
    alertFlag.value = false;
}, 4000);
</script>
<template>
    <v-alert v-model="alertFlag" :type="type" density="compact" class="alert" closable>
        {{ message }}
    </v-alert>
</template>
<style scoped>
.alert {
    margin: 5px;
    max-width: 400px;
}
.bg-error {
    background-color: #F44336 !important
}
</style>
