import type { RouteRecordRaw } from "vue-router";

import InquiryForm from "@/views/InquiryForm.vue";
import LoginPage from "@/features/auth/views/LoginPage.vue";
import MemberCancelPage from "@/features/member/views/MemberCancelPage.vue";
import MemberDetailPage from "@/features/member/views/MemberDetailPage.vue";
import MemberListPage from "@/features/member/views/MemberListPage.vue";
import TodoListPage from "@/features/task/views/TodoListPage.vue";
import NotFound from "@/views/NotFound.vue";
import TodoCalendar from "@/views/todo/TodoCalendar.vue";
import TodoDetail from "@/views/todo/TodoDetail.vue";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Login",
    component: LoginPage,
  },
  {
    path: "/member/memberList",
    name: "MemberList",
    component: MemberListPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/member/register",
    name: "MemberRegister",
    component: MemberDetailPage,
    props: { id: 0 },
  },
  {
    path: "/member/detail/:id?",
    name: "MemberDetail",
    component: MemberDetailPage,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/member/cancel/:id",
    name: "MemberCancel",
    component: MemberCancelPage,
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/calendar",
    name: "TodoCalendar",
    component: TodoCalendar,
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/todoList",
    name: "TodoList",
    component: TodoListPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/detail/:id?",
    name: "TodoDetail",
    component: TodoDetail,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/inquiry",
    name: "InquiryForm",
    component: InquiryForm,
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFound,
  },
];
