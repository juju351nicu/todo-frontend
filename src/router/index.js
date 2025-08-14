import { createRouter, createWebHistory } from 'vue-router';
import InquiryForm from '../views/InquiryForm.vue';
import VuetifyList from '../views/VuetifyList.vue';
import Calendar from '../views/Calendar.vue';
const routes = [
  { path: '/', name: 'vuetify', component: VuetifyList },
  { path: '/inquiry', name: 'inquiry', component: InquiryForm },
  { path: '/calendar', name: 'calendar', component: Calendar },
];

const router = createRouter({
  // Viteの環境変数でimport.meta.env.BASE_URL = vite.config.tsのbase
  history: createWebHistory(),
  routes,
});

export default router;
