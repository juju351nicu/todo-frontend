# Work Management Frontend

Vue 3とViteで構成したフロントエンドです。

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

Swagger / OpenAPIでBackendとのAPI契約を確認しながら、機能単位の構成へ移行しました。共通HTTP処理は`src/shared/api`、認証機能は`src/features/auth`、会員機能は`src/features/member`、Todo一覧・詳細・カレンダーを含むTask機能は`src/features/task`、問い合わせ機能は`src/features/inquiry`に配置しています。

Router、Session認証ガード、共通ヘッダー・メニューは`src/app`、汎用アラート・処理中表示は`src/shared/components`、API・画面定数は`src/shared/constants`、副作用のない共通変換は`src/shared/utils`に配置しています。各画面はルート単位で遅延読み込みし、初期表示に不要な会員・Todo・FullCalendarのコードを別チャンクに分割します。

画面の状態と操作は最初から細かく分けず、`useLoginPage`のように1画面につき1つのcomposableへまとめます。複数の独立した責務が明確になった場合だけ追加分割します。詳しくは[Frontend構成ガイド](docs/frontend-architecture.md)を参照してください。

## 検証

```bash
npm run typecheck
npm run test
npm run build
```

CIでもNode.js 24を使い、同じ型検査、テスト、ビルドを実行します。

Backendと同時に起動して確認する手順と実施記録は[ブラウザ回帰チェックリスト](docs/browser-regression-checklist.md)を参照してください。
