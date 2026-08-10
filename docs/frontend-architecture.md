# Work Management Frontend 構成ガイド

## 方針

Backendの機能別パッケージと対応させ、Frontendも`auth`、`member`、`task`、`inquiry`の機能単位へ段階的に整理する。全画面を同時に移動せず、1機能ごとに型検査、テスト、ビルドを成功させてから次へ進む。

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
│   ├── task/
│   └── inquiry/
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
- `src/features/inquiry/api/inquiryApi.ts`: 問い合わせ送信API
- `src/features/inquiry/types/inquiry.ts`: 問い合わせAPIのRequest / Response型
- `src/features/inquiry/composables/useInquiryFormPage.ts`: 問い合わせ入力、送信、成功・入力エラー・接続エラー表示
- `src/features/inquiry/views/InquiryFormPage.vue`: composableを利用して表示を組み立てる問い合わせ画面

認証・会員・Task・問い合わせ機能、共通表示部品、レイアウト、Router、定数、utility、型宣言の配置整理は完了した。各業務画面は1画面につき1つのcomposableを使用し、複数画面で共有しない問い合わせの処理中状態はStoreではなく画面composableで管理する。全ルートを動的importへ変更したことで、従来約608KBだった単一JavaScriptは初期共通約151KB、最大のカレンダー画面約261KBへ分割され、500KB超の警告を解消した。API接続先は`VITE_API_BASE_URL`で環境別に設定し、未使用utility・テスト・Viteロゴも削除した。

2026-08-11にBackendと同時起動してブラウザ回帰確認を行い、ローカルログイン、再読み込み後のSession復元、会員一覧・詳細、Todo一覧・詳細・カレンダー、問い合わせフォーム、ログアウト後の保護ルート拒否が正常であることを確認した。詳細は[ブラウザ回帰チェックリスト](browser-regression-checklist.md)に記録する。Frontendの構成移行と画面表示回帰は一区切りとし、次は管理者向け権限管理API・画面と監査ログ基盤の設計へ進む。

## 変更時の確認

```bash
npm run typecheck
npm run test
npm run build
```

APIのRequest / Responseを変更する場合は、Backendの`/v3/api-docs`またはSwagger UIと照合する。Session ID、OAuth2情報、パスワード等をFrontendのログやWeb Storageへ保存しない。
