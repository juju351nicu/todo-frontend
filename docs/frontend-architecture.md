# Work Management Frontend 構成ガイド

## 方針

Backendの機能別パッケージと対応させ、Frontendも`auth`、`member`、`project`、`task`、`inquiry`の機能単位へ段階的に整理する。全画面を同時に移動せず、1機能ごとに型検査、テスト、ビルドを成功させてから次へ進む。

タイピングゲームのcomposable構成は参考にするが、業務画面では最初から細分化しない。画面の状態と操作を`useXxxPage`へまとめ、検索、ページング、フォーム等が独立して再利用できる場合だけ追加分割する。

## 目標構成

```text
src/
├── app/
│   ├── layouts/
│   ├── router/
│   └── views/
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── types/
│   │   └── views/
│   ├── member/
│   ├── project/
│   ├── task/
│   ├── wbs/
│   ├── inquiry/
│   └── administration/
└── shared/
    ├── api/
    ├── components/
    ├── constants/
    ├── types/
    └── utils/
```

## 各ディレクトリの責務

- `app`: アプリケーション全体のRouter、認証ガード、ヘッダー・メニュー等のレイアウト、NotFound等を置く。
- `views`: 画面全体を組み立て、画面用composableを呼び出す。
- `composables`: 画面状態、入力、検索、登録、画面遷移等の操作を扱う。
- `components`: PropsとEventを中心とする表示部品とし、Backend APIを直接呼ばない。
- `stores`: 認証利用者など、複数画面や画面遷移をまたいで共有する状態だけを保持する。
- `api`: 共通HTTPクライアントを利用してBackend APIを呼び、Vueのreactiveな画面状態を保持しない。
- `types`: 機能固有のRequest / Responseと画面型を置く。
- `shared`: 複数機能から利用するHTTP、共通エラー、表示部品、定数、純粋関数を置く。

依存方向は原則として`view -> composable -> store/api -> shared/api`とする。`shared`から個別の`features`へ依存させない。

## 現在の移行状況

最初の作業単位として、次を移行した。

