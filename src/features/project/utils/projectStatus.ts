import type { ProjectStatus } from "@/features/project/types/project";

const PROJECT_STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  ACTIVE: "利用中",
  ARCHIVED: "アーカイブ",
};

/**
 * Project状態コードを、画面のbadgeに出す表示名へ変換する。
 * Project一覧の検索もこの表示名で照合するため、badgeの文言はここだけで決める。
 *
 * @param status Backendが返すProject状態
 * @returns 「利用中」または「アーカイブ」
 */
export const getProjectStatusLabel = (status: ProjectStatus): string =>
  PROJECT_STATUS_LABELS[status];

/**
 * Project状態のbadge色を返す。利用中だけを強調し、archive済みは目立たない色にする。
 *
 * @param status Backendが返すProject状態
 * @returns Nuxt UIのbadge color
 */
export const getProjectStatusColor = (status: ProjectStatus): "success" | "neutral" =>
  status === "ACTIVE" ? "success" : "neutral";

/**
 * Projectが利用中（archive済みでない）か。archive済みのProjectでは、Backendが変更を409で拒否する。
 *
 * @param project Project。読込前はnull
 * @returns 利用中の場合true。読込前はfalse
 */
export const isActiveProject = (project: { status: ProjectStatus } | null | undefined): boolean =>
  project?.status === "ACTIVE";
