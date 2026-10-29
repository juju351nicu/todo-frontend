import { describe, expect, it } from "vitest";

import {
  getProjectStatusColor,
  getProjectStatusLabel,
  isActiveProject,
} from "@/features/project/utils/projectStatus";

describe("projectStatus", () => {
  it.each([
    ["ACTIVE", "利用中", "success"],
    ["ARCHIVED", "アーカイブ", "neutral"],
  ])("%sの表示名とbadge色を返す", (status, label, color) => {
    expect(getProjectStatusLabel(status)).toBe(label);
    expect(getProjectStatusColor(status)).toBe(color);
  });
});

describe("isActiveProject", () => {
  it("利用中だけtrueにし、archive済み・読込前はfalseにする", () => {
    expect(isActiveProject({ status: "ACTIVE" })).toBe(true);
    expect(isActiveProject({ status: "ARCHIVED" })).toBe(false);
    expect(isActiveProject(null)).toBe(false);
  });
});