- `src/shared/api/httpClient.ts`: `JSESSIONID`とCSRFに対応する共通HTTPクライアント
- `src/shared/components/AppAlert.vue`: 機能に依存しないアラート表示部品
- `src/shared/components/LoadingIndicator.vue`: 機能に依存しない処理中表示部品
- `src/shared/constants/api.ts`: 環境変数で変更可能なBackend接続先とAPIパス
- `src/shared/constants/ui.ts`: data-tableのページ表示定数
- `src/shared/types/error.ts`: Backend共通エラー型
- `src/shared/utils/number.ts`: 文字列・数値配列を数値配列へ変換する純粋関数
- `src/app/layouts/AppHeader.vue`: アプリケーション共通ヘッダー
- `src/app/layouts/AppSideMenu.vue`: 認証利用者のロールに応じた共通メニュー
- `src/app/router/index.ts`: Router生成とSession認証ガード
- `src/app/router/routes.ts`: ルート定義と画面単位の遅延読み込み
- `src/app/router/router.d.ts`: Routerの認証要否メタデータ型
- `src/app/views/NotFoundPage.vue`: NotFound画面
- `src/features/auth/api/authApi.ts`: Session確認、ローカルログイン、ログアウト、GitHub OAuth2開始URL
- `src/features/auth/stores/user.ts`: 画面遷移をまたいで共有する認証利用者とロール・権限
- `src/features/auth/composables/useLoginPage.ts`: ログイン画面の状態、Session復元、入力送信、OAuth2エラー表示
- `src/features/auth/views/LoginPage.vue`: composableを利用して表示を組み立てるログイン画面
- `src/features/member/api/memberApi.ts`: 会員一覧・詳細・登録更新・削除・退会API
- `src/features/member/stores/member.ts`: 会員情報とAPI実行中状態
- `src/features/member/types/member.ts`: 会員APIのRequest / Response型
- `src/features/member/composables/useMemberListPage.ts`: 会員一覧、選択ID、ページング、削除、詳細画面遷移
- `src/features/member/views/MemberListPage.vue`: composableを利用して表示を組み立てる会員一覧画面
- `src/features/member/composables/useMemberDetailPage.ts`: 会員詳細取得、登録更新フォーム、確認モーダル
- `src/features/member/composables/useMemberCancelPage.ts`: 退会パスワード入力、退会処理、エラー表示
- `src/features/member/components/MemberUpsertConfirm.vue`: 会員登録更新の確認部品
- `src/features/member/utils/memberForm.ts`: 会員詳細Responseからフォーム、フォームから登録更新Requestへの変換
- `src/features/member/views/MemberDetailPage.vue`: 会員登録・更新画面
- `src/features/member/views/MemberCancelPage.vue`: 会員退会画面
- `src/features/task/api/taskApi.ts`: Todo一覧・詳細・カレンダー・完了・登録更新API
- `src/features/task/stores/task.ts`: Todo一覧の共有状態とTask API呼び出し
- `src/features/task/types/task.ts`: Task APIのRequest / Response型
- `src/features/task/composables/useTodoListPage.ts`: Todo検索、一覧、完了更新、エラー表示、詳細画面遷移
- `src/features/task/composables/useTodoDetailPage.ts`: Todo詳細取得、登録更新フォーム、確認モーダル、エラー表示
- `src/features/task/composables/useTodoCalendarPage.ts`: Todoカレンダー検索、イベント設定、エラー表示
- `src/features/task/components/TodoUpsertConfirm.vue`: Todo登録更新の確認部品
- `src/features/task/utils/taskForm.ts`: Todo詳細Responseからフォーム、フォームから登録更新Requestへの変換
- `src/features/task/utils/taskCalendar.ts`: Todo一覧からFullCalendarイベント・設定への変換
- `src/features/task/utils/taskDisplay.ts`: 重要度・色・残日数・詳細省略の表示変換
- `src/features/task/views/TodoListPage.vue`: composableを利用して表示を組み立てるTodo一覧画面
- `src/features/task/views/TodoDetailPage.vue`: Todo登録・更新画面
- `src/features/task/views/TodoCalendarPage.vue`: Todoカレンダー画面
- `src/features/project/api/projectApi.ts`: Project一覧・詳細・Board参照、Project更新・archive、member管理API
- `src/features/project/types/project.ts`: Project・Project member・Board・Taskの新API契約型
- `src/features/project/composables/useProjectListPage.ts`: Project一覧、検索、Board遷移
- `src/features/project/composables/useProjectSettingsDialog.ts`: Project基本情報、archive、member追加・role変更・除外、409再取得
- `src/features/project/components/ProjectSettingsDialog.vue`: Task Boardから開くProject設定・member管理Dialog
- `src/features/project/views/ProjectListPage.vue`: 参照可能なProjectのカード一覧
- `src/features/task/api/projectTaskApi.ts`: Project配下のTask詳細・登録・更新・移動・archive API
- `src/features/task/composables/useTaskBoardPage.ts`: Board読込、Task Dialog、登録・更新・移動・archive・競合回復
- `src/features/task/views/TaskBoardPage.vue`: 標準列とTaskカードを表示するProject Board画面
- `src/features/wbs/api/wbsApi.ts`: Project単位の読取り専用WBS参照API
- `src/features/wbs/types/wbs.ts`: WBS Response、Task種別、階層表行、Gantt adapterの型
- `src/features/wbs/utils/wbsTree.ts`: flat listの安全な階層化と表示変換
- `src/features/wbs/utils/wbsGantt.ts`: 階層行から循環を除いたDHTMLX Gantt data・表示期間への変換
- `src/features/wbs/composables/useWbsPage.ts`: WBS読込、階層変換、認証エラー、Board遷移
- `src/features/wbs/components/WbsGanttChart.vue`: 予定期間・進捗・milestoneの読取り専用Gantt
- `src/features/wbs/views/WbsPage.vue`: Boardと同じTaskを表示する階層表・Gantt切替画面
- `src/features/inquiry/api/inquiryApi.ts`: 問い合わせ送信API
- `src/features/inquiry/types/inquiry.ts`: 問い合わせAPIのRequest / Response型
- `src/features/inquiry/composables/useInquiryFormPage.ts`: 問い合わせ入力、送信、成功・入力エラー・接続エラー表示
- `src/features/inquiry/views/InquiryFormPage.vue`: composableを利用して表示を組み立てる問い合わせ画面

認証・会員・Task・問い合わせ機能、共通表示部品、レイアウト、Router、定数、utility、型宣言の配置整理は完了した。各業務画面は1画面につき1つのcomposableを使用し、複数画面で共有しない問い合わせの処理中状態はStoreではなく画面composableで管理する。全ルートを動的importへ変更したことで、従来約608KBだった単一JavaScriptは初期共通約151KB、最大のカレンダー画面約261KBへ分割され、500KB超の警告を解消した。API接続先は`VITE_API_BASE_URL`で環境別に設定し、未使用utility・テスト・Viteロゴも削除した。

2026-08-11にBackendと同時起動してブラウザ回帰確認を行い、ローカルログイン、再読み込み後のSession復元、会員一覧・詳細、Todo一覧・詳細・カレンダー、問い合わせフォーム、ログアウト後の保護ルート拒否が正常であることを確認した。詳細は[ブラウザ回帰チェックリスト](browser-regression-checklist.md)に記録する。Frontendの構成移行と画面表示回帰は一区切りとし、次は管理者向け権限管理API・画面と監査ログ基盤の設計へ進む。

2026-08-14にTodo画面をBackendのPrincipal認可へ追従させた。Session APIの`permissionCodes`を型付きでStoreへ保持し、Todo一覧・詳細・カレンダーは`TASK_READ_ALL`または`TASK_READ_OWN`、新規登録は`TASK_WRITE_ALL`または`TASK_WRITE_OWN`をRouterメタデータで事前検査する。メニュー、完了ボタン、登録更新ボタンも同じpermissionで表示を制御し、読取専用利用者の詳細フォームはreadonlyにする。旧数値`role`をTodo Requestと画面判定から削除し、新規Todoの所有者初期値は固定会員IDではなく0としてBackendに認証主体の解決を委ねる。Frontendの制御は利用者向け表示のためであり、最終認可はBackendの`@PreAuthorize`と`TaskAuthorizationLogic`が行う。

