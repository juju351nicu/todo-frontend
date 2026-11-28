import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentWorkApiError,
  getAgentWorkRecords,
  getAgentWorkSessions,
} from "@/features/agent-work/api/agentWorkApi";

const mocks = vi.hoisted(() => ({ getRequest: vi.fn() }));
vi.mock("@/shared/api/httpClient", () => ({ default: { getRequest: mocks.getRequest } }));

describe("AI作業APIの読取契約", () => {
  beforeEach(() => vi.clearAllMocks());
  it("状態・件数・offsetを本人一覧へ送り欠落配列を空へ正規化する", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(JSON.stringify({ totalElements: 0 }), { status: 200 })
    );
    const page = await getAgentWorkSessions("RUNNING", 20, 40);
    expect(mocks.getRequest).toHaveBeenCalledWith(
      "/api/v1/agent-sessions?limit=20&offset=40&statusCode=RUNNING"
    );
    expect(page.sessions).toEqual([]);
  });
  it("全状態では状態queryを送らない", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(JSON.stringify({ sessions: [], totalElements: 0 }), { status: 200 })
    );
    await getAgentWorkSessions(undefined, 20, 0);
    expect(mocks.getRequest).toHaveBeenCalledWith("/api/v1/agent-sessions?limit=20&offset=0");
  });
  it("成果は選択したProject・Task・作業UUIDへページ指定して取得する", async () => {
    mocks.getRequest.mockResolvedValue(
      new Response(JSON.stringify({ totalElements: 0 }), { status: 200 })
    );
    const page = await getAgentWorkRecords(
      { projectId: 3, taskId: 42, sessionId: "work/id" },
      20,
      20
    );
    expect(mocks.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/3/tasks/42/agent-sessions/work%2Fid/records?limit=20&offset=20"
    );
    expect(page.records).toEqual([]);
  });
  it.each([401, 403, 404, 500])("本文なし%sを型付きエラーへ変換する", async (status) => {
    mocks.getRequest.mockResolvedValue(new Response(null, { status }));
    await expect(getAgentWorkSessions(undefined, 20, 0)).rejects.toEqual(
      expect.objectContaining({ status, errorResponse: null })
    );
    mocks.getRequest.mockResolvedValue(new Response("not-json", { status }));
    await expect(getAgentWorkSessions(undefined, 20, 0)).rejects.toBeInstanceOf(AgentWorkApiError);
  });
});
