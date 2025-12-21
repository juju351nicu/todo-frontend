import { createRouter, createWebHistory } from "vue-router";
import Login from "@/views/Login.vue";
import InquiryForm from "@/views/InquiryForm.vue";
import VuetifyList from "@/views/VuetifyList.vue";
import NotFound from "@/views/NotFound.vue";
import MemberList from "@/views/member/MemberList.vue";
import MemberDetail from "@/views/member/MemberDetail.vue";
import MemberCancel from "@/views/member/MemberCancel.vue";
import TodoList from "@/views/todo/TodoList.vue";
import TodoDetail from "@/views/todo/TodoDetail.vue";
import TodoCalendar from "@/views/todo/TodoCalendar.vue";
const routes = [
  { path: "/", name: "DashBoard", component: VuetifyList },
  {
    /** ログイン画面 */
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    /** 会員一覧画面 */
    path: "/member/memberList",
    name: "MemberList",
    component: MemberList,
  },
  {
    /** 会員詳細情報画面 */
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
  {
    /** 会員退会画面 */
    path: "/member/cancel:id",
    name: "MemberCancel",
    component: MemberCancel,
    props: (routes) => {
      const idNum = Number(routes.params.id);
      return {
        id: idNum,
      };
    },
  },
  {
    /** Todoカレンダー画面 */
    path: "/todo/calendar",
    name: "TodoCalendar",
    component: TodoCalendar,
  },
  {
    /** Todo一覧画面 */
    path: "/todo/todoList",
    name: "TodoList",
    component: TodoList,
  },
  {
    /** Todo詳細情報画面 */
    path: "/todo/detail:id?",
    name: "TodoDetail",
    component: TodoDetail,
    props: (routes) => {
      const idNum = Number(routes.params.id);
      return {
        id: idNum,
      };
    },
  },
  {
    /** お問い合わせ画面 */
    path: "/inquiry",
    name: "InquiryForm",
    component: InquiryForm,
  },
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
