import { createRouter, createWebHistory } from "vue-router";
import InquiryForm from "@/views/InquiryForm.vue";
import VuetifyList from "@/views/VuetifyList.vue";
import Calendar from "@/views/Calendar.vue";
import NotFound from "@/views/NotFound.vue";
import MemberList from "@/views/member/MemberList.vue";
import MemberDetail from "@/views/member/MemberDetail.vue";

const routes = [
  { path: "/", name: "DashBoard", component: VuetifyList },
  {
    /** 会員一覧 */
    path: "/member/memberList",
    name: "MemberList",
    component: MemberList,
  },
  {
    /** 会員詳細情報 */
    path: "/member/detail:id?",
    name: "MemberDetail",
    component: MemberDetail,
    props: (routes) => {
      const idNum = Number(routes.params.id);
      return {
        id: idNum,
      };
    },
  },
  { path: "/inquiry", name: "InquiryForm", component: InquiryForm },
  { path: "/calendar", name: "Calendar", component: Calendar },
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
