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

## 検証

```bash
npm run test
npm run build
```

CIでもNode.js 24を使い、同じテストとビルドを実行します。
