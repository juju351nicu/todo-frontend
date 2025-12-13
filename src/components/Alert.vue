<script setup lang="js">
import { ref, onBeforeMount, computed } from 'vue';

const props = defineProps({
    message: String,
    type: String
});

/** メッセージ情報 */
const message = computed(() => {
    return props.message;
});

const alertFlag = ref(true);

// setTimeout(() => {
//     alertFlag.value = false
// }, 4000);
</script>
<template>
    <v-alert v-model="alertFlag" :type=type dense class="alert" closable>
        {{ message }}
    </v-alert>
</template>
<style scoped>
.alert {
    margin: 5px;
    max-width: 400px;
}
</style>