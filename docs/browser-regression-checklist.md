# ブラウザ回帰チェックリスト

## 目的

Spring SecurityとSpring Session JDBCを利用するFrontendについて、`JSESSIONID`によるログイン状態の復元と主要画面の表示を実ブラウザで確認する。API契約変更、Router変更、機能ディレクトリ移動後に同じ手順を再実行する。

## 起動条件

- Backend: Spring Boot 4.1.0、Java 25、`local,docker`プロファイル、`http://localhost:8030`
- Frontend: Node.js 24、Vite 8、`http://localhost:8081`
- MySQL: Docker MySQL 8.4、host `33316`の`todo`データベース
- BackendとFrontendはCookie送信先を揃えるため、どちらも`localhost`で起動する。

```bash
# Backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local,docker

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
| 21 | WBSでTask依存関係を操作する | Finish-to-Startを追加・削除でき、再読込後もBackendの確定一覧と一致する |
| 22 | 通常Taskの日別実績を操作する | 一覧・合計・登録・編集・削除がBackendの確定値と一致し、Summary・Milestoneには入口が表示されない |
| 23 | WBS Taskの実績期間を更新する | 未着手・作業中・完了期間が一覧とGantt tooltipへ表示され、再読込後も一致する |
| 24 | WBSの稼働日calendarを操作する | Project共通・個人例外の優先順位、登録・更新・削除、role別操作表示がBackend確定値と一致する |

## WBS階層表・Ganttの初回確認項目

WBSのTask階層とGanttを参照し、専用fixture以外のProjectデータを変更せず次を表示確認する。

- `/projects/{projectId}/board`の「WBSを開く」から`/projects/{projectId}/wbs`へ遷移する。
- Project名、Task／Summary／Milestone件数、WBSコード、予定期間、実績期間、予定工数、進捗、担当者、優先度が表示される。
- 親Taskの直後に子Taskが字下げ表示され、孫Taskはさらに1段深く表示される。
- 「Boardを開く」で同じProjectのBoardへ戻る。
- 「再読込」後もBackendの確定済みTaskから同じ階層を作り直す。
- 「Gantt」へ切り替え、Summaryを親とするTask bar、進捗、milestone、日付scale、登録済みFinish-to-Start依存線を表示する。
- Gantt表示中に「再読込」しても二重描画、Task消失、console errorが発生しない。
- GanttではTask barの移動、期間resize、進捗変更、link作成ができない。
- Taskが0件の場合は空状態を表示し、画面エラーを出さない。
- `TASK_READ`不足は403、未参加Projectは404の案内となり、別Projectの存在やTask件数を表示しない。
- 横幅が狭い画面では表を横スクロールでき、列が重なって読めなくならない。
- 一連の操作でブラウザの`warning`、`error`を増やさない。

## Task実績期間V6の初回確認項目

通常データと分離した専用Project・WBS Taskを使用し、次を確認する。

- 実績開始日・終了日が両方未入力の場合は「未着手」と表示する。
- 実績開始日だけを保存すると「作業中」と表示し、再読込後も開始日を維持する。
- 同日または開始日より後の実績終了日を保存すると完了期間として表示する。
- 終了日だけ、存在しない日付、開始日より前の終了日はAPIを送信せず理由を表示する。
- 実績期間を予定期間外へ設定でき、遅延した実績をそのまま記録できる。
- 実績期間の保存だけでは進捗率、Board列、完了flag、日別実績工数を変更しない。
- 階層表の実績期間とGantt tooltipの実績期間がBackend Responseと一致する。
- GanttのTask barは予定期間を維持し、実績期間によって移動・伸縮しない。
- 2つのtabで同じTaskを更新し、古いversionが409となって最新WBSへ戻る。
- 401・403・404・409を区別し、再読込後の画面とDB inspectが一致する。
- 一連の操作でブラウザの`warning`、`error`を増やさない。

## Task依存関係の初回確認項目

通常データと分離した専用Project・Taskを使用し、次を確認する。

- 依存関係0件では空状態を表示し、Taskが2件未満の場合は追加操作を無効にする。
- `TASK_UPDATE`を持つ利用者だけに追加・削除操作を表示する。
- 先行Task、後続Task、0以上の整数分待ち時間を指定し、Finish-to-Startを追加できる。
- 未選択、同じTask、負数・小数の待ち時間、同方向重複ではAPIを送信せず理由を表示する。
- 直接または間接循環をBackendが400で拒否し、入力Dialogへ理由を表示する。
- 403はpermission不足、404は対象なし、409は状態・version競合として区別する。
- 削除確認をキャンセルした場合は依存関係を維持し、確定時だけ取得済みversionで削除する。
- 作成・削除後に再読込しても一覧が一致し、別Project・archive Taskの情報を表示しない。
- Ganttへ切り替えると登録済みFinish-to-Startだけを依存線として表示し、線を直接作成・変更できない。
- 2つのtabで同じ依存関係を操作し、古いversionによる削除が409となって最新一覧へ戻る。
- 一連の操作でブラウザの`warning`、`error`を増やさない。

## Task日別実績工数の初回確認項目

通常データと分離した専用Project・通常Task・Project memberを使用し、次を確認する。

- 通常Taskの実績ボタンからDialogを開き、業務日順の一覧、作業者表示名、分単位工数、version、合計を表示する。
- Summary・Milestoneには日別実績の入口を表示せず、APIを送信しない。
- 実績0件では空状態と合計0分を表示する。
- 通常memberの作業者候補は自分だけ、OWNER・MANAGER・SYSTEM_ADMINはProject member全員となる。
- 存在しない日付、0分、1441分、小数、未選択・候補外作業者ではAPIを送信せず全理由を表示する。
- 1分、1440分の境界値を登録でき、同じTask・業務日・作業者の重複は409として最新一覧へ戻る。
- 登録・更新後はBackendの一覧・合計Responseへ差し替え、更新時は取得済みversionを送る。
- 削除確認をキャンセルした場合は一覧を維持し、確定時だけ取得済みversionで削除する。
- 2つのtabで同じ実績を操作し、古いversionによる更新・削除が409となって最新一覧へ戻る。
- 401はSessionを破棄してログイン画面へ戻り、403は権限不足、404は対象なしとして区別する。
- 再読込後の一覧・合計とDB inspectが一致し、cleanup後の再inspectが0件となる。
- 一連の操作でブラウザの`warning`、`error`を増やさない。

## 勤怠月次workflowの初回確認項目

Backendの`attendance-month`専用fixtureを使用し、通常accountや通常業務データから分離して次を確認する。

- `USER`本人はDRAFT月の合計を確認して提出でき、提出済み・承認済み・締め済みは再送信できない。
- 未終了勤務・休憩がある月は画面で提出を抑止し、Backendも409で最終拒否する。
- `ATTENDANCE_MANAGER`は対象月・状態で一覧検索し、提出済みaccountの月合計と日別明細を確認できる。
- 空白だけの差戻し理由はAPI送信前に拒否し、理由付き差戻し後は本人画面へ理由を表示する。
- 差戻し月を本人が再提出し、確認者が任意コメント付きで承認できる。
- `ATTENDANCE_MANAGER`には締め操作を表示せず、`ATTENDANCE_CLOSE`を持つ担当だけが承認済み月を締められる。
- 更新buttonの連打で二重送信せず、古いversionの409後は詳細と一覧をBackend最新値へ戻す。
- 各roleの再ログインとページ再読込後も同じ状態を維持し、Spring SessionとCSRF以外の認証状態を保存しない。
- DB監査が提出・差戻し・再提出・承認・締めの順で5件となり、cleanup後の専用データが0件になる。
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

最初に、Codexの隔離環境からDocker socketへ接続できなかったため、通常データを変更しないFrontend API契約fixtureをVite middlewareとして一時使用した。Docker自体はRancher Desktop上で起動していた。fixtureは配布物・Git差分へ含めない。

- Sessionログイン後にProject一覧、標準3列Board、WBSの順で保護ルートを表示した。
- BoardのTask ID 101・102をWBSでも同じIDとして表示した。
- Summary 1件、Task 2件、Milestone 1件を親子順に表示し、WBSコード、予定期間、予定工数、進捗、担当者、優先度を確認した。
- Ganttへ切り替え、Summary bar、子Task bar、進捗、milestone、2026年8月の日付scaleを表示した。
- Gantt表示中の「再読込」、WBS URLのブラウザ再読込、同じProject Boardへの復帰が正常だった。
- 一連の操作でFrontendのconsole `warning`、`error`は0件だった。

続いてユーザー環境でDocker MySQL、`local,docker` Backend、Frontendを起動し、実MySQL・Spring Session JDBCを使って再確認した。

- `user01`でログインし、`JSESSIONID`を使う保護ルートからTodoカレンダーへ遷移した。
- Project一覧で`Work Management`、`OWNER`、利用中statusを表示した。
- Project Boardで既存Todo由来のTask 18件と標準3列を表示した。
- WBS階層表で同じTask 18件、予定期間、進捗、担当者、優先度を表示した。
- Ganttへ切り替え、Task tree、予定bar、日付scaleを表示した。
- 既存データに開始日より終了日が前のTask 1件があり、警告表示で検出した。
- DHTMLXの拡張初期値により不正日付Taskへ仮barが出たため、`show_unscheduled`を明示して左treeだけへ残すよう修正した。
- 修正fixtureでは不正日付Taskのbarが0件、tree行が1件であることを確認した。

Viteのcold start中に依存関係の事前bundle更新と重なったdynamic import失敗が一度記録されたが、最適化完了後の新規タブで再ログインしてWBSを直接開いた際は`warning`、`error`とも0件だった。production buildの不具合とは分けて扱う。

## 2026-08-22 Task依存関係の実施結果

Backendの`BROWSER-WBS-DEPENDENCY`専用fixtureをDocker MySQLへ投入し、`user01`で実ブラウザ回帰を行った。

- 初期`Design -> Implementation`、Finish-to-Start、待ち時間30分を1件表示した。
- 自己参照と初期依存の同方向重複はAPI送信前に拒否した。
- `Implementation -> Verification`、待ち時間60分を追加し、一覧を2件へ更新した。
- `Implementation -> Design`は循環としてBackendが拒否し、登録済み一覧を維持した。
- 追加した依存関係だけをversion付きで削除し、再読込後も初期1件だけを表示した。
- 安定表示後のブラウザconsoleはwarning 0件、error 0件だった。
- DB inspectでは初期依存だけが残り、cleanup後の再inspectは0件だった。

通常のProject、Todo、account、Sessionおよび他のブラウザ回帰fixtureは変更していない。

依存線表示をFrontendへ反映した後、同じfixtureを再投入してProject ID 5で追加回帰を行った。

- WBSの3行とGanttの3本のTask barに対し、初期依存線を1本だけ表示した。
- 依存線のアクセシブル名が`1 Browser Dependency Design (end) 2 Browser Dependency Implementation (start)`であり、Finish-to-Startの向きと両端Taskを確認できた。
- Gantt上のlink作成・編集controlは0件で、依存関係の編集経路が一覧Dialogだけに限定されていた。
- 画面内の「再読込」とブラウザ再読込後も依存線は1本のままで、重複しなかった。
- 安定表示後のブラウザconsoleはwarning 0件、error 0件だった。
- DB inspectではdependency ID 3の初期依存だけが残り、cleanup後の再inspectは0件だった。

これにより、Task依存関係V3の一覧編集と参照専用Gantt線の実ブラウザ回帰を完了した。採番値は実施記録の識別用であり、
fixtureの作成・削除は引き続き`project_key=BROWSER-WBS-DEPENDENCY`を使用する。
