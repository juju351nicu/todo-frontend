import type { ProjectRole } from "@/features/project/types/project";

/** yyyy-MM-dd形式の業務日を曜日付き日本語へ変換する。 */
export const formatDashboardBusinessDate = (businessDate: string): string => {
  const date = new Date(`${businessDate}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? businessDate
    : new Intl.DateTimeFormat("ja-JP", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(date);
};

/** Backendの進捗率をVuetify progressへ渡せる0〜100へ制限する。 */
export const normalizeDashboardProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progress));
};

/** Project内roleをDashboard向け日本語へ変換する。 */
export const getDashboardProjectRoleLabel = (
  projectRole: ProjectRole | null
): string => {
  if (projectRole === null) {
    return "システム管理者参照";
  }
  return ({ OWNER: "オーナー", MANAGER: "マネージャー", MEMBER: "メンバー" })[
    projectRole
  ];
};
