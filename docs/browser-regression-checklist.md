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
| 10 | Project一覧を開く | 参照可能なProjectとProject roleが表示される |
| 11 | Project Boardを開く | 標準3列と各列のTask件数が表示される |
| 12 | Taskカードを開く | Task詳細がDialogへ表示され、更新可能な利用者には保存操作が表示される |
| 13 | Taskの移動操作を確認する | 移動可能な利用者にはカード右上の移動ハンドルが表示され、dragと方向キーの操作案内を確認できる |
| 14 | Taskのarchive操作を確認する | 許可された利用者にだけarchive操作が表示され、確認Dialogからキャンセルできる |
| 15 | OWNERでProject設定を開く | 基本情報とmember一覧、各versionが表示される |
| 16 | Project名またはmember roleを更新する | 成功通知とBackend確定後の値が表示され、再読込後も維持される |
| 17 | Project memberを追加・除外する | ACTIVEなアカウントだけを追加でき、最後のOWNERは降格・除外できない |
| 18 | 検証用Projectをarchiveする | 確認後に参照専用へ切り替わり、Taskとmemberの更新操作が表示されない |
| 19 | Project BoardからWBSを開く | Boardと同じTaskが親子順で表示され、再読込後もTask ID・予定・進捗が一致する |
| 20 | WBSをGanttへ切り替える | 親子tree、予定bar、進捗、milestoneが表示され、drag等の編集操作ができない |

## WBS階層表・Ganttの初回確認項目

WBSは最初の段階では読取り専用である。通常のProjectデータを変更せず、次を表示確認する。

- `/projects/{projectId}/board`の「WBSを開く」から`/projects/{projectId}/wbs`へ遷移する。
- Project名、Task／Summary／Milestone件数、WBSコード、予定期間、予定工数、進捗、担当者、優先度が表示される。
- 親Taskの直後に子Taskが字下げ表示され、孫Taskはさらに1段深く表示される。
- 「Boardを開く」で同じProjectのBoardへ戻る。
- 「再読込」後もBackendの確定済みTaskから同じ階層を作り直す。
- 「Gantt」へ切り替え、Summaryを親とするTask bar、進捗、milestone、日付scaleを表示する。
- Gantt表示中に「再読込」しても二重描画、Task消失、console errorが発生しない。
- GanttではTask barの移動、期間resize、進捗変更、link作成ができない。
- Taskが0件の場合は空状態を表示し、画面エラーを出さない。
- `TASK_READ`不足は403、未参加Projectは404の案内となり、別Projectの存在やTask件数を表示しない。
- 横幅が狭い画面では表を横スクロールでき、列が重なって読めなくならない。
- 一連の操作でブラウザの`warning`、`error`を増やさない。

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

## 2026-08-14 Project Board実施結果

Taskのarchive操作追加後に、`user01`でログインしてProject一覧とProject Boardを確認した。

- `/projects`で「Work Management」、Project key、`OWNER` role、利用中statusを表示した。
- `/projects/1/board`で標準列「Todo」「進行中」「完了」を表示し、既存Todoから移行した18件のTaskを「Todo」列へ表示した。
- 更新可能な利用者向けのTask追加ボタン、Taskカード右上のドラッグハンドル、ドラッグ操作案内を表示した。
- 「SESの闇」を開き、タイトル、詳細、期間、担当者、優先度、配置先、保存操作を表示した。
- archive確認Dialogに対象Task名と注意事項を表示し、キャンセル後もTask編集Dialogが維持されることを確認した。
- 未対応Vuetify部品の`v-empty-state`がProject一覧で警告を出していたため、既存の`v-sheet`、`v-icon`、見出し、案内文で構成する空状態へ変更した。変更後のProject一覧・Board・Dialog操作ではブラウザの`warning`、`error`は0件だった。

既存DBを保持するため、ドラッグ確定とarchive実行はこの表示回帰では行っていない。列移動・列内並び替え・archive APIの成功、権限拒否、409競合、二重送信防止はJUnitまたはVitestで検証する。

## 2026-08-14 専用fixtureによる更新回帰結果

Backendの`scripts/browser-regression`にある`BROWSER-REGRESSION`専用fixtureを使用し、通常のローカルProject・Todoから分離して更新操作を確認した。

- `user01`でログインし、`Browser Regression`の標準3列とTask 3件を表示した。
- `Browser Move Target`の移動ハンドルへ右方向キーを入力し、成功通知と「Todo」2件・「進行中」1件への更新を確認した。
- 再読み込み後も`Browser Move Target`が「進行中」列に残り、Backendへ移動結果が永続化されていることを確認した。
- `Browser Archive Target`を編集Dialogから開き、対象名と注意事項を表示する確認Dialogを経由してarchiveした。
- archive成功通知の後、再読み込みしても`Browser Archive Target`が表示されず、「Todo」が1件になっていることを確認した。
- 安定起動後の新規検証タブではブラウザの`warning`、`error`は0件だった。
- 検証後に専用fixtureのcleanup SQLを実DBで実行し、通常のローカルデータだけへ戻した。

Vite開発サーバーの初回cold startでは、Vuetify依存関係の事前bundle更新と同時にカレンダーへ遷移したため、
動的importの一時的な失敗が1回記録された。依存関係の最適化完了後は同じ画面・Board操作で再発せず、
アプリケーションのAPIエラーやproduction buildの不具合ではないことを切り分けた。

## 2026-08-21 WBS階層表・Gantt表示回帰結果

Docker MySQLが停止中だったため、通常データを変更しないFrontend API契約fixtureをVite middlewareとして一時使用し、画面描画を確認した。fixtureは配布物・Git差分へ含めない。

- Sessionログイン後にProject一覧、標準3列Board、WBSの順で保護ルートを表示した。
- BoardのTask ID 101・102をWBSでも同じIDとして表示した。
- Summary 1件、Task 2件、Milestone 1件を親子順に表示し、WBSコード、予定期間、予定工数、進捗、担当者、優先度を確認した。
- Ganttへ切り替え、Summary bar、子Task bar、進捗、milestone、2026年8月の日付scaleを表示した。
- Gantt表示中の「再読込」、WBS URLのブラウザ再読込、同じProject Boardへの復帰が正常だった。
- 一連の操作でFrontendのconsole `warning`、`error`は0件だった。

実MySQL・Spring Session JDBCを使う結合回帰は、Dockerを起動した環境で`local,docker` Backendを使用して再確認する。今回のfixture回帰はFrontendのAPI契約、Router、階層変換、DHTMLX実描画を対象とし、Backend認可やFlywayを代替しない。
