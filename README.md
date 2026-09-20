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

Swagger / OpenAPIでBackendとのAPI契約を確認しながら、機能単位の構成へ移行しました。共通HTTP処理は`src/shared/api`、認証機能は`src/features/auth`、会員機能は`src/features/member`、Project設定・メンバー管理は`src/features/project`、Todo一覧・詳細・カレンダーとProject Boardは`src/features/task`、WBS階層表・編集・Task依存関係・実績期間・日別予定実績・workload・稼働日calendar・baseline・EVM・週次／月次Excel・参照専用Ganttは`src/features/wbs`、本人の日・月勤怠と打刻は`src/features/attendance`、ベル通知と管理者お知らせ配信は`src/features/notification`、問い合わせ機能は`src/features/inquiry`に配置しています。

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

本人勤怠は`/attendance`で開き、`ATTENDANCE_READ_OWN`を持つ利用者だけをRouterとside menuで案内します。
月一覧は期間APIを1回だけ呼び、APIが返す登録済み勤怠と月内全日を結合します。選択日には複数の勤務・休憩区間と
確定済みの勤務・休憩・差引時間を表示し、未終了区間は合計へ含めず「集計中」と案内します。
`ATTENDANCE_WRITE_OWN`を持つ利用者は出勤・退勤・休憩開始・休憩終了を実行できます。Client時刻は送信せず、
打刻中は二重送信を防ぎます。成功時はBackendが返す勤務日へ同期し、409時は状態を推測せず月一覧と日詳細を
再取得します。専用fixtureによる本人打刻の実ブラウザ・DB回帰はStage 8A-4で完了しています。

Stage 8B-2では本人画面へ月次状態、月合計、提出・再提出、差戻し理由を追加しました。管理者は
`/attendance/administration`で対象月・状態を検索し、選択accountの詳細を確認して承認・理由付き差戻し・締めを
実行します。確認者と締め担当のpermissionを分離し、更新中の二重送信を防止し、409時は最新詳細と一覧を再取得します。
全50 test file・363 Vitest、TypeScript／Vue型検査、production buildが成功しました。専用3 accountによる
実ブラウザ・DB回帰では提出、理由付き差戻し、再提出、コメント付き承認、締めをCLOSED version 5まで確認し、
確認者の締め操作非表示、監査5件、console warning・error 0件、cleanup後0件も確認しました。これによりStage 8B-2は完了です。

Stage 8C-2では本人画面へAPPROVED／CLOSED月の全置換修正申請、勤務日別の申請履歴、PENDING取消を追加しました。
現在勤怠はAsia/Tokyoの入力値へ変換し、勤務・休憩の逆転、日付違い、重複、勤務外休憩を送信前にも案内します。
管理画面には状態別修正申請一覧、現在勤怠と申請snapshotの比較、コメント付き承認、理由付き却下を追加しました。
再読込後の履歴・versionはBackendから復元し、409時は古い値を再送しません。実ブラウザ回帰では取消、承認、
理由必須の却下、CLOSEDからAPPROVEDへの遷移、退勤18:30への全置換、DB監査6件、cleanup後0件を確認しました。
回帰中に見つかった`datetime-local`の秒省略は、offset変換時に`:00`を補完して修正し、Vitestで固定しています。
夜勤を含む期間境界、permission表示、競合、二重送信も含め、全51 test file・375 Vitest、TypeScript／Vue型検査、
production buildが成功しました。これによりStage 8C-2は完了です。

Stage 8E-2では管理者向け勤怠月次確認画面へ、選択月の全アカウント・月内全日をCSV出力する導線を追加しました。
`ATTENDANCE_EXPORT`を持つ利用者だけに「月次CSV」を表示し、最終認可はBackendへ委ねます。CSVは既存Session Cookieを
使う参照専用GETで取得するためCSRF headerを付けません。Backendの安全なASCII file名だけを採用し、不正または
欠落時は`work-management-attendance-YYYY-MM.csv`へ戻します。Blob URLは保存開始後に必ず解放し、生成中の再操作、
401、403、入力不正、接続失敗を画面で扱います。専用fixtureでは実ブラウザの成功通知、再読込後のSession維持、
認証済みCSVの手動JUnit再読込、DB照合、cleanup後`0,0,0,0`まで確認しました。CSVは固定14列、月内全日、
差引480分、Task実績420分、未配賦60分、APPROVED、機密列不在で期待値と一致し、Stage 8E-2と
Stage 8全体は完了しています。

Stage 8完了後のUX改善として、本人勤怠画面の先頭へ大きなAsia/Tokyo現在時刻、利用者名、勤怠状態、
出勤・退勤・休憩開始・休憩終了をまとめた打刻パネルを追加しました。4操作は常に同じ位置に置き、現在状態で
実行できるものだけを有効化します。表示時計はAPIへ送信せず、既存のBackend server timestamp、permission、
二重送信防止、409再取得、月次workflow、修正申請をそのまま利用します。全51 test file・383 Vitest、
TypeScript／Vue型検査、production buildが成功しています。

Stage 9Aでは全認証画面のヘッダーへベルを追加しました。未読の管理者お知らせ・Task割当・勤怠差戻しと、
未解決の期限超過・打刻漏れ・承認待ちを分けて表示し、badgeは両方の合計です。イベント通知はベルを開いた後に
一括既読とし、導出警告は元のTask・勤怠状態を解消するまで残します。SYSTEM_ADMINはside menuの
「お知らせ配信」から全利用者向けの件名・本文・任意終了日時を登録できます。定期pollingは行わず、初期表示、
route変更、tab再表示、window focus、業務操作後の明示eventで更新します。Frontendは54 test file・395 Vitest、
TypeScript／Vue型検査、production buildまで成功しています。

