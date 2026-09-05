import { describe, expect, it } from "vitest";

import { routes } from "@/app/router/routes";

const findRoute = (name) => routes.find((route) => route.name === name);

describe("Vue routes", () => {
  it("会員とTodoのIDをパス区切り付きで受け取る", () => {
    expect(findRoute("MemberDetail").path).toBe("/member/detail/:id?");
    expect(findRoute("MemberCancel").path).toBe("/member/cancel/:id");
    expect(findRoute("TodoDetail").path).toBe("/todo/detail/:id");
  });

  it("未ログインでも会員新規登録画面を開ける", () => {
    const route = findRoute("MemberRegister");

    expect(route.path).toBe("/member/register");
    expect(route.props).toEqual({ id: 0 });
    expect(route.meta?.requiresAuth).not.toBe(true);
  });

  it("試作Dashboardルートを公開しない", () => {
    expect(findRoute("DashBoard")).toBeUndefined();
    expect(findRoute("TodoCalendar").path).toBe("/todo/calendar");
  });

  it("Todo画面にBackendと一致するpermissionメタデータを設定する", () => {
    expect(findRoute("TodoList").meta.requiredAnyPermissions).toEqual([
      "TASK_READ_ALL",
      "TASK_READ_OWN",
    ]);
    expect(findRoute("TodoRegister").meta.requiredAnyPermissions).toEqual([
      "TASK_WRITE_ALL",
      "TASK_WRITE_OWN",
    ]);
  });

  it("本人勤怠画面をATTENDANCE_READ_OWNで保護する", () => {
    const route = findRoute("Attendance");

    expect(route.path).toBe("/attendance");
    expect(route.meta.requiredAnyPermissions).toEqual([
      "ATTENDANCE_READ_OWN",
    ]);
  });

  it("Project一覧・Board・WBSをBackendの専用permissionで保護する", () => {
    const projectList = findRoute("ProjectList");
    const taskBoard = findRoute("TaskBoard");
    const wbs = findRoute("Wbs");

    expect(projectList.path).toBe("/projects");
    expect(projectList.meta.requiredAnyPermissions).toEqual(["PROJECT_READ"]);
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
    expect(route.meta.requiredAnyPermissions).toEqual([
      "AUTHORIZATION_AUDIT_READ",
    ]);
  });

  it("各画面をルート単位で遅延読み込みする", () => {
    routes.forEach((route) => {
      expect(route.component).toBeTypeOf("function");
    });
  });
});
