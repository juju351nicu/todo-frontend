import { describe, expect, it, vi } from "vitest";

vi.mock("@/views/Login.vue", () => ({ default: {} }));
vi.mock("@/views/InquiryForm.vue", () => ({ default: {} }));
vi.mock("@/views/VuetifyList.vue", () => ({ default: {} }));
vi.mock("@/views/NotFound.vue", () => ({ default: {} }));
vi.mock("@/views/member/MemberList.vue", () => ({ default: {} }));
vi.mock("@/views/member/MemberDetail.vue", () => ({ default: {} }));
vi.mock("@/views/member/MemberCancel.vue", () => ({ default: {} }));
vi.mock("@/views/todo/TodoList.vue", () => ({ default: {} }));
vi.mock("@/views/todo/TodoDetail.vue", () => ({ default: {} }));
vi.mock("@/views/todo/TodoCalendar.vue", () => ({ default: {} }));

import { routes } from "@/router/routes.js";

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
});
