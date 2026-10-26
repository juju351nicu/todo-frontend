import "@/app/theme/main.css";

import ui from "@nuxt/ui/vue-plugin";
import { createPinia } from "pinia";
import { createApp } from "vue";

import router from "@/app/router";
import App from "@/App.vue";

const pinia = createPinia();

createApp(App).use(pinia).use(router).use(ui).mount("#app");
