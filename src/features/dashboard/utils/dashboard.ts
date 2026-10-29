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

/** Backendの進捗率を進捗バー（UProgress）へ渡せる0〜100へ制限する。 */
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

// 画面ではbaselineを「基準計画」、AC（Actual Cost）を「実績工数」と呼ぶ（利用者に英語の用語を読ませないため）。
const ADVANCED_WARNING_LABELS: Readonly<Record<string, string>> = {
  BASELINE_PLAN_UNALLOCATED: "基準計画の予定工数に未配賦があります",
  BASELINE_PLAN_OVER_ALLOCATED: "基準計画の予定工数を超えて配賦されています",
  UNBASELINED_TASK_EXISTS: "基準計画の作成後に追加されたTaskがあります",
  UNBASELINED_ACTUAL_EXCLUDED: "基準計画にないTaskの実績を実績工数（AC）から除外しています",
};

/**
 * 高度Dashboardの安定したEVM警告codeを利用者向け表示へ変換する。
 *
 * @param code Backendの警告code
 * @returns 表示文言。未知のcodeはcodeそのもの
 */
export const getAdvancedDashboardWarningLabel = (code: string): string =>
  ADVANCED_WARNING_LABELS[code] ?? code;
