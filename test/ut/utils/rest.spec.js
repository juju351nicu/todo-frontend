import { beforeEach, describe, expect, it, vi } from "vitest";

import Fetcher from "@/utils/rest.js";

describe("REST client", () => {
  beforeEach(() => {
    Fetcher.clearCsrfToken();
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETでもJSESSIONIDを送受信できるようcredentialsを指定する", async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });

    await Fetcher.getRequest("/api/v1/session");

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8030/api/v1/session");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("X-AUTH-TOKEN")).toBeNull();
  });

  it("POST前にCSRF Cookieを取得してX-XSRF-TOKENヘッダーへ設定する", async () => {
    fetch
      .mockImplementationOnce(async () => {
        document.cookie = "XSRF-TOKEN=csrf-test-token";
        return { ok: true, status: 200 };
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await Fetcher.postRequest("/api/v1/todo/upsertConfirm", { title: "test" });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8030/api/v1/csrf");
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe("http://localhost:8030/api/v1/todo/upsertConfirm");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("X-XSRF-TOKEN")).toBe("csrf-test-token");
    expect(options.headers.get("X-AUTH-TOKEN")).toBeNull();
    expect(options.body).toBe(JSON.stringify({ title: "test" }));
  });
});
