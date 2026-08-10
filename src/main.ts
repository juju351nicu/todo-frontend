import { createPinia } from "pinia";
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import "vuetify/styles";

import router from "@/app/router";
import App from "@/App.vue";

const pinia = createPinia();
const vuetify = createVuetify({});

createApp(App).use(pinia).use(router).use(vuetify).mount("#app");
