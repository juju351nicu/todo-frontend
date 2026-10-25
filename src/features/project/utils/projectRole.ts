import type { ProjectRole } from "@/features/project/types/project";

const PROJECT_ROLE_DESCRIPTIONS: Readonly<Record<ProjectRole, string>> = {
  OWNER: "Project設定・メンバー・Taskを管理",
  MANAGER: "Taskを管理",
  MEMBER: "Taskを参照・担当Taskを更新",
};

/** Project roleコードを、そのroleでできる操作の説明へ変換する。実際の操作可否はBackendが判定する。 */
export const getProjectRoleDescription = (role: ProjectRole): string => PROJECT_ROLE_DESCRIPTIONS[role];
