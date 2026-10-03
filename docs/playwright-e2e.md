# Playwright E2E実行手順

更新日: 2026-10-03

## 目的と範囲

Stage 10Dでは、実ブラウザからFrontend、Backend、MySQLまでの主要導線をPlaywrightで確認する。
入力境界、permission全組合せ、日付計算、SQL制約、rollbackは既存のJUnit、MockMvc、Testcontainers MySQL、Vitestを正本とし、
E2Eへ重複して大量実装しない。

Stage 10D-1のChromium smokeは次を確認する。

- 未認証のログイン画面
- 未認証利用者が保護画面からログインへ戻ること
- 専用accountによるログインと認証状態fixtureの作成
- Dashboard表示とブラウザ再読込後のSession維持
- 専用DB fixtureのprepare／cleanup
- 失敗時のscreenshot、未認証trace、機密値を除いたconsole／network要約

## 初回セットアップ

Node.js 24とRancher Desktopを起動し、Frontendで依存とChromiumを導入する。

```bash
cd /home/ken/workspace/todo/todo-frontend
npm ci
npm run test:e2e:install
```

Playwright MCPの導入有無は、repositoryのE2E実行条件ではない。MCPは対話的な画面調査に利用できるが、
CIと再現可能な回帰は`@playwright/test`と`playwright.config.ts`を正本とする。

## ローカル実行

Backend repositoryでMySQLを起動する。

```bash
cd /home/ken/workspace/todo/todo-backend
docker compose up -d mysql
```

同じrepositoryでBackendを起動する。繰り返しTask schedulerはsmoke対象外の非同期更新を避けるため停止する。

```bash
SPRING_PROFILES_ACTIVE=local,docker \
WORK_MANAGEMENT_TASK_RECURRENCE_SCHEDULER_ENABLED=false \
./mvnw spring-boot:run
```

別terminalでFrontendのsmokeを実行する。production buildとVite previewはPlaywrightが自動起動する。

```bash
cd /home/ken/workspace/todo/todo-frontend
npm run test:e2e:smoke
```

`dashboard-browser`／`password`はローカル回帰専用credentialであり、通常accountや本番credentialを使用しない。
E2E開始時に`scripts/browser-regression/dashboard/prepare.sql`を実行し、終了時は成功・失敗にかかわらず
`cleanup.sql`を実行する。途中でprocessを強制終了してcleanupできなかった場合は、Backend repositoryで次を実行する。

```bash
docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/dashboard/cleanup.sql
```

## 環境変数

| 変数 | 既定値 | 用途 |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:8081` | Frontend URL |
| `E2E_BACKEND_PATH` | `../todo-backend` | fixture SQLを持つBackend repository |
| `E2E_MYSQL_CONTAINER` | `work-management-mysql` | Docker MySQL container名 |
| `E2E_DB_NAME` | `todo` | E2E DB名 |
| `E2E_DB_USER` | `work_management_app` | ローカルE2E DB利用者 |
| `E2E_DB_PASSWORD` | `work_management_password` | ローカルE2E DB password |
| `E2E_LOGIN_ID` | `dashboard-browser` | 専用ログインID |
| `E2E_PASSWORD` | `password` | 専用account password |
| `E2E_SKIP_DATABASE_FIXTURE` | 未設定 | 外部環境がfixtureを準備済みの場合だけ`true` |

`localhost`と`127.0.0.1`を混在させない。Spring Session CookieとBackend CORSは`http://localhost:8081`を前提とする。

## 証跡と機密情報

認証状態は`playwright/.auth/dashboard-browser.json`へ一時保存し、`.gitignore`対象にする。test終了時に削除し、
GitHub Actions artifactへ含めない。このfileにはSession Cookieが含まれるため、内容を表示、共有、commitしない。

未認証smokeは失敗時だけtraceを残す。認証済みsmokeはCookieやHeaderの混入を避けるためtraceを無効にし、
screenshotと安全な診断要約を使用する。診断要約へ保存するのは次だけである。

- consoleのwarning／error種別と発生元path
- 失敗RequestのHTTP method、queryを除いたpath、browser error種別
- HTTP 4xx／5xxのstatus、method、queryを除いたpath

console本文、Request／Response body、header、Cookie、password、Session ID、OAuth tokenは保存しない。
認証済みtraceが必要になった場合は、SessionとCSRFを確実にredactできる処理を先に追加する。

## CI

Backend repositoryは非公開、Frontend repositoryは公開のため、追加のrepository tokenを作らずBackend CI側から
Frontend `master`をcheckoutする。Backend `verify`成功後にMySQL、Backend、production preview、Chromiumを起動して
smokeを1 worker・retryなしで実行する。Frontend CIは型検査、Vitest、production buildを従来どおり担当する。
失敗時だけ安全なtrace、screenshot、診断JSONを7日間保存する。
認証状態file、Backend log、HTML reportはartifactへ含めない。

不安定なtestをretryで隠さない。失敗時はtrace、screenshot、診断JSONとCI内のBackend起動logを照合し、原因を修正してから
回帰testを残す。

## 次の自動化単位

Stage 10D-2でMy Tasks、Board／WBS、Template、繰り返しTask、2 tab競合、permission、勤怠workflowを
Chromiumの主要journeyとして追加する。操作ごとに専用fixtureを分け、固定採番IDに依存せず、必要なDB整合だけを
inspect SQLで確認する。
