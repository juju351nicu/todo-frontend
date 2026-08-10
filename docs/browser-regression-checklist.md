# ブラウザ回帰チェックリスト

## 目的

Spring SecurityとSpring Session JDBCを利用するFrontendについて、`JSESSIONID`によるログイン状態の復元と主要画面の表示を実ブラウザで確認する。API契約変更、Router変更、機能ディレクトリ移動後に同じ手順を再実行する。

## 起動条件

- Backend: Spring Boot 4.1.0、Java 25、`local`プロファイル、`http://localhost:8030`
- Frontend: Node.js 24、Vite 8、`http://localhost:8081`
- MySQL: `todo`データベース
- BackendとFrontendはCookie送信先を揃えるため、どちらも`localhost`で起動する。

```bash
# Backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# Frontend
npm run dev -- --host localhost
```

## 確認項目

| No. | 操作 | 期待結果 |
|---:|---|---|
| 1 | ローカルアカウントでログインする | 会員一覧へ遷移し、ログイン利用者向けメニューが表示される |
| 2 | 会員一覧を再読み込みする | `GET /api/v1/session`により認証状態が復元され、ログイン画面へ戻らない |
| 3 | 会員一覧と会員詳細を開く | 一覧データと対象会員のフォーム値が表示される |
| 4 | Todo一覧とTodo詳細を開く | 一覧データと対象Todoのフォーム値が表示される |
| 5 | Todoカレンダーを開く | カレンダーが表示され、画面エラーが発生しない |
| 6 | 問い合わせ画面を開く | 入力フォームが表示される。メール送信環境を用意していない場合は送信しない |
| 7 | ログアウトする | ログイン画面へ遷移する |
| 8 | ログアウト後に保護ルートを直接開く | ログイン画面へ戻り、保護画面を表示しない |
| 9 | ブラウザの警告・エラーログを確認する | アプリケーション起因の`warning`、`error`がない |

## 2026-08-11 実施結果

すべての確認項目が正常だった。

- `user01`でログインし、`/member/memberList`へ遷移した。
- 会員一覧を再読み込みしてもSessionが復元され、会員3件を表示した。
- `/member/detail/1`で`user01`・松浦の会員情報を表示した。
- `/todo/todoList`でTodo一覧を表示し、一覧の編集操作から`/todo/detail/14`へ遷移して「コマツ株価」を表示した。
- `/todo/calendar`と`/inquiry`を表示した。
- サイドメニューからログアウトし、ログアウト後の`/todo/calendar`直接アクセスがログイン画面へ戻ることを確認した。
- 一連の操作中にブラウザの`warning`、`error`は記録されなかった。

問い合わせ送信、会員・Todoの登録更新、GitHub OAuth2認可は外部状態を変更するため、この表示回帰では実行していない。各機能を変更する作業単位で、専用テストデータまたは検証用OAuth Appを使用して追加確認する。
