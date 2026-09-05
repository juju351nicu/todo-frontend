# Work Management Frontend

Vue 3とViteで構成したフロントエンドです。

- [コーディング規約](docs/coding-guidelines.md)
- [Frontend構成ガイド](docs/frontend-architecture.md)
- [ブラウザ回帰チェックリスト](docs/browser-regression-checklist.md)

## 必要な環境

- Node.js 24
- npm（`package-lock.json`に従って`npm ci`を使用）

`.nvmrc`を利用する場合は、次のコマンドでNode.jsの版を合わせます。

```bash
nvm use
```

## セットアップと起動

```bash
npm ci
cp .env.example .env.local
npm run dev
```

開発サーバーは既定で`http://localhost:8081`を使用します。Backendの既定接続先は`http://localhost:8030`で、環境ごとに`.env.local`の`VITE_API_BASE_URL`で変更できます。`.env.example`には接続先だけを記載し、OAuth2 Client Secretやメールパスワード等の秘密情報はFrontendへ設定しません。

## 認証方式

BackendのSpring Security + Spring Session JDBCを使用します。JWTは使用せず、ブラウザが保持するHttpOnlyの`JSESSIONID` Cookieを認証根拠にします。

- 全APIリクエストで`credentials: "include"`を指定する。
- `GET /api/v1/session`でログイン中の利用者、ロール、権限をPiniaへ復元する。
- `POST`、`PUT`、`DELETE`では`XSRF-TOKEN` Cookieを`X-XSRF-TOKEN`ヘッダーへ設定する。
- ログイン・ログアウト直後は`GET /api/v1/csrf`でCSRFトークンを更新する。
- localStorageとsessionStorageへJWTやSession IDを保存しない。

BackendとFrontendはどちらも`localhost`で起動してください。`localhost`と`127.0.0.1`を混在させるとCookieの送信先が変わります。

## TypeScript

アプリケーションソースのTypeScript移行は完了しています。認証・会員・Todo・問い合わせAPIのRequest / Response型、共通HTTPクライアント、Pinia Store、起動処理、Router、定数、共通utility、すべてのVue Single File Componentを型検査します。

- `tsconfig.json`の`allowJs`は無効です。
- `npm run typecheck`で`src`配下の`.ts`とすべての`.vue`を型検査します。
- 新しいアプリケーションコードはTypeScriptで作成します。

## フロントエンド構成

Swagger / OpenAPIでBackendとのAPI契約を確認しながら、機能単位の構成へ移行しました。共通HTTP処理は`src/shared/api`、認証機能は`src/features/auth`、会員機能は`src/features/member`、Project設定・メンバー管理は`src/features/project`、Todo一覧・詳細・カレンダーとProject Boardは`src/features/task`、WBS階層表・編集・Task依存関係・実績期間・日別予定実績・workload・稼働日calendar・baseline・EVM・週次／月次Excel・参照専用Ganttは`src/features/wbs`、問い合わせ機能は`src/features/inquiry`に配置しています。

Router、Session認証ガード、共通ヘッダー・メニューは`src/app`、汎用アラート・処理中表示は`src/shared/components`、API・画面定数は`src/shared/constants`、副作用のない共通変換は`src/shared/utils`に配置しています。各画面はルート単位で遅延読み込みし、初期表示に不要な会員・Todo・FullCalendarのコードを別チャンクに分割します。

画面の状態と操作は最初から細かく分けず、`useLoginPage`のように1画面につき1つのcomposableへまとめます。複数の独立した責務が明確になった場合だけ追加分割します。詳しくは[Frontend構成ガイド](docs/frontend-architecture.md)を参照してください。JSDocと補足コメントの基準は[コーディング規約](docs/coding-guidelines.md)へ記載しています。

Project Boardの設定Dialogでは、Project名・説明・archiveと、member追加・role変更・除外を扱います。Frontendのpermission・Project role判定は操作可否の案内であり、最終認可、最後のOWNER保護、楽観ロックはBackendが行います。409競合では最新Projectを再取得し、自己除外の204成功後は参照権限を失うためProject一覧へ戻ります。

WBSは`/projects/{projectId}/wbs`で開き、Backendのflat listを`parentTaskId`で階層化します。Boardと同じTask IDを使用し、画面内へ別のTask状態を保存しません。`TASK_UPDATE`を持つ利用者は階層表から親、Task種別、WBSコード、予定日、予定工数、進捗率、nullableな実績開始日・終了日をversion付きで更新できます。未着手は実績日なし、作業中は開始日だけ、完了期間は開始日と終了日で表示し、実績日の保存では進捗率やBoard列を自動変更しません。

EVMはactive baselineと指定基準日からBackendが算出したBAC、PV、EV、AC、SV、CV、SPI、CPIを表示します。Frontendは計算式や丸めを再実装せず、`GET /api/v1/projects/{projectId}/wbs/metrics?statusDate=YYYY-MM-DD`のResponseを正本にします。active baselineを作成・切替した場合は古いEVM結果を破棄し、利用者が新しい基準日で再集計します。

週次／月次ExcelはEVMと同じ基準日を使用し、WBS画面から`.xlsx`を直接ダウンロードします。実行中は両方のボタンを無効化し、BackendがCORSで公開する安全な`Content-Disposition` file nameを優先します。binaryと一時URLはStoreやWeb Storageへ保存せず、Blob URLは処理後に必ず解放します。認証は既存の`JSESSIONID`を使用し、参照専用GETへCSRF headerは付けません。

2026-09-05に専用Projectで週次・月次Excelの実ブラウザ回帰を完了しました。2 fileのdownload、ページ再読込、EVM表示、console warning・error 0件を確認し、Backend側のApache POI再読込とDB照合も成功しています。これによりWBS Stage 7のFrontend実装と回帰は完了です。

通常Taskの日別予定・実績Dialogでは、1日・Project member単位の分工数を取得時点versionで登録・更新・削除します。Project workloadは指定期間の日付・担当者単位で予定、実績、差分を表示します。通常memberとOWNER・MANAGER・SYSTEM_ADMINの操作範囲は画面でも案内しますが、最終認可はBackendへ委ねます。Task依存関係はFinish-to-Startと0以上の分単位待ち時間を追加でき、409競合では古い編集対象を破棄して最新一覧を再取得します。

稼働日calendarは平日480分・土日0分を曜日既定値とし、Project共通例外、Project member固有例外の順で上書きした有効値を表示します。Project共通例外はOWNER・MANAGER・SYSTEM_ADMIN、個人例外は本人またはProject管理者が取得時点version付きで登録・更新・削除します。Frontendの操作表示は案内であり、最終認可とProject状態・同日重複・楽観ロックはBackendが判定します。現段階ではcalendar設定画面までを接続し、workloadの稼働可能時間・過配賦判定への反映は次の変更単位とします。

参照専用GanttはMIT Licenseの`dhtmlx-gantt` Community 10を使用し、約622KBのlibrary codeをGantt選択時だけ遅延読み込みます。予定bar・依存線に加えてtooltipへ予定期間と実績期間を表示します。Gantt上の直接編集・link作成、lagによる自動日程計算は後続工程へ分離します。

## 検証

```bash
npm run typecheck
npm run test
npm run build
```

CIでもNode.js 24を使い、同じ型検査、テスト、ビルドを実行します。

Backendと同時に起動して確認する手順と実施記録は[ブラウザ回帰チェックリスト](docs/browser-regression-checklist.md)を参照してください。
