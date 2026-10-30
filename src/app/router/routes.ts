import type { RouteRecordRaw } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import {
  ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES,
  ATTENDANCE_READ_PERMISSION_CODES,
  TASK_LIST_READ_PERMISSION_CODES,
  TASK_LIST_WRITE_PERMISSION_CODES,
} from "@/features/auth/types/auth";

/**
 * Work Management Frontendの画面、遅延読込Component、認証・permission要件を定義する。
 * `requiredAnyPermissions`は表示前の補助判定であり、Backendの最終認可を代替しない。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: ROUTE_NAMES.login,
    component: () => import("@/features/auth/views/LoginPage.vue"),
    meta: { layout: "blank" },
  },
  {
    path: "/dashboard",
    name: ROUTE_NAMES.dashboard,
    component: () => import("@/features/dashboard/views/DashboardPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/attendance",
    name: ROUTE_NAMES.attendance,
    component: () => import("@/features/attendance/views/AttendancePage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ATTENDANCE_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/attendance/administration",
    name: ROUTE_NAMES.attendanceAdministration,
    component: () => import("@/features/attendance/views/AttendanceAdministrationPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/administration/accounts",
    name: ROUTE_NAMES.accountAdministration,
    component: () => import("@/features/administration/views/AccountAdministrationPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["ACCOUNT_READ"],
    },
  },
  {
    path: "/administration/authorization-audit-logs",
    name: ROUTE_NAMES.authorizationAuditList,
    component: () => import("@/features/administration/views/AuthorizationAuditListPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["AUTHORIZATION_AUDIT_READ"],
    },
  },
  {
    path: "/administration/notifications",
    name: ROUTE_NAMES.notificationAdministration,
    component: () => import("@/features/notification/views/AnnouncementManagementPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["NOTIFICATION_ANNOUNCEMENT_CREATE"],
    },
  },
  {
    path: "/accounts",
    name: ROUTE_NAMES.accountList,
    component: () => import("@/features/account/views/AccountListPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/accounts/detail/:id?",
    name: ROUTE_NAMES.accountDetail,
    component: () => import("@/features/account/views/AccountDetailPage.vue"),
    props: (route) => ({ id: Number(route.params.id ?? 0) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/accounts/cancel/:id",
    name: ROUTE_NAMES.accountCancel,
    component: () => import("@/features/account/views/AccountCancelPage.vue"),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { requiresAuth: true },
  },
  {
    path: "/projects",
    name: ROUTE_NAMES.projectList,
    component: () => import("@/features/project/views/ProjectListPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["PROJECT_READ"],
    },
  },
  {
    path: "/project-templates",
    name: ROUTE_NAMES.projectTemplates,
    component: () => import("@/features/project/views/ProjectTemplatePage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["PROJECT_READ"],
    },
  },
  {
    path: "/my-tasks",
    name: ROUTE_NAMES.myTasks,
    component: () => import("@/features/task/views/MyTasksPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/tasks/search",
    name: ROUTE_NAMES.taskSearch,
    component: () => import("@/features/task/views/TaskSearchPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/projects/:projectId/board",
    name: ROUTE_NAMES.taskBoard,
    component: () => import("@/features/task/views/TaskBoardPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/projects/:projectId/wbs",
    name: ROUTE_NAMES.wbs,
    component: () => import("@/features/wbs/views/WbsPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: ["TASK_READ"],
    },
  },
  {
    path: "/tasks/calendar",
    name: ROUTE_NAMES.taskCalendar,
    component: () => import("@/features/task-list/views/TaskCalendarPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_LIST_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/tasks/list",
    name: ROUTE_NAMES.taskList,
    component: () => import("@/features/task-list/views/TaskListPage.vue"),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_LIST_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/tasks/list/:id",
    name: ROUTE_NAMES.taskListDetail,
    component: () => import("@/features/task-list/views/TaskListDetailPage.vue"),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_LIST_READ_PERMISSION_CODES,
    },
  },
  {
    path: "/tasks/register",
    name: ROUTE_NAMES.taskRegister,
    component: () => import("@/features/task-list/views/TaskListDetailPage.vue"),
    props: { id: 0 },
    meta: {
      requiresAuth: true,
      requiredAnyPermissions: TASK_LIST_WRITE_PERMISSION_CODES,
    },
  },
  {
    path: "/forbidden",
    name: ROUTE_NAMES.accessDenied,
    component: () => import("@/app/views/AccessDeniedPage.vue"),
    meta: { requiresAuth: true, layout: "blank" },
  },
  {
    path: "/inquiry",
    name: ROUTE_NAMES.inquiryForm,
    component: () => import("@/features/inquiry/views/InquiryFormPage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: ROUTE_NAMES.notFound,
    component: () => import("@/app/views/NotFoundPage.vue"),
    meta: { layout: "blank" },
  },
];
