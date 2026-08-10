import { describe, expect, it } from "vitest";

import { routes } from "@/app/router/routes";

const findRoute = (name) => routes.find((route) => route.name === name);

describe("Vue routes", () => {
  it("会員とTodoのIDをパス区切り付きで受け取る", () => {
    expect(findRoute("MemberDetail").path).toBe("/member/detail/:id?");
    expect(findRoute("MemberCancel").path).toBe("/member/cancel/:id");
    expect(findRoute("TodoDetail").path).toBe("/todo/detail/:id?");
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

  it("各画面をルート単位で遅延読み込みする", () => {
    routes.forEach((route) => {
      expect(route.component).toBeTypeOf("function");
    });
  });
});
