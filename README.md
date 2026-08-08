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
npm run dev
```

開発サーバーは既定で`http://localhost:8081`を使用します。

## 認証方式

BackendのSpring Security + Spring Session JDBCを使用します。JWTは使用せず、ブラウザが保持するHttpOnlyの`JSESSIONID` Cookieを認証根拠にします。

- 全APIリクエストで`credentials: "include"`を指定する。
- `GET /api/v1/session`でログイン中の利用者、ロール、権限をPiniaへ復元する。
- `POST`、`PUT`、`DELETE`では`XSRF-TOKEN` Cookieを`X-XSRF-TOKEN`ヘッダーへ設定する。
- ログイン・ログアウト直後は`GET /api/v1/csrf`でCSRFトークンを更新する。
- localStorageとsessionStorageへJWTやSession IDを保存しない。

BackendとFrontendはどちらも`localhost`で起動してください。`localhost`と`127.0.0.1`を混在させるとCookieの送信先が変わります。

## TypeScript段階移行

JavaScriptからTypeScriptへ機能単位で移行しています。現在は認証・会員・Todo・問い合わせAPIのRequest / Response型、共通HTTPクライアント、業務で使用するPinia StoreをTypeScript化済みです。

- JavaScriptとの混在期間は`tsconfig.json`の`allowJs`を有効にする。
- `.ts`ファイルは`npm run typecheck`で型検査する。
- Vue画面を`<script setup lang="ts">`へ変更する作業単位で`vue-tsc`を導入し、Single File Componentも型検査へ含める。
- 全移行後に`allowJs`を無効化する。

## 検証

```bash
npm run typecheck
npm run test
npm run build
```

CIでもNode.js 24を使い、同じ型検査、テスト、ビルドを実行します。
