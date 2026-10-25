import "@/app/theme/main.css";

import ui from "@nuxt/ui/vue-plugin";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { createVuetify } from "vuetify";

import router from "@/app/router";
import App from "@/App.vue";

const pinia = createPinia();
const vuetify = createVuetify({});

createApp(App).use(pinia).use(router).use(vuetify).use(ui).mount("#app");
