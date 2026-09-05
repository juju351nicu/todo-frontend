import type { RouteRecordRaw } from "vue-router";

import {
  ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES,
  ATTENDANCE_READ_PERMISSION_CODES,
  TASK_READ_PERMISSION_CODES,
  TASK_WRITE_PERMISSION_CODES,
} from "@/features/auth/types/auth";

/**
 * Work Management Frontendの画面、遅延読込Component、認証・permission要件を定義する。
 * `requiredAnyPermissions`は表示前の補助判定であり、Backendの最終認可を代替しない。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Login",
    component: () => import("@/features/auth/views/LoginPage.vue"),
  },
  {
    path: "/attendance",
    name: "Attendance",
    component: () => import("@/features/attendance/views/AttendancePage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ATTENDANCE_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/attendance/administration",
    name: "AttendanceAdministration",
    component: () =>
      import(
        "@/features/attendance/views/AttendanceAdministrationPage.vue"
      ),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/administration/accounts",
    name: "AccountAdministration",
    component: () =>
      import(
        "@/features/administration/views/AccountAdministrationPage.vue"
      ),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["ACCOUNT_READ"],
    },
  },
  {
    path: "/administration/authorization-audit-logs",
    name: "AuthorizationAuditList",
    component: () =>
      import(
        "@/features/administration/views/AuthorizationAuditListPage.vue"
      ),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["AUTHORIZATION_AUDIT_READ"],
    },
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
    path: "/projects",
    name: "ProjectList",
    component: () => import("@/features/project/views/ProjectListPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["PROJECT_READ"],
    },
  },
  {
    path: "/projects/:projectId/board",
    name: "TaskBoard",
    component: () => import("@/features/task/views/TaskBoardPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/projects/:projectId/wbs",
    name: "Wbs",
    component: () => import("@/features/wbs/views/WbsPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/todo/calendar",
    name: "TodoCalendar",
    component: () => import("@/features/task/views/TodoCalendarPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/todo/todoList",
    name: "TodoList",
    component: () => import("@/features/task/views/TodoListPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/todo/detail/:id",
    name: "TodoDetail",
    component: () => import("@/features/task/views/TodoDetailPage.vue"),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/todo/register",
    name: "TodoRegister",
    component: () => import("@/features/task/views/TodoDetailPage.vue"),
    props: { id: 0 },
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_WRITE_PERMISSION_CODES,
    },
  },
  {
    path: "/forbidden",
    name: "AccessDenied",
    component: () => import("@/app/views/AccessDeniedPage.vue"),
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
