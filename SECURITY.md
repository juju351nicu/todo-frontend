# Security baseline

## 認証情報とログ

- パスワード、JWT、Cookie、Session ID、OAuth情報を`console`へ出力しない。
- APIレスポンス全体をデバッグ出力しない。必要な場合も秘密情報や個人情報を除外する。
- Client ID、Client Secret、APIキー等をソースコードや`.env`のGit管理対象へ保存しない。
- 新しい秘密情報はローカル環境変数またはデプロイ先のSecrets機能へ登録する。

Phase 3でSpring Session JDBCへ移行した後も、`JSESSIONID`はブラウザのHttpOnly Cookieとして扱い、JavaScriptから取得・保存・ログ出力しない。
