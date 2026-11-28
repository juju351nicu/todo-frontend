// @vitest-environment happy-dom
import { effectScope, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentWorkApiError } from "@/features/agent-work/api/agentWorkApi";
import { useAgentWorkPage } from "@/features/agent-work/composables/useAgentWorkPage";

const mocks = vi.hoisted(() => ({
  getSessions: vi.fn(),
  getRecords: vi.fn(),
  expireSession: vi.fn(),
  mounted: [],
  userStore: null,
}));
vi.mock("vue", async () => ({
  ...(await vi.importActual("vue")),
  onMounted: (callback) => mocks.mounted.push(callback),
}));
vi.mock("@/features/auth/stores/user", () => ({ useUserStore: () => mocks.userStore }));
vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));
vi.mock("@/features/agent-work/api/agentWorkApi", async () => ({
  ...(await vi.importActual("@/features/agent-work/api/agentWorkApi")),
  getAgentWorkSessions: mocks.getSessions,
  getAgentWorkRecords: mocks.getRecords,
}));

const firstSession = {
  sessionId: "first",
  projectId: 1,
  taskId: 10,
  threadLabel: "Optimus",
  statusCode: "RUNNING",
};
const secondSession = { ...firstSession, sessionId: "second", taskId: 11, threadLabel: "DINOS" };
const list = { sessions: [firstSession], totalElements: 21, serverTime: "2026-11-28T14:00:00Z" };
const recordPage = { records: [{ recordId: 1, summary: "確認済み" }], totalElements: 21 };
const pending = () => {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
};
let scope;
const createPage = () => {
  scope = effectScope();
  return scope.run(useAgentWorkPage);
};

