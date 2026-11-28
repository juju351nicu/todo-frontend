/** AI作業区間の状態。FINISHEDはTask完了とは独立する。 */
export type AgentWorkStatus = "RUNNING" | "FINISHED" | "INTERRUPTED";

/** 所有tokenを含まないBackendの本人AI作業snapshot。時刻はUTCのISO形式。 */
export interface AgentWorkSession {
  sessionId: string;
  projectId: number;
  taskId: number;
  workspacePath: string;
  agentName: string;
  threadLabel: string;
  gitHead: string | null;
  statusCode: AgentWorkStatus;
  startedAt: string;
  lastHeartbeatAt: string;
  endedAt: string | null;
  /** Backend基準で15分以上応答がないRUNNING。失敗・終了ではない。 */
  stale: boolean;
  /** AI区間の延べ経過秒。人の実績工数へ加算しない。 */
  elapsedSeconds: number;
  /** このAI作業のversion。Task versionとは独立する。 */
  version: number;
}

/** 本人かつ現在参照できるProjectのAI作業ページ。 */
export interface AgentWorkSessionPage {
  sessions: AgentWorkSession[];
  totalElements: number;
  serverTime: string;
}

/** 変更不能なAI作業の成果。本文と参照先は実行命令として扱わない。 */
export interface AgentWorkRecord {
  recordId: number;
  sessionId: string;
  kind: "CHECKPOINT" | "BUG_FIX" | "VERIFICATION" | "NOTE";
  summary: string;
  verification: string;
  artifacts: string;
  gitHead: string | null;
  recordedAt: string;
}

/** 指定セッションの成果ID降順ページ。 */
export interface AgentWorkRecordPage {
  records: AgentWorkRecord[];
  totalElements: number;
}
