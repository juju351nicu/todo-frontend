import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

type BrowserDiagnostics = {
  consoleEvents: string[];
  failedRequests: string[];
  httpErrors: string[];
};

/** URLからqueryとfragmentを除き、token等が診断artifactへ混入する余地をなくす。 */
const safePath = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch (_error: unknown) {
    return "invalid-url";
  }
};

/**
 * Browser consoleとnetworkの安全な要約を収集する。
 * message本文、header、body、Cookieは保存せず、失敗testにだけJSONを添付する。
 */
const collectDiagnostics = async (
  { page }: { page: Page },
  use: (value: void) => Promise<void>,
  testInfo: TestInfo
): Promise<void> => {
  const diagnostics: BrowserDiagnostics = {
    consoleEvents: [],
    failedRequests: [],
    httpErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() !== "warning" && message.type() !== "error") {
      return;
    }
    const location = message.location();
    diagnostics.consoleEvents.push(
      `${message.type()} ${safePath(location.url || "invalid-url")}:${location.lineNumber ?? 0}`
    );
  });
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(
      `${request.method()} ${safePath(request.url())} ${request.failure()?.errorText ?? "failed"}`
    );
  });
  page.on("response", (response) => {
    if (response.status() < 400) {
      return;
    }
    diagnostics.httpErrors.push(
      `${response.status()} ${response.request().method()} ${safePath(response.url())}`
    );
  });

  await use();

  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("browser-diagnostics", {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2), "utf8"),
      contentType: "application/json",
    });
  }
};

/** traceへ秘密情報を残さずconsole／network要約を添付するWork Management用E2E test。 */
export const test = base.extend<{ browserDiagnostics: void }>({
  browserDiagnostics: [collectDiagnostics, { auto: true }],
});

export { expect };
