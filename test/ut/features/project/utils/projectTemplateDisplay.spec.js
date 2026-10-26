import { describe, expect, it } from "vitest";

import {
  formatProjectTemplateOffset,
  formatProjectTemplateTaskTitle,
  getProjectTemplatePriorityLabel,
  getProjectTemplateTaskTypeLabel,
} from "@/features/project/utils/projectTemplateDisplay";

describe("projectTemplateDisplay", () => {
  it.each([
    [0, "基準日"],
    [3, "+3日"],
    [-2, "-2日"],
  ])("offset %iを%sと表示する", (offset, label) => {
    expect(formatProjectTemplateOffset(offset)).toBe(label);
  });

  it("種別と優先度を表示名へ変換する", () => {
    expect(getProjectTemplateTaskTypeLabel("MILESTONE")).toBe("Milestone");
    expect(getProjectTemplatePriorityLabel(3)).toBe("高");
  });

  it("依存先TaskをWBS code付きで表示し、WBS codeがなければTask名だけにする", () => {
    const tasks = [
      { projectTemplateTaskId: 1, wbsCode: "1.1", title: "設計" },
      { projectTemplateTaskId: 2, wbsCode: null, title: "レビュー" },
    ];

    expect(formatProjectTemplateTaskTitle(tasks, 1)).toBe("1.1 設計");
    expect(formatProjectTemplateTaskTitle(tasks, 2)).toBe("レビュー");
  });

  it("snapshot内に存在しないTask IDはIDで表示する", () => {
    expect(formatProjectTemplateTaskTitle([], 99)).toBe("ID: 99");
  });
});
