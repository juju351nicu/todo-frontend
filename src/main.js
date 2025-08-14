import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';
// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import router from './router';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const pinia = createPinia();
pinia.use(createPersistedState());
const vuetify = createVuetify({
  components,
  directives,
});

createApp(App).use(router).use(pinia).use(vuetify).mount('#app');
