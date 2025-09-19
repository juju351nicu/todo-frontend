import { createRouter, createWebHistory } from 'vue-router';
import InquiryForm from '@/views/InquiryForm.vue';
import VuetifyList from '@/views/VuetifyList.vue';
import Calendar from '@/views/Calendar.vue';
import NotFound from '@/views/NotFound.vue';
import MemberList from '@/views/MemberList.vue';
const routes = [
  { path: '/', name: 'DashBoard', component: VuetifyList },
  {
    /** 会員一覧 */
    path: "/memberList",
    name: "memberList",
    component: MemberList,
  },
  { path: '/inquiry', name: 'inquiry', component: InquiryForm },
  { path: '/calendar', name: 'calendar', component: Calendar },
  {
    /** 存在しないURLにアクセスした場合 */
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFound,
  },
];

const router = createRouter({
  // Viteの環境変数でimport.meta.env.BASE_URL = vite.config.tsのbase
  history: createWebHistory(),
  routes,
});

export default router;
