import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Login",
    component: () => import("@/features/auth/views/LoginPage.vue"),
  },
  {
    path: "/member/memberList",
    name: "MemberList",
    component: () => import("@/features/member/views/MemberListPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/member/register",
    name: "MemberRegister",
    component: () => import("@/features/member/views/MemberDetailPage.vue"),
    props: { id: 0 },
  },
  {
    path: "/member/detail/:id?",
    name: "MemberDetail",
    component: () => import("@/features/member/views/MemberDetailPage.vue"),
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/member/cancel/:id",
    name: "MemberCancel",
    component: () => import("@/features/member/views/MemberCancelPage.vue"),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/calendar",
    name: "TodoCalendar",
    component: () => import("@/features/task/views/TodoCalendarPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/todoList",
    name: "TodoList",
    component: () => import("@/features/task/views/TodoListPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/todo/detail/:id?",
    name: "TodoDetail",
    component: () => import("@/features/task/views/TodoDetailPage.vue"),
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/inquiry",
    name: "InquiryForm",
    component: () => import("@/features/inquiry/views/InquiryFormPage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/app/views/NotFoundPage.vue"),
  },
];
