import type { AgentWorkRecord, AgentWorkSession } from "@/features/agent-work/types/agentWork";

/** Backendで確定した状態・応答待ちを表示名へ変換する。 */
export const getAgentWorkStatusLabel = (session: AgentWorkSession): string => {
  if (session.statusCode === "RUNNING") return session.stale ? "応答待ち" : "実行中";
  return session.statusCode === "FINISHED" ? "終了" : "中断";
};

/** 応答待ちは注意、正常終了は成功、中断は中立色とする。 */
export const getAgentWorkStatusColor = (
  session: AgentWorkSession
): "warning" | "info" | "success" | "neutral" => {
  if (session.statusCode === "RUNNING") return session.stale ? "warning" : "info";
  return session.statusCode === "FINISHED" ? "success" : "neutral";
};

/** 成果の安定codeを利用者向けの日本語へ変換する。 */
export const getAgentWorkRecordKindLabel = (kind: AgentWorkRecord["kind"]): string =>
  ({ CHECKPOINT: "区切り", BUG_FIX: "不具合修正", VERIFICATION: "検証", NOTE: "メモ" })[kind];