describe("AI作業一覧の取得・所有範囲・遅延応答", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mounted = [];
    mocks.userStore = reactive({
      accountId: 1,
      readable: true,
      hasPermission() {
        return this.readable;
      },
    });
    mocks.getSessions.mockResolvedValue(list);
    mocks.getRecords.mockResolvedValue(recordPage);
    mocks.expireSession.mockImplementation(async (cleanup) => cleanup?.());
  });
  afterEach(() => scope?.stop());

  it("初期表示は実行中の先頭ページを一度取得する", async () => {
    const page = createPage();
    mocks.mounted.forEach((callback) => callback());
    await page.loadSessions();
    await nextTick();
    expect(mocks.getSessions).toHaveBeenCalledTimes(1);
    expect(mocks.getSessions).toHaveBeenCalledWith("RUNNING", 20, 0);
    expect(page.page.value).toEqual(list);
  });
  it("同じ検索の二重Requestを送らない", async () => {
    const response = pending();
    mocks.getSessions.mockReturnValue(response.promise);
    const page = createPage();
    const first = page.loadSessions();
    await page.loadSessions();
    expect(mocks.getSessions).toHaveBeenCalledTimes(1);
    response.resolve(list);
    await first;
  });
  it("権限なしと不正offsetではAPIを呼ばない", async () => {
    mocks.userStore.readable = false;
    const page = createPage();
    await page.loadSessions();
    await page.loadRecords(firstSession);
    expect(mocks.getSessions).not.toHaveBeenCalled();
    expect(mocks.getRecords).not.toHaveBeenCalled();
    mocks.userStore.readable = true;
    await nextTick();
    mocks.getSessions.mockClear();
    await page.loadSessions(-1);
    await page.loadSessions(100001);
    expect(mocks.getSessions).not.toHaveBeenCalled();
  });
  it("状態変更では旧表示を破棄し古い検索応答で復元しない", async () => {
    const old = pending();
    mocks.getSessions
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ sessions: [], totalElements: 0 });
    const page = createPage();
    const first = page.loadSessions();
    page.statusFilter.value = "ALL";
    await nextTick();
    await nextTick();
    expect(mocks.getSessions).toHaveBeenLastCalledWith(undefined, 20, 0);
    old.resolve(list);
    await first;
    expect(page.page.value.sessions).toEqual([]);
  });
  it("最終ページを越える次ページと先頭より前へのRequestを送らない", async () => {
    const page = createPage();
    await page.loadSessions();
    page.previousPage();
    expect(mocks.getSessions).toHaveBeenCalledTimes(1);
    page.nextPage();
    await nextTick();
    expect(mocks.getSessions).toHaveBeenLastCalledWith("RUNNING", 20, 20);
    expect(page.canNext.value).toBe(false);
    page.nextPage();
    expect(mocks.getSessions).toHaveBeenCalledTimes(2);
  });
  it("別作業の成果を開くと先行作業の遅延成功を破棄する", async () => {
    const old = pending();
    mocks.getRecords
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ records: [{ recordId: 2 }], totalElements: 1 });
    const page = createPage();
    const first = page.loadRecords(firstSession);
    await page.loadRecords(secondSession);
    old.resolve(recordPage);
    await first;
    expect(page.selectedSession.value.sessionId).toBe("second");
    expect(page.records.value.records).toEqual([{ recordId: 2 }]);
  });
  it("成果Dialogを閉じると遅延成功で再表示しない", async () => {
    const response = pending();
    mocks.getRecords.mockReturnValue(response.promise);
    const page = createPage();
    const loading = page.loadRecords(firstSession);
    page.isRecordsOpen.value = false;
    response.resolve(recordPage);
    await loading;
    expect(page.selectedSession.value).toBeNull();
    expect(page.records.value).toBeNull();
    expect(page.isRecordsLoading.value).toBe(false);
  });
  it("成果のページ端を保護し次の記録を選択中の作業から取得する", async () => {
    const page = createPage();
    await page.loadRecords(firstSession);
    page.previousRecords();
    expect(mocks.getRecords).toHaveBeenCalledTimes(1);
    page.nextRecords();
    await nextTick();
    expect(mocks.getRecords).toHaveBeenLastCalledWith(firstSession, 20, 20);
    expect(page.canNextRecords.value).toBe(false);
  });
  it("401では表示と並列応答を破棄して共通Session失効処理へ渡す", async () => {
    const delayed = pending();
    const page = createPage();
    await page.loadSessions();
    mocks.getSessions.mockReturnValue(delayed.promise);
    const listing = page.loadSessions();
    mocks.getRecords.mockRejectedValue(new AgentWorkApiError(401, null));
    await page.loadRecords(firstSession);
    delayed.resolve(list);
    await listing;
    expect(mocks.expireSession).toHaveBeenCalledTimes(1);
    expect(page.page.value).toBeNull();
    expect(page.records.value).toBeNull();
  });
  it.each([403, 404])("%sでは旧参照範囲を破棄しSession失効扱いにしない", async (status) => {
    const page = createPage();
    await page.loadSessions();
    mocks.getSessions.mockRejectedValue(new AgentWorkApiError(status, null));
    await page.loadSessions();
    expect(page.page.value).toBeNull();
    expect(page.errorMessages.value).toEqual(["AI作業の参照権限または対象を確認してください。"]);
    expect(mocks.expireSession).not.toHaveBeenCalled();
  });
  it("通信失敗は直前の同じ検索の表示を保ち内部エラー本文を出さない", async () => {
    const page = createPage();
    await page.loadSessions();
    mocks.getSessions.mockRejectedValue(new Error("private backend details"));
    await page.loadSessions();
    expect(page.page.value).toEqual(list);
    expect(page.errorMessages.value.join()).not.toContain("private backend details");
  });
  it("account変更では先行accountの応答を破棄する", async () => {
    const old = pending();
    mocks.getSessions
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ sessions: [], totalElements: 0 });
    const page = createPage();
    const first = page.loadSessions();
    mocks.userStore.accountId = 2;
    await nextTick();
    await nextTick();
    old.resolve(list);
    await first;
    expect(page.page.value.sessions).toEqual([]);
  });
  it("画面破棄後の遅延成功は表示を復元しない", async () => {
    const response = pending();
    mocks.getSessions.mockReturnValue(response.promise);
    const page = createPage();
    const loading = page.loadSessions();
    scope.stop();
    response.resolve(list);
    await loading;
    expect(page.page.value).toBeNull();
  });
});
