import type { RouteRecordRaw } from "vue-router";

import LoginPage from "@/features/auth/views/LoginPage.vue";
import InquiryFormPage from "@/features/inquiry/views/InquiryFormPage.vue";
import MemberCancelPage from "@/features/member/views/MemberCancelPage.vue";
import MemberDetailPage from "@/features/member/views/MemberDetailPage.vue";
import MemberListPage from "@/features/member/views/MemberListPage.vue";
import TodoCalendarPage from "@/features/task/views/TodoCalendarPage.vue";
import TodoDetailPage from "@/features/task/views/TodoDetailPage.vue";
import TodoListPage from "@/features/task/views/TodoListPage.vue";
import NotFound from "@/views/NotFound.vue";

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
    component: TodoCalendarPage,
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
    component: TodoDetailPage,
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/inquiry",
    name: "InquiryForm",
    component: InquiryFormPage,
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFound,
  },
];
