import { describe, expect, it } from "vitest";

import { routes } from "@/app/router/routes";

const findRoute = (name) => routes.find((route) => route.name === name);

describe("Vue routes", () => {
  it("会員とTaskのIDをパス区切り付きで受け取る", () => {
    expect(findRoute("MemberDetail").path).toBe("/member/detail/:id?");
    expect(findRoute("MemberCancel").path).toBe("/member/cancel/:id");
    expect(findRoute("TaskListDetail").path).toBe("/tasks/list/:id");
  });

  it("未ログインで開ける会員登録画面は置かず、会員の登録はログイン後の会員詳細（ID なし）で行う", () => {
    // Backendの会員APIはログインが必要で、未ログインの登録画面は保存が必ず401になっていた
    // （確認依頼「旧会員APIの認可」3、2026-10-28決定）。
    expect(findRoute("MemberRegister")).toBeUndefined();
    expect(routes.some((route) => route.path === "/member/register")).toBe(false);
    expect(findRoute("MemberDetail").meta.requiresAuth).toBe(true);
  });

  it("Basic Dashboardを全認証利用者向けルートとして公開する", () => {
    const dashboard = findRoute("Dashboard");

    expect(dashboard.path).toBe("/dashboard");
    expect(dashboard.meta.requiresAuth).toBe(true);
    expect(dashboard.meta.requiredAnyPermissions).toBeUndefined();
  });

  it("Task一覧の画面にBackendと一致するpermissionメタデータを設定する", () => {
    expect(findRoute("TaskList").meta.requiredAnyPermissions).toEqual([
      "TASK_READ_ALL",
      "TASK_READ_OWN",
    ]);
    expect(findRoute("TaskRegister").meta.requiredAnyPermissions).toEqual([
      "TASK_WRITE_ALL",
      "TASK_WRITE_OWN",
    ]);
  });

  it("本人勤怠画面をATTENDANCE_READ_OWNで保護する", () => {
    const route = findRoute("Attendance");

    expect(route.path).toBe("/attendance");
    expect(route.meta.requiredAnyPermissions).toEqual(["ATTENDANCE_READ_OWN"]);
  });

  it("管理者勤怠月画面をATTENDANCE_READ_ALLで保護する", () => {
    const route = findRoute("AttendanceAdministration");

    expect(route.path).toBe("/attendance/administration");
    expect(route.meta.requiredAnyPermissions).toEqual(["ATTENDANCE_READ_ALL"]);
  });

  it("Project一覧・Template・My Tasks・Task検索・Board・WBSをBackendの専用permissionで保護する", () => {
    const projectList = findRoute("ProjectList");
    const projectTemplates = findRoute("ProjectTemplates");
    const myTasks = findRoute("MyTasks");
    const taskSearch = findRoute("TaskSearch");
    const taskBoard = findRoute("TaskBoard");
    const wbs = findRoute("Wbs");

    expect(projectList.path).toBe("/projects");
    expect(projectList.meta.requiredAnyPermissions).toEqual(["PROJECT_READ"]);
    expect(projectTemplates.path).toBe("/project-templates");
    expect(projectTemplates.meta.requiredAnyPermissions).toEqual(["PROJECT_READ"]);
    expect(myTasks.path).toBe("/my-tasks");
    expect(myTasks.meta.requiredAnyPermissions).toEqual(["TASK_READ"]);
    expect(taskSearch.path).toBe("/tasks/search");
    expect(taskSearch.meta.requiredAnyPermissions).toEqual(["TASK_READ"]);
    expect(taskBoard.path).toBe("/projects/:projectId/board");
    expect(taskBoard.meta.requiredAnyPermissions).toEqual(["TASK_READ"]);
    expect(wbs.path).toBe("/projects/:projectId/wbs");
    expect(wbs.meta.requiredAnyPermissions).toEqual(["TASK_READ"]);
  });

  it("アカウント・ロール管理画面をACCOUNT_READで保護する", () => {
    const route = findRoute("AccountAdministration");

    expect(route.path).toBe("/administration/accounts");
    expect(route.meta.requiredAnyPermissions).toEqual(["ACCOUNT_READ"]);
  });

  it("権限変更監査ログ画面を専用permissionで保護する", () => {
    const route = findRoute("AuthorizationAuditList");

    expect(route.path).toBe("/administration/authorization-audit-logs");
    expect(route.meta.requiredAnyPermissions).toEqual(["AUTHORIZATION_AUDIT_READ"]);
  });

  it("お知らせ配信画面を専用permissionで保護する", () => {
    const route = findRoute("NotificationAdministration");

    expect(route.path).toBe("/administration/notifications");
    expect(route.meta.requiredAnyPermissions).toEqual(["NOTIFICATION_ANNOUNCEMENT_CREATE"]);
  });

  it("各画面をルート単位で遅延読み込みする", () => {
    routes.forEach((route) => {
      expect(route.component).toBeTypeOf("function");
    });
  });
});
