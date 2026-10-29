import { describe, expect, it } from "vitest";

import {
  buildProjectMemberOptions,
  formatProjectMemberLabel,
  isActiveProjectMember,
  resolveProjectMemberDisplayName,
} from "@/features/project/utils/projectMember";

/** ACTIVEなOWNER、無効化されたMEMBER、ロック中のMEMBER。 */
const members = [
  { accountId: 7, projectRole: "OWNER", displayName: "山田 太郎", accountStatus: "ACTIVE" },
  { accountId: 8, projectRole: "MEMBER", displayName: "佐藤 花子", accountStatus: "DISABLED" },
  { accountId: 9, projectRole: "MEMBER", displayName: "鈴木 一郎", accountStatus: "LOCKED" },
];

describe("projectMember", () => {
  it("ACTIVEな参加者だけを担当者に指定できる参加者と判定する", () => {
    expect(members.map(isActiveProjectMember)).toEqual([true, false, false]);
  });

  it("表示名とProject roleで表示し、ACTIVE以外は状態も添える", () => {
    expect(members.map(formatProjectMemberLabel)).toEqual([
      "山田 太郎（OWNER）",
      "佐藤 花子（MEMBER・無効）",
      "鈴木 一郎（MEMBER・ロック中）",
    ]);
  });

  it("既定ではACTIVEな参加者だけを選択肢にする（停止中を指定すると送信後に400となる機能向け）", () => {
    expect(buildProjectMemberOptions(members)).toEqual([{ title: "山田 太郎（OWNER）", value: 7 }]);
  });

  it("includeInactiveなら停止中の参加者も状態付きで選択肢に残す（既存の担当者を選択肢から消さないため）", () => {
    expect(
      buildProjectMemberOptions(members, { includeInactive: true }).map((option) => option.value)
    ).toEqual([7, 8, 9]);
  });

  it("アカウントIDから表示名を引き、参加者から外れたアカウントはIDで示す", () => {
    expect(resolveProjectMemberDisplayName(members, 8)).toBe("佐藤 花子");
    expect(resolveProjectMemberDisplayName(members, 99)).toBe("ID: 99");
  });
});
