import { describe, expect, it } from "vitest";

import { hasAnyPermission, AUTHENTICATED_HOME_ROUTE_NAME } from "@/app/router/authorization";

describe("Router authorization", () => {
  it("要求permissionのいずれかを持つ場合だけ許可する", () => {
    expect(hasAnyPermission(["TASK_READ_OWN"], ["TASK_READ_ALL", "TASK_READ_OWN"])).toBe(true);
    expect(hasAnyPermission(["ACCOUNT_READ"], ["TASK_READ_ALL", "TASK_READ_OWN"])).toBe(false);
  });

  it("全認証利用者の既定画面をBasic Dashboardにする", () => {
    expect(AUTHENTICATED_HOME_ROUTE_NAME).toBe("Dashboard");
  });
});
