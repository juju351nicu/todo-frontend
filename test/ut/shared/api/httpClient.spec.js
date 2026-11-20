import { beforeEach, describe, expect, it, vi } from "vitest";

import Fetcher from "@/shared/api/httpClient";

const csrfResponse = (token = "masked-response-token") => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({ headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token }),
});

const deferred = () => {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

describe("REST client", () => {
  beforeEach(() => {
    Fetcher.clearCsrfToken();
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=untrusted-cookie" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETはSession Cookieを送りCSRF取得を行わない", async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    await Fetcher.getRequest("/api/v1/session");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8030/api/v1/session");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("X-AUTH-TOKEN")).toBeNull();
    expect(options.headers.get("X-XSRF-TOKEN")).toBeNull();
  });

  it("binary GETのAcceptとSession Cookieを維持する", async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    await Fetcher.getRequest(
      "/api/v1/projects/7/wbs/exports/weekly?statusDate=2026-09-05",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const [, options] = fetch.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Accept")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("Cookieを読まずResponse tokenをPOSTのHeaderへ送り本文を維持する", async () => {
    const cookieReader = vi.fn(() => {
      throw new Error("Cookie must not be read");
    });
    Object.defineProperty(document, "cookie", { get: cookieReader });
    fetch.mockResolvedValueOnce(csrfResponse()).mockResolvedValueOnce({ ok: true, status: 204 });
    await Fetcher.postRequest("/api/v1/task-list/upsert", { title: "test" });
    expect(cookieReader).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8030/api/v1/csrf");
    expect(fetch.mock.calls[0][1].credentials).toBe("include");
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe("http://localhost:8030/api/v1/task-list/upsert");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("X-XSRF-TOKEN")).toBe("masked-response-token");
    expect(options.body).toBe(JSON.stringify({ title: "test" }));
  });

  it("PUTとDELETEは同じメモリー上のtokenを使用する", async () => {
    fetch.mockResolvedValueOnce(csrfResponse()).mockResolvedValue({ ok: true, status: 204 });
    await Fetcher.putRequest("/api/v1/administration/accounts/2/roles", {
      roleCodes: ["USER"],
      version: 3,
    });
    await Fetcher.deleteRequest("/api/v1/task-list/5");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][1].method).toBe("PUT");
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ roleCodes: ["USER"], version: 3 }));
    expect(fetch.mock.calls[2][1].method).toBe("DELETE");
    expect(fetch.mock.calls[2][1].body).toBeUndefined();
    for (const [, options] of fetch.mock.calls.slice(1)) {
      expect(options.headers.get("X-XSRF-TOKEN")).toBe("masked-response-token");
      expect(options.credentials).toBe("include");
    }
  });

  it("同時の初回更新はCSRF取得を共有して両方のHeaderへ同じtokenを送る", async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true, status: 204 });
    const first = Fetcher.postRequest("/first", null);
    const second = Fetcher.postRequest("/second", null);
    expect(fetch).toHaveBeenCalledOnce();
    pending.resolve(csrfResponse());
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      fetch.mock.calls.slice(1).map(([, options]) => options.headers.get("X-XSRF-TOKEN"))
    ).toEqual(["masked-response-token", "masked-response-token"]);
  });

  it("破棄前の取得が完了しても更新を送らず、新しい取得結果を保持する", async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const stale = Fetcher.postRequest("/must-not-run", null);
    const rejected = expect(stale).rejects.toThrow("CSRF");
    Fetcher.clearCsrfToken();
    fetch.mockResolvedValueOnce(csrfResponse("current-token"));
    await Fetcher.refreshCsrfToken();
    pending.resolve(csrfResponse("stale-token"));
    await rejected;
    fetch.mockResolvedValueOnce({ ok: true, status: 204 });
    await Fetcher.postRequest("/current", null);
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(
      "http://localhost:8030/must-not-run"
    );
    expect(fetch.mock.calls.at(-1)[1].headers.get("X-XSRF-TOKEN")).toBe("current-token");
  });

  it("明示再取得が失敗したら古いtokenとCookieへ戻らず次回も取得する", async () => {
    fetch.mockResolvedValueOnce(csrfResponse("old-token"));
    await Fetcher.refreshCsrfToken();
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(Fetcher.refreshCsrfToken()).rejects.toThrow("503");
    fetch
      .mockResolvedValueOnce(csrfResponse("fresh-token"))
      .mockResolvedValueOnce({ ok: true, status: 204 });
    await Fetcher.postRequest("/current", null);
    expect(fetch.mock.calls.at(-1)[1].headers.get("X-XSRF-TOKEN")).toBe("fresh-token");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/csrf"))).toHaveLength(3);
  });

  it("cache済みtokenでも送信待ちの間に認証状態を破棄したら更新を送らない", async () => {
    fetch.mockResolvedValueOnce(csrfResponse("cached-token"));
    await Fetcher.refreshCsrfToken();
    const stale = Fetcher.postRequest("/must-not-run", null);
    const rejected = expect(stale).rejects.toThrow("CSRF");
    Fetcher.clearCsrfToken();
    await rejected;
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    [],
    { headerName: "Other", parameterName: "_csrf", token: "masked" },
    { headerName: "X-XSRF-TOKEN", parameterName: "wrong", token: "masked" },
    { headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "" },
    { headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "   " },
    { headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: 123 },
  ])("不正なCSRF Response %j は更新を送らない", async (body) => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) });
    await expect(Fetcher.postRequest("/must-not-run", null)).rejects.toThrow("CSRF");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("CSRF Responseが非JSONなら更新を送らない", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
    });
    await expect(Fetcher.postRequest("/must-not-run", null)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
