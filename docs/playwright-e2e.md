# Playwright E2E実行手順

更新日: 2026-10-04

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

Stage 10D-2の主要journeyは次を確認する。

- My Tasksの期限3グループと専用Task
- My Tasksから同じTask IDのBoard詳細へのdeep link
- Boardでのタイトル・詳細更新と再読込後の保持
- 同じTask IDを指定したWBS日別実績Dialogへの遷移
- 更新後タイトル、詳細、WBS code、状態、versionのMySQL inspect
- BoardでのTask作成とkeyboardによるTodoから進行中への列移動
- 移動後の再読込と、2 tabから同じversionを更新した場合の409競合回復
- 先行tabの更新内容、状態、位置、versionのMySQL inspect
- Source ProjectのProject Template captureとsnapshot構造の表示
- member slot mappingを指定した別Projectへの適用と生成Board表示
- Template／生成Projectの構造、日付offset、担当、状態、親子、WBS code、進捗初期値、lineageのMySQL inspect
- 管理者によるロール変更、対象者の既存Session失効、再ログイン後の参照専用permission
- 取消・付与の監査ログ、account version、role集合、Session件数のMySQL inspect
- 本人による勤怠月次提出、確認者による理由必須の差戻し、本人再提出、コメント付き承認、締め担当による締め
- 確認者の締め操作非表示、CLOSED・version 5、勤務／休憩集計、監査順とactorのMySQL inspect

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

Stage 10D-2の主要journeyだけ、またはChromium対象をまとめて実行する場合は次を使用する。

```bash
npm run test:e2e:journeys
npm run test:e2e:chromium
```

`dashboard-browser`、`my-tasks-browser`、`board-browser`、`project-template-owner`、`recurrence-owner`、
`authorization-admin-browser`、`authorization-target-browser`、`attendance-month-browser`、
`attendance-month-reviewer`、`attendance-month-closer`／`password`は
ローカル回帰専用credentialであり、通常accountや本番credentialを使用しない。E2E開始時に
`scripts/browser-regression/dashboard`、`my-tasks`、`board`、`project-template`、`task-recurrence`、`authorization`、`attendance-month`の
`prepare.sql`を実行し、終了時は
成功・失敗にかかわらず各`cleanup.sql`を実行する。途中でprocessを強制終了してcleanupできなかった場合は、
Backend repositoryで次を実行する。

```bash
docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/dashboard/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/my-tasks/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/board/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/project-template/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/task-recurrence/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/authorization/cleanup.sql

docker exec -i -e MYSQL_PWD=work_management_password work-management-mysql \
  mysql --default-character-set=utf8mb4 -u work_management_app todo \
  < scripts/browser-regression/attendance-month/cleanup.sql
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
| `E2E_MY_TASKS_LOGIN_ID` | `my-tasks-browser` | My Tasks主要journey専用ログインID |
| `E2E_BOARD_LOGIN_ID` | `board-browser` | Board主要journey専用ログインID |
| `E2E_PROJECT_TEMPLATE_LOGIN_ID` | `project-template-owner` | Project Template主要journey専用ログインID |
| `E2E_PROJECT_TEMPLATE_MEMBER_ACCOUNT_ID` | 未設定 | 外部fixture利用時のMEMBER slot用account ID |
| `E2E_TASK_RECURRENCE_LOGIN_ID` | `recurrence-owner` | 繰り返しTask主要journey専用ログインID |
| `E2E_AUTHORIZATION_ADMIN_LOGIN_ID` | `authorization-admin-browser` | 権限変更journeyの管理者ログインID |
| `E2E_AUTHORIZATION_TARGET_LOGIN_ID` | `authorization-target-browser` | 権限変更journeyの変更対象者ログインID |
| `E2E_ATTENDANCE_MONTH_EMPLOYEE_LOGIN_ID` | `attendance-month-browser` | 勤怠月次journeyの本人ログインID |
| `E2E_ATTENDANCE_MONTH_REVIEWER_LOGIN_ID` | `attendance-month-reviewer` | 勤怠月次journeyの確認者ログインID |
| `E2E_ATTENDANCE_MONTH_CLOSER_LOGIN_ID` | `attendance-month-closer` | 勤怠月次journeyの締め担当ログインID |
| `E2E_PASSWORD` | `password` | 専用account password |
| `E2E_SKIP_DATABASE_FIXTURE` | 未設定 | 外部環境がfixtureを準備済みの場合だけ`true` |

`localhost`と`127.0.0.1`を混在させない。Spring Session CookieとBackend CORSは`http://localhost:8081`を前提とする。

## 証跡と機密情報

認証状態は`playwright/.auth`配下のaccount別fileへ一時保存し、directory全体を`.gitignore`対象にする。test終了時に
全fileを削除し、GitHub Actions artifactへ含めない。これらのfileにはSession Cookieが含まれるため、内容を表示、
共有、commitしない。

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
smokeと主要journeyを1 worker・retryなしで実行する。Frontend CIは型検査、Vitest、production buildを従来どおり担当する。
失敗時だけ安全なtrace、screenshot、診断JSONを7日間保存する。
認証状態file、Backend log、HTML reportはartifactへ含めない。

不安定なtestをretryで隠さない。失敗時はtrace、screenshot、診断JSONとCI内のBackend起動logを照合し、原因を修正してから
回帰testを残す。

## 次の自動化単位

Stage 10D-2のMy Tasks→Board更新→再読込→WBS反映、Board上のTask作成→列移動→再読込→2 tab競合回復、
Project Templateのcapture→snapshot確認→別Project適用→Board・DB lineage照合、繰り返し規則の停止→再読込→再開と
FAILED生成retry、permission変更による既存Session失効と再ログイン後の参照専用表示、勤怠月次の
提出→差戻し→再提出→承認→締めは自動化済みである。勤怠単独は認証setupを含む11件、既存journeyを含む
Chromium全19件が1 worker・retryなしで成功した。global teardownは通知を含む専用SessionとDB fixtureを削除する。
Stage 10D-2は完了し、次はStage 10D-3でFirefox／WebKitの定期回帰、時間制探索、限定property-based／Fuzz testを扱う。
操作ごとに専用fixtureを分け、固定採番IDに依存せず、必要なDB整合だけをinspect SQLで確認する。
