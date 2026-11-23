import type { EstimateAssistanceMode } from "@/features/wbs/types/wbs";

/** 本人が申告した公開実行設定。環境から自動検証された値ではない。 */
export interface ExecutionSettings {
  /** 実際のAI支援mode。 */
  assistanceMode: EstimateAssistanceMode;
  /** 公開client名。未記録はnull。 */
  agentName: string | null;
  /** 公開model識別子。未記録はnull。 */
  modelIdentifier: string | null;
  /** 推論強度の申告。未記録はnull。 */
  reasoningEffort: string | null;
  /** service tierの申告。未記録はnull。 */
  serviceTier: string | null;
}
/** 停止した本人Sessionへ設定を記録するAPI入力。 */
export interface ExecutionSettingRequest extends ExecutionSettings {
  /** 本人の停止済みTimer ID。 */
  timerSessionId: number;
  /** 同一Task・本人・Timer期間内の計測ID。未関連はnull。 */
  progressMeasurementId: number | null;
}
/** 受理済みの設定snapshot。 */
export interface ExecutionSettingResponse extends ExecutionSettingRequest {
  /** Backendが確定した受理時刻UTC。 */
  recordedAt: string;
}
/** 同じ設定・schemaだけをまとめたTimer配賦。 */
export interface ExecutionGroup {
  /** 設定を記録していないSessionはnull。 */
  settings: ExecutionSettings | null;
  /** 関連する進捗schema。未関連はnull。 */
  schemaId: string | null;
  /** 日跨ぎを重複除去したSession数。 */
  sessionCount: number;
  /** 業務日数。 */
  activeDays: number;
  /** 元配賦の秒数合計。 */
  elapsedSeconds: number;
  /** 元配賦の分数合計。秒数から再丸めしない。 */
  creditedMinutes: number;
  /** 関連計測件数。 */
  measurementCount: number;
  /** 同一schema内の適用進捗差合計pt。計測なしはnull、負の補正を保持する。 */
  progressDeltaPoints: number | null;
}
/** 現行実績とTimer配賦を別に示す本人の業務日。 */
export interface ExecutionDay {
  workDate: string;
  actualEffortMinutes: number;
  timerCreditedMinutes: number;
  /** 手入力・後編集の差。負もそのまま表示する。 */
  adjustmentMinutes: number;
  groups: ExecutionGroup[];
}
/** 設定を記録できる本人の停止Session。 */
export interface ExecutionSession {
  timerSessionId: number;
  startedAt: string;
  stoppedAt: string;
  settings: ExecutionSettings | null;
  progressMeasurementId: number | null;
}
/** 書き換えない元の進捗計測の投影。 */
export interface ExecutionMeasurement {
  measurementId: number;
  businessDate: string;
  schemaId: string;
  progressPercent: number;
  progressDeltaPoints: number;
  evidenceSha256: string;
  recordedAt: string;
  /** 設定未関連の場合はnull。 */
  timerSessionId: number | null;
}
/** 同一Task・期間・認証本人に限定した日次比較のAPI Response。 */
export interface ExecutionComparison {
  projectId: number;
  taskId: number;
  workerAccountId: number;
  dateFrom: string;
  dateTo: string;
  groups: ExecutionGroup[];
  days: ExecutionDay[];
  sessions: ExecutionSession[];
  measurements: ExecutionMeasurement[];
}
/** 記録前の入力下書き。未選択は専用値で持ち、API送信時に検証する。 */
export interface ExecutionSettingForm {
  timerSessionId: number;
  progressMeasurementId: number;
  assistanceMode: EstimateAssistanceMode | "UNSELECTED";
  agentName: string;
  modelIdentifier: string;
  reasoningEffort: string;
  serviceTier: string;
}
