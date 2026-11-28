import { describe, expect, it } from "vitest";
import {
  getAgentWorkRecordKindLabel,
  getAgentWorkStatusColor,
  getAgentWorkStatusLabel,
} from "@/features/agent-work/utils/agentWork";

describe("AI作業の状態表示", () => {
  it.each([
    ["CHECKPOINT", "区切り"],
    ["BUG_FIX", "不具合修正"],
    ["VERIFICATION", "検証"],
    ["NOTE", "メモ"],
  ])("成果種別%sを%sと表示する", (kind, label) => {
    expect(getAgentWorkRecordKindLabel(kind)).toBe(label);
  });
  it.each([
    ["RUNNING", false, "実行中", "info"],
    ["RUNNING", true, "応答待ち", "warning"],
    ["FINISHED", false, "終了", "success"],
    ["FINISHED", true, "終了", "success"],
    ["INTERRUPTED", false, "中断", "neutral"],
  ])("%s・応答待ち%sを表示名と意味色へ変換する", (statusCode, stale, label, color) => {
    expect(getAgentWorkStatusLabel({ statusCode, stale })).toBe(label);
    expect(getAgentWorkStatusColor({ statusCode, stale })).toBe(color);
  });
});
