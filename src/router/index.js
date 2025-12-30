import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user";
import Util from "@/utils/util.js";
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
  {
    /** ログイン画面 */
    path: "/",
    name: "Login",
    component: Login,
  },
  {
    /** Vuetifサンプル画面 */
    path: "/VuetifyList",
    name: "DashBoard",
    component: VuetifyList,
    meta: { requiresAuth: true },
  },
  {
    /** 会員一覧画面 */
    path: "/member/memberList",
    name: "MemberList",
    component: MemberList,
    meta: { requiresAuth: true },
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
    meta: { requiresAuth: true },
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
    meta: { requiresAuth: true },
  },
  {
    /** Todoカレンダー画面 */
    path: "/todo/calendar",
    name: "TodoCalendar",
    component: TodoCalendar,
    meta: { requiresAuth: true },
  },
  {
    /** Todo一覧画面 */
    path: "/todo/todoList",
    name: "TodoList",
    component: TodoList,
    meta: { requiresAuth: true },
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
    meta: { requiresAuth: true },
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
/**
 * ストアにトークン情報がある場合、true。ない場合、false。
 * @returns 判定結果
 */
const isAuthorited = () => {
  // Authストア情報
  const userStore = useUserStore();
  const token = userStore.getAccessToken;
  return !Util.isEmpty(token);
};
/**
 * ナビゲーションガード
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !isAuthorited()) {
    alert("ログインが必要です");
    next("/"); // 未認証ならログインページへ
  } else {
    next();
  }
});
export default router;