ロードマップのPhase 1として、`/my-tasks`をBackend専用の`GET /api/v1/my-tasks`へ接続しました。Backendが
Sessionのaccount ID、Project membership、ACTIVE Project、未完了・未archive状態を確定し、Asia/Tokyoの業務日を
基準に期限超過・今日・今後の3グループと残日数を返します。画面はProject、Board列、優先度、期限、進捗を表示し、
Task選択時はProject Boardの詳細Dialogへ遷移します。旧Todo更新permissionがある利用者だけ完了操作を表示し、
再読込、空結果、401、permission不足、通信エラーを処理します。「今週」はBackendの業務日から日曜までを
切り替えて表示し、期限超過を混在させません。

2026-09-20に専用fixtureで実ブラウザ回帰を完了しました。期限3グループ、非対象Taskの除外、Board詳細deep link、
完了後の再読込とDB状態を照合し、安定表示後のAPIはすべて200、browser console warning・errorは0件でした。
Frontendは58 test file・425 Vitest、TypeScript／Vue型検査、production buildまで成功しています。

Stage 9Eでは`/tasks/search`を追加し、Backendが認可済みのACTIVE Projectを対象に、Task名・説明・Project、
担当者、状態、期限、優先度で横断検索します。結果は最大100件で、上限超過を画面に案内します。表示列はTask名を
固定し、Project、状態、担当者、優先度、開始日、期限、進捗、説明から選択できます。結果行は既存Project Boardの
Task詳細deep linkへ接続します。

検索条件と表示列は本人Saved Viewとして最大20件保存できます。作成・適用・version付き更新／削除を
`useTaskSearchPage`へ集約し、404／409では一覧を再取得して古いversionを残しません。Routerとside menuは
`TASK_READ`で案内し、Project参照範囲、本人所有、名称重複、件数上限、最終認可はBackendを正本とします。
Task検索と「今週」のテストを含む全60 test file・437 Vitest、TypeScript／Vue型検査、production buildが成功しています。

2026-09-20に専用fixtureで100件上限、未参加・archive境界、literal検索、複合条件、表示列、Saved Viewの
作成・別tab適用・version競合・削除、Board詳細deep linkを実ブラウザ確認しました。競合回復後の安定再読込は
console warning・error 0件で、DB inspectとcleanup後の専用account、Project、Task、Saved View、Session 0件まで完了しています。

Task詳細Dialogのコメント欄は、投稿者本人のコメントだけに編集・削除操作を表示します。編集と削除には一覧取得時点の
versionを送り、409または404では古い入力・確認対象を破棄して最新一覧を再取得します。編集による再メンションや、
削除による既存通知の取消は行いません。API境界とcomposableは401、入力上限、二重送信、所有者判定、409回復を扱い、
全56 test file・408 Vitest、TypeScript／Vue型検査、production buildが成功しています。専用fixtureによる投稿、編集、
削除、他者操作非表示、2 tab競合、通知履歴、DB照合、cleanupの実ブラウザ回帰も完了しました。

Project Boardの「コメント一覧」は、Project内のTaskコメントを最終更新時刻の新しい順で最大100件表示します。
FrontendでTask別一覧を集約せず、Backendの認可済み横断APIをDialogを開くたびに取得します。active Taskは既存の
Task詳細Dialogへ接続し、archive済みTaskは「アーカイブ済み」を表示する履歴参照だけとします。
全57 test file・414 Vitest、型検査、production buildが成功し、投稿者と別Project memberによる実ブラウザ、
更新時刻順、Task詳細遷移、DB照合、cleanup回帰まで完了しています。

Stage 10A-2ではTask詳細へchecklistを追加しました。最大50件の追加、完了切替、本文編集、上下移動、削除を
item単位versionで実行し、404／409では編集・削除対象を破棄して最新一覧へ戻します。完了数と進捗率を表示しますが、
Task本体の進捗率は変更しません。

本人専用Task Templateは、既存Taskと未完了checklistのsnapshot保存、本人一覧、初期値とchecklistの全置換編集、
version付きarchive、別Projectへの適用を提供します。適用時は開始日、担当者、Board列を任意上書きでき、生成Taskを
既存Board詳細で開きます。機能資格を含む最終認可はBackendへ委ね、資格不足の403、401、404／409を個別に扱います。
Backend契約に合わせ、Task優先度表示は`1=低、2=中、3=高`へ統一しました。

Frontendは65 test file・466 Vitest、TypeScript／Vue型検査、production buildが成功しています。2026-09-21の
専用fixture回帰ではchecklist CRUD／並び替え、capture後のsnapshot不変、Template編集、別Project適用、
Board／WBSの同一Task表示、lineage、archive、DB cleanupを確認し、安定操作中のbrowser consoleはwarning・error 0件でした。

## 検証

```bash
npm run typecheck
npm run test
npm run build
```

CIでもNode.js 24を使い、同じ型検査、テスト、ビルドを実行します。

Backendと同時に起動して確認する手順と実施記録は[ブラウザ回帰チェックリスト](docs/browser-regression-checklist.md)を参照してください。
