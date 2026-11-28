import type {
  AgentWorkRecordPage,
  AgentWorkSession,
  AgentWorkSessionPage,
  AgentWorkStatus,
} from "@/features/agent-work/types/agentWork";
import HttpClient from "@/shared/api/httpClient";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** AI作業参照APIのstatusと安全に解析したエラー本文。 */
export class AgentWorkApiError extends ApiError {
  constructor(status: number, response: ErrorResponse | null) {
    super("AgentWorkApiError", "AI作業API", status, response);
  }
}

/** HTTP失敗をfeature例外へ変換する。成功本文は消費しない。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, body) => new AgentWorkApiError(status, body));

/**
 * 本人の参照可能な作業ページを取得する。所有token・更新権限を取得するAPIではない。
 * @param status 状態filter。undefinedは全状態
 * @param limit ページ件数。1〜100
 * @param offset 読み飛ばす件数。0〜100000
 * @returns 開始時刻・UUID降順の作業とBackend基準時刻
 * @throws AgentWorkApiError 認証・参照範囲・入力・通信先のHTTPエラー
 */
export const getAgentWorkSessions = async (
  status: AgentWorkStatus | undefined,
  limit: number,
  offset: number
): Promise<AgentWorkSessionPage> => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) query.set("statusCode", status);
  const response = await HttpClient.getRequest(`/api/v1/agent-sessions?${query}`);
  await ensureSuccess(response);
  const payload = (await response.json()) as AgentWorkSessionPage;
  return { ...payload, sessions: payload.sessions ?? [] };
};

/**
 * 本人作業の成果ページを取得する。本文やartifactsの参照先を自動実行・取得しない。
 * @param session 一覧で取得したProject・Task・作業UUID
 * @param limit ページ件数。1〜100
 * @param offset 読み飛ばす件数。0〜100000
 * @returns 成果ID降順の変更不能な記録
 * @throws AgentWorkApiError 未認証・権限不足・対象なし・入力不正
 */
export const getAgentWorkRecords = async (
  session: AgentWorkSession,
  limit: number,
  offset: number
): Promise<AgentWorkRecordPage> => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await HttpClient.getRequest(
    `/api/v1/projects/${session.projectId}/tasks/${session.taskId}/agent-sessions/${encodeURIComponent(session.sessionId)}/records?${query}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as AgentWorkRecordPage;
  return { ...payload, records: payload.records ?? [] };
};
