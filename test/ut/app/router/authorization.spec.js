import { describe, expect, it } from "vitest";

import {
  hasAnyPermission,
  resolveAuthenticatedHomeRouteName,
} from "@/app/router/authorization";

describe("Router authorization", () => {
  it("要求permissionのいずれかを持つ場合だけ許可する", () => {
    expect(
      hasAnyPermission(["TASK_READ_OWN"], ["TASK_READ_ALL", "TASK_READ_OWN"])
    ).toBe(true);
    expect(
      hasAnyPermission(["ACCOUNT_READ"], ["TASK_READ_ALL", "TASK_READ_OWN"])
    ).toBe(false);
  });

  it("全認証利用者の既定画面をBasic Dashboardにする", () => {
    expect(resolveAuthenticatedHomeRouteName(["TASK_READ"])).toBe("Dashboard");
    expect(resolveAuthenticatedHomeRouteName(["TASK_READ_OWN"])).toBe(
      "Dashboard"
    );
    expect(resolveAuthenticatedHomeRouteName(["ACCOUNT_READ"])).toBe(
      "Dashboard"
    );
    expect(resolveAuthenticatedHomeRouteName([])).toBe("Dashboard");
  });
});
