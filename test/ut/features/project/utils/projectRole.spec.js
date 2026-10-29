import { describe, expect, it } from "vitest";

import {
  canManageProject,
  canManageProjectTasks,
  findProjectRole,
  getProjectRoleDescription,
} from "@/features/project/utils/projectRole";

describe("getProjectRoleDescription", () => {
  it.each([
    ["OWNER", "Project設定・メンバー・Taskを管理"],
    ["MANAGER", "Taskを管理"],
    ["MEMBER", "Taskを参照・担当Taskを更新"],
  ])("%sの操作説明を返す", (role, description) => {
    expect(getProjectRoleDescription(role)).toBe(description);
  });
});

describe("findProjectRole", () => {
  const project = {
    members: [
      { accountId: 7, projectRole: "OWNER" },
      { accountId: 8, projectRole: "MEMBER" },
    ],
  };

  it("参加者のroleを返し、参加していない・読込前・未ログインはnullを返す", () => {
    expect(findProjectRole(project, 8)).toBe("MEMBER");
    expect(findProjectRole(project, 9)).toBeNull();
    expect(findProjectRole(null, 7)).toBeNull();
    expect(findProjectRole(project, null)).toBeNull();
  });
});

describe("Projectの管理権限", () => {
  it.each([
    [true, null, true, true],
    [false, "OWNER", true, true],
    [false, "MANAGER", false, true],
    [false, "MEMBER", false, false],
    [false, null, false, false],
  ])(
    "SYSTEM_ADMIN=%s・role=%sなら、Project管理=%s・Task管理=%s",
    (isSystemAdmin, role, project, tasks) => {
      expect(canManageProject(isSystemAdmin, role)).toBe(project);
      expect(canManageProjectTasks(isSystemAdmin, role)).toBe(tasks);
    }
  );
});
