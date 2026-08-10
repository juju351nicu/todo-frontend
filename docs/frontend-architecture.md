# Work Management Frontend 構成ガイド

## 方針

Backendの機能別パッケージと対応させ、Frontendも`auth`、`member`、`task`、`inquiry`の機能単位へ段階的に整理する。全画面を同時に移動せず、1機能ごとに型検査、テスト、ビルドを成功させてから次へ進む。

タイピングゲームのcomposable構成は参考にするが、業務画面では最初から細分化しない。画面の状態と操作を`useXxxPage`へまとめ、検索、ページング、フォーム等が独立して再利用できる場合だけ追加分割する。

## 目標構成

```text
src/
├── app/
│   ├── layouts/
│   └── router/
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
- `src/shared/types/error.ts`: Backend共通エラー型
- `src/features/auth/api/authApi.ts`: Session確認、ローカルログイン、ログアウト、GitHub OAuth2開始URL
- `src/features/auth/stores/user.ts`: 画面遷移をまたいで共有する認証利用者とロール・権限
- `src/features/auth/composables/useLoginPage.ts`: ログイン画面の状態、Session復元、入力送信、OAuth2エラー表示
- `src/features/auth/views/LoginPage.vue`: composableを利用して表示を組み立てるログイン画面

会員、Todo、問い合わせは既存の`src/views`、`src/stores`、`src/types`に残している。次は`member`、`task`、`inquiry`の順で機能単位に移行する。

## 変更時の確認

```bash
npm run typecheck
npm run test
npm run build
```

APIのRequest / Responseを変更する場合は、Backendの`/v3/api-docs`またはSwagger UIと照合する。Session ID、OAuth2情報、パスワード等をFrontendのログやWeb Storageへ保存しない。
