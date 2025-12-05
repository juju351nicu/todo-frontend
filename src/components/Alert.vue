<script setup lang="js">
import { ref, onBeforeMount, computed } from 'vue';

const props = defineProps({
    messages: Array,
});

/** メッセージリスト情報 */
const messages = computed(() => {
    console.log("messages:" + props.messages.length);
    return props.messages;
});

const alertFlag = ref(true);

onBeforeMount(() => {
    setTimeout(() => {
        alertFlag.value = false
    }, 4000);
});
</script>
<template>
    <!-- <div>
        <v-alert v-model="alertFlag" type="success" dense class="alert" closable>
        登録しました。
    </v-alert>
    </div> -->
    <div v-for="(alert, index) in props.messages" :key="index" >
        <v-alert v-model="alertFlag" type="success" dense class="alert" closable>
            {{ alert }}
        </v-alert>
    </div>
</template>