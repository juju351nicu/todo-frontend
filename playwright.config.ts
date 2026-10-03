import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8081";
const dashboardAuthStatePath = resolve(
  "playwright/.auth/dashboard-browser.json"
);
const myTasksAuthStatePath = resolve("playwright/.auth/my-tasks-browser.json");

/**
 * Stage 10DのブラウザE2E設定。
 * 認証setupはSession Cookieを扱うためtrace対象から外し、認証状態はGit管理外の一時fileだけへ保存する。
 */
export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  reporter: [["line"]],
  globalSetup: "./test/e2e/support/globalSetup.ts",
  globalTeardown: "./test/e2e/support/globalTeardown.ts",
  webServer: {
    // production buildを使い、Vite開発時の遅延dependency最適化によるbrowser reloadをE2Eへ混在させない。
    command: "npm run build && npm run preview:e2e",
    url: baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: baseUrl,
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    video: "off",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        trace: "off",
        screenshot: "off",
      },
    },
    {
      name: "chromium-public-smoke",
      testMatch: /public-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
    {
      name: "chromium-authenticated-smoke",
      testMatch: /authenticated-smoke\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: dashboardAuthStatePath,
        // traceにはCookieやHeaderが入る可能性があるため、認証済みtestは安全な診断要約とscreenshotを使う。
        trace: "off",
        screenshot: "only-on-failure",
      },
    },
    {
      name: "chromium-my-tasks-journey",
      testMatch: /my-tasks-journey\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: myTasksAuthStatePath,
        // 認証済みjourneyはSession Cookieをtraceへ残さず、安全な診断要約だけをartifact化する。
        trace: "off",
        screenshot: "only-on-failure",
      },
    },
  ],
});
