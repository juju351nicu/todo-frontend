import { describe, expect, it } from "vitest";

import {
  formatProjectTemplateOffset,
  formatProjectTemplateTaskTitle,
  getProjectTemplatePriorityLabel,
  getProjectTemplateTaskTypeLabel,
  formatProjectTemplateParent,
  resolveProjectTemplateSlotName,
  resolveProjectTemplateStatusName,
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

describe("Template詳細の内部コード・番号を名前で示す", () => {
  const statuses = [{ statusCode: "TODO", name: "未着手", position: 1, completed: false }];
  const memberSlots = [{ slotKey: "OWNER_1", displayName: "管理 一郎", projectRole: "OWNER", position: 1 }];
  const tasks = [
    { projectTemplateTaskId: 129, parentProjectTemplateTaskId: null, wbsCode: "1", title: "設計" },
    { projectTemplateTaskId: 130, parentProjectTemplateTaskId: 129, wbsCode: "1.1", title: "画面設計" },
  ];

  it("Board列コードを列名、担当slotのキーを表示名にし、対応がなければコードのまま示す", () => {
    expect(resolveProjectTemplateStatusName("TODO", statuses)).toBe("未着手");
    expect(resolveProjectTemplateStatusName("UNKNOWN", statuses)).toBe("UNKNOWN");
    expect(resolveProjectTemplateSlotName("OWNER_1", memberSlots)).toBe("管理 一郎");
    expect(resolveProjectTemplateSlotName("MEMBER_9", memberSlots)).toBe("MEMBER_9");
  });

  it("親をsnapshot IDではなくWBS番号と件名で示し、最上位・見つからない親は空にする", () => {
    expect(formatProjectTemplateParent(129, tasks)).toBe("親: 1 設計");
    expect(formatProjectTemplateParent(null, tasks)).toBe("");
    expect(formatProjectTemplateParent(999, tasks)).toBe("");
  });
});
