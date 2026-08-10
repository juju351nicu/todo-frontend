import type { RouteRecordRaw } from "vue-router";

import InquiryForm from "@/views/InquiryForm.vue";
import LoginPage from "@/features/auth/views/LoginPage.vue";
import MemberListPage from "@/features/member/views/MemberListPage.vue";
import NotFound from "@/views/NotFound.vue";
import MemberCancel from "@/views/member/MemberCancel.vue";
import MemberDetail from "@/views/member/MemberDetail.vue";
import TodoCalendar from "@/views/todo/TodoCalendar.vue";
import TodoDetail from "@/views/todo/TodoDetail.vue";
import TodoList from "@/views/todo/todoList.vue";

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
    component: MemberDetail,
    props: { id: 0 },
  },
  {
    path: "/member/detail/:id?",
    name: "MemberDetail",
    component: MemberDetail,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/member/cancel/:id",
    name: "MemberCancel",
    component: MemberCancel,
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
    component: TodoList,
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
