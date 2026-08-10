import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/views/LoginPage.vue", () => ({ default: {} }));
vi.mock("@/views/InquiryForm.vue", () => ({ default: {} }));
vi.mock("@/views/NotFound.vue", () => ({ default: {} }));
vi.mock("@/features/member/views/MemberListPage.vue", () => ({ default: {} }));
vi.mock("@/features/member/views/MemberDetailPage.vue", () => ({ default: {} }));
vi.mock("@/features/member/views/MemberCancelPage.vue", () => ({ default: {} }));
vi.mock("@/views/todo/todoList.vue", () => ({ default: {} }));
vi.mock("@/views/todo/TodoDetail.vue", () => ({ default: {} }));
vi.mock("@/views/todo/TodoCalendar.vue", () => ({ default: {} }));

import { routes } from "@/router/routes";

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
});