管理機能は`src/features/administration`へ追加する。最初はアカウント一覧とロール編集を同じ`useAccountAdministrationPage`で扱い、監査ログ一覧だけを`useAuthorizationAuditListPage`へ分ける。Backend APIとOpenAPI定義が安定してから画面を追加し、Routerの表示制御だけに依存せずBackend permissionで認可する。

2026-08-14にBacklog風MVPのFrontend入口として、Project一覧とProject Boardを追加した。Project一覧は`PROJECT_READ`、Boardは`TASK_READ`をRouterの事前案内に使用する。BoardではBackendから返された標準列とTaskカードを表示し、`TASK_CREATE`または`TASK_UPDATE`を持つ利用者だけがTask Dialogを保存できる。編集開始時はTask詳細APIから最新versionを取得し、409競合時はDialogを閉じて最新Boardを再取得する。

同日に`vuedraggable 4`を追加し、`TASK_MOVE`専用APIへ列移動と列内並び替えを接続した。Ghost-PDF5と同系統のライブラリだがCDNでは読み込まず、npmとViteでversionを固定してTypeScriptの検査対象にする。ドラッグ開始時にBoardを複製し、移動後の直前・直後Task IDと移動前versionをBackendへ送信する。成功時はFrontend上の仮順序を使い続けず、Backendが再採番して返したBoardへ置き換える。403・接続失敗ではドラッグ前の順序へ戻し、409競合では仮順序を破棄して最新Boardを再取得する。system permissionに加えてProject roleがOWNERまたはMANAGERの利用者だけに移動ハンドルを表示し、MEMBERには表示しない。既存Todo画面は移行期間中の互換機能として残し、Project Taskへデータ移行するまでは削除しない。

Task archiveはTask詳細Dialogから確認Dialogを経由して実行し、`TASK_ARCHIVE`とProject roleの両方で操作表示を制御する。Task詳細取得時点のversionをDELETE APIへ渡し、成功後はBackendからBoardを再取得して対象Taskが除外されたことを確定する。409競合では古いTask詳細を閉じて最新Boardを表示する。物理削除やFrontend配列だけの削除は行わず、Backendの論理archiveを唯一の確定状態とする。

Task移動はpointer操作だけに限定せず、移動ハンドルへフォーカスした方向キー操作にも対応する。上下キーは同じ列で1件移動し、左右キーは隣接列の末尾へ移動する。列または並び順の端ではAPIを呼ばない。keyboard操作もdragと同じ`TASK_MOVE`、Project role、version、前後Task ID、失敗復元、409再取得処理を使用し、Frontend独自の確定状態を作らない。

Project設定とmember管理はTask Boardから開く1つのDialogと`useProjectSettingsDialog`へまとめる。Project名・説明の更新、ACTIVEからARCHIVEDへの変更、member追加・role変更・除外を扱い、操作ごとの小さなcomposableへは分割しない。Project／memberのversionをBackendへ送り、409では古いフォームを確定せず最新Project詳細を再取得する。最後のOWNERの降格・除外は画面でも抑止して理由を表示するが、同時操作を含む最終判定はBackendのtransactionへ委ねる。自己除外は204 Responseを確定結果として扱い、削除後に取得不能となるProject詳細を要求せずProject一覧へ遷移する。archive成功後は親BoardのProject詳細をResponseで差し替え、Task操作を参照専用へ切り替える。

WBSは`src/features/wbs`へ独立させる。Backendが返すTask flat listを`parentTaskId`でpreorderへ変換し、親欠損や循環があってもTaskを消さず1回だけ表示する。Boardと同じTask IDを正本とし、WBS専用のTask Storeや編集状態は作らない。`useWbsPage`ひとつで読込、階層変換、エラー、Board遷移を扱う。

参照専用GanttはDHTMLX Gantt Community 10をcoreから直接組み込む。Vueの有償wrapperやCDNは使用せず、npm lockとMIT Licenseを確認できる状態にする。`WbsGanttChart`は画面切替時だけdynamic importし、通常の階層表へ約622KBのlibrary codeを含めない。Ganttへ渡す親IDは安全なpreorderのdepthから再構成し、循環したBackend dataをlibraryへ伝播させない。予定終了日は画面上で当日を含むため、DHTMLXの排他的終了境界へ1日加算する。読取り専用設定でdrag、resize、progress変更、link作成を無効にし、編集API、実績工数、依存関係、自動scheduleは後続工程へ分離する。

## 変更時の確認

```bash
npm run typecheck
npm run test
npm run build
```

APIのRequest / Responseを変更する場合は、Backendの`/v3/api-docs`またはSwagger UIと照合する。Session ID、OAuth2情報、パスワード等をFrontendのログやWeb Storageへ保存しない。
