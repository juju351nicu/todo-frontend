import { describe, expect, it } from "vitest";

import { getProjectStatusColor, getProjectStatusLabel } from "@/features/project/utils/projectStatus";

describe("projectStatus", () => {
  it.each([
    ["ACTIVE", "利用中", "success"],
    ["ARCHIVED", "アーカイブ", "neutral"],
  ])("%sの表示名とbadge色を返す", (status, label, color) => {
    expect(getProjectStatusLabel(status)).toBe(label);
    expect(getProjectStatusColor(status)).toBe(color);
  });
});
