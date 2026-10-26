import { describe, expect, it } from "vitest";

import { getProjectRoleDescription } from "@/features/project/utils/projectRole";

describe("getProjectRoleDescription", () => {
  it.each([
    ["OWNER", "Project設定・メンバー・Taskを管理"],
    ["MANAGER", "Taskを管理"],
    ["MEMBER", "Taskを参照・担当Taskを更新"],
  ])("%sの操作説明を返す", (role, description) => {
    expect(getProjectRoleDescription(role)).toBe(description);
  });
});
