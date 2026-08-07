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

export const routes = [
  {
    /** ログイン画面 */
    path: "/",
    name: "Login",
    component: Login,
  },
  {
    /** Vuetifyサンプル画面 */
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
    /** 会員新規登録画面 */
    path: "/member/register",
    name: "MemberRegister",
    component: MemberDetail,
    props: { id: 0 },
  },
  {
    /** 会員詳細情報画面 */
    path: "/member/detail/:id?",
    name: "MemberDetail",
    component: MemberDetail,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    /** 会員退会画面 */
    path: "/member/cancel/:id",
    name: "MemberCancel",
    component: MemberCancel,
    props: (route) => ({ id: Number(route.params.id) }),
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
    path: "/todo/detail/:id?",
    name: "TodoDetail",
    component: TodoDetail,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
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
