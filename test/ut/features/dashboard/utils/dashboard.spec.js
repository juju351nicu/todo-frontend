import { describe, expect, it } from "vitest";

import {
  formatDashboardBusinessDate,
  getDashboardProjectRoleLabel,
  normalizeDashboardProgress,
} from "@/features/dashboard/utils/dashboard";

describe("Dashboard表示utility", () => {
  it("Backend業務日を端末timezoneに依存せず曜日付きで表示する", () => {
    expect(formatDashboardBusinessDate("2026-09-21")).toBe(
      "2026年9月21日(月)"
    );
    expect(formatDashboardBusinessDate("invalid")).toBe("invalid");
  });

  it("進捗率を0から100の範囲へ制限する", () => {
    expect(normalizeDashboardProgress(-0.01)).toBe(0);
    expect(normalizeDashboardProgress(72.5)).toBe(72.5);
    expect(normalizeDashboardProgress(100.01)).toBe(100);
    expect(normalizeDashboardProgress(Number.NaN)).toBe(0);
  });

  it("Project roleとSYSTEM_ADMINの未参加参照を区別する", () => {
    expect(getDashboardProjectRoleLabel("OWNER")).toBe("オーナー");
    expect(getDashboardProjectRoleLabel("MANAGER")).toBe("マネージャー");
    expect(getDashboardProjectRoleLabel("MEMBER")).toBe("メンバー");
    expect(getDashboardProjectRoleLabel(null)).toBe("システム管理者参照");
  });
});
