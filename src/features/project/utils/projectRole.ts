import type { ProjectDetail, ProjectRole } from "@/features/project/types/project";

const PROJECT_ROLE_DESCRIPTIONS: Readonly<Record<ProjectRole, string>> = {
  OWNER: "Project設定・メンバー・Taskを管理",
  MANAGER: "Taskを管理",
  MEMBER: "Taskを参照・担当Taskを更新",
};

/** Project roleコードを、そのroleでできる操作の説明へ変換する。実際の操作可否はBackendが判定する。 */
export const getProjectRoleDescription = (role: ProjectRole): string => PROJECT_ROLE_DESCRIPTIONS[role];

/**
 * Project詳細の参加者から、アカウントのProject roleを探す。
 *
 * @param project Project詳細。読込前はnull
 * @param accountId ログイン中のアカウントID。未ログインはnull
 * @returns 参加していればそのrole、参加していない・読込前ならnull
 */
export const findProjectRole = (
  project: Pick<ProjectDetail, "members"> | null | undefined,
  accountId: number | null
): ProjectRole | null =>
  project?.members.find((member) => member.accountId === accountId)?.projectRole ?? null;

/**
 * Projectの設定・メンバー・Templateの保存を管理できるか（SYSTEM_ADMIN、またはProjectのOWNER）。
 * Backendの`ProjectAuthorizationLogic#canManageProject`と同じ規則。最終的な認可はBackendが行う。
 *
 * @param isSystemAdmin ログイン中のアカウントがSYSTEM_ADMINか
 * @param projectRole ログイン中のアカウントのProject role。参加していなければnull
 * @returns 管理できる場合true
 */
export const canManageProject = (isSystemAdmin: boolean, projectRole: ProjectRole | null): boolean =>
  isSystemAdmin || projectRole === "OWNER";

/**
 * Project内のTaskを管理できるか（SYSTEM_ADMIN、またはProjectのOWNER・MANAGER）。
 * Board列の移動・繰り返し規則・WBSの管理操作、他の参加者への担当の割当に使う。最終的な認可はBackendが行う。
 *
 * @param isSystemAdmin ログイン中のアカウントがSYSTEM_ADMINか
 * @param projectRole ログイン中のアカウントのProject role。参加していなければnull
 * @returns 管理できる場合true
 */
export const canManageProjectTasks = (
  isSystemAdmin: boolean,
  projectRole: ProjectRole | null
): boolean => isSystemAdmin || projectRole === "OWNER" || projectRole === "MANAGER";
