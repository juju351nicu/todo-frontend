import type { ProjectMember } from "@/features/project/types/project";
import { getAccountStatusLabel } from "@/shared/utils/accountStatus";

/** 担当者の選択肢1件。Nuxt UIの`USelect`へ`label-key="title"`・`value-key="value"`で渡す。 */
export interface ProjectMemberOption {
  /** 表示名とProject role（停止中なら状態も）を含む表示文字列。 */
  title: string;
  /** 参加者のアカウントID。 */
  value: number;
}

/** {@link buildProjectMemberOptions}の挙動を変える指定。 */
export interface ProjectMemberOptionSettings {
  /**
   * ACTIVE以外（ロック中・無効）の参加者も候補に含めるか。既定はfalse。
   * Backendが停止中アカウントを担当者に指定できない機能（日別予定・日別実績・繰り返しTask・Taskテンプレート）では
   * falseにし、送信後に400となる候補を出さない。Board Taskの担当者のように停止中でも保存できる機能だけtrueにする。
   */
  readonly includeInactive?: boolean;
}

/**
 * 参加者がBackendで担当者に指定できる状態（ACTIVE）か判定する。
 *
 * @param member Project参加者
 * @returns ACTIVEならtrue
 */
export const isActiveProjectMember = (member: Readonly<ProjectMember>): boolean =>
  member.accountStatus === "ACTIVE";

/**
 * 参加者を選択肢・一覧へ出す表示文字列にする。例: `山田 太郎（MEMBER）`、停止中なら `佐藤 花子（MEMBER・無効）`。
 * 同じ名前の参加者がいても区別できるよう、一覧側ではアカウントIDも併記する。
 *
 * @param member Project参加者
 * @returns 表示名とProject role（ACTIVE以外は状態も）を含む文字列
 */
export const formatProjectMemberLabel = (member: Readonly<ProjectMember>): string =>
  isActiveProjectMember(member)
    ? `${member.displayName}（${member.projectRole}）`
    : `${member.displayName}（${member.projectRole}・${getAccountStatusLabel(member.accountStatus)}）`;

/**
 * 参加者を担当者selectの選択肢へ変換する。並びはBackendの返却順（アカウントID順）を保つ。
 *
 * @param members Project参加者
 * @param settings 停止中の参加者を含めるか
 * @returns 選択肢。対象がいなければ空配列
 */
export const buildProjectMemberOptions = (
  members: readonly ProjectMember[],
  settings: ProjectMemberOptionSettings = {}
): ProjectMemberOption[] =>
  members
    .filter((member) => settings.includeInactive === true || isActiveProjectMember(member))
    .map((member) => ({ title: formatProjectMemberLabel(member), value: member.accountId }));

/**
 * アカウントIDから参加者の表示名を引く。Projectから外れたアカウント（過去の担当者など）はIDで示す。
 *
 * @param members Project参加者
 * @param accountId 表示したいアカウントID
 * @returns 参加者の表示名。見つからなければ `ID: {accountId}`
 */
export const resolveProjectMemberDisplayName = (
  members: readonly ProjectMember[],
  accountId: number
): string =>
  members.find((member) => member.accountId === accountId)?.displayName ?? `ID: ${accountId}`;
