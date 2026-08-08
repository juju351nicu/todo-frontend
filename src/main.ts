import { createPinia } from "pinia";
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import "vuetify/styles";

import App from "@/App.vue";
import router from "@/router";

const pinia = createPinia();
const vuetify = createVuetify({});

createApp(App).use(pinia).use(router).use(vuetify).mount("#app");
