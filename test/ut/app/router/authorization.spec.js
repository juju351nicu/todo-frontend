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

  it("permissionに応じて認証後の既定画面を選択する", () => {
    expect(resolveAuthenticatedHomeRouteName(["TASK_READ_OWN"])).toBe(
      "TodoCalendar"
    );
    expect(resolveAuthenticatedHomeRouteName(["ACCOUNT_READ"])).toBe(
      "MemberList"
    );
    expect(resolveAuthenticatedHomeRouteName([])).toBe("AccessDenied");
  });
});
