# Work Management Frontend 作業指示

Codex等のAIコーディングツールは、変更前にこのファイル、`docs/coding-guidelines.md`、`docs/frontend-architecture.md`を最後まで読むこと。

## 実装原則

- TypeScriptを使用し、機能は`src/features/<feature>`、全体構成は`src/app`、複数機能の共通処理は`src/shared`へ配置する。
- 依存方向は`view -> composable -> store/api -> shared/api`とし、ComponentからBackend APIを直接呼ばない。
- 画面の状態と操作は、最初は1画面につき1つの`useXxxPage`へまとめる。再利用可能な独立責務が明確になった場合だけ分割する。
- Backend認証はSpring Session JDBCの`JSESSIONID`とCSRFを使用する。JWT、Session ID、OAuth token、パスワードをWeb Storageやログへ保存しない。
- BackendのRequest／Responseとの変換を境界へ集約し、画面内にsnake_case変換や既定値処理を散らさない。
- 旧タスク管理製品から移植したコード・文言に含まれていた名称はFrontendへ再混入させず、比較調査はリポジトリ外の資料フォルダで行う。

## UI（Nuxt UI）

- UIはNuxt UI（`@nuxt/ui`、Vite plugin経由）とTailwind CSSで実装する。Vuetifyは削除済みのため再導入しない。Component APIは`https://ui.nuxt.com/llms.txt`または公式MCP（`https://ui.nuxt.com/mcp`）で確認する。
- 見た目は移行前のVuetify既定デザインに合わせている。色・寸法・variantの既定は`src/app/theme/nuxtUiTheme.ts`、色tokenとbreakpoint・共通utilityは`src/app/theme/main.css`に集約し、画面側の`class`で個別に上書きしない。Nuxt UI本来のデザインへ寄せる場合もこの2ファイルから変更する。
- variantの対応: Vuetifyのtonal→`soft`、text→`ghost`、outlined→`outline`、elevated／flat→`solid`。sizeはx-small→`xs`、small→`sm`、default→`md`、large→`lg`。
- 共通部品を優先する: 状態alertは`StatusAlert`、自動で消える通知は`AppAlert`、toast相当は`AppSnackbar`、並べ替え・ページング付き一覧は`AppDataTable`、素のtableは`app-table`utility、検索欄は`SearchField`、文字数表示は`FieldCounter`、本文幅は`page-container`utility。
- 入力Dialogのform同期・close・送信は`useDialogForm`、親が確定した検索条件の下書きは`useSyncedDraft`を使う。
- 選択UI（Reka UI）は空文字とnullの選択肢を扱えない。「すべて」「最上位」等は専用値にし、composableまたはDialogの境界で変換する。
- Tailwindのbreakpointは`main.css`でVuetifyと同じ値（sm 600px、md 960px、lg 1280px、xl 1920px）にしている。
- `h()`等の描画関数でNuxt UI Componentを直接importしない（rolldownのchunk分割で初期化順が崩れた実績がある）。UTable等はslotでテンプレートに書く。
- アイコンは`i-mdi-*`（`@iconify-json/mdi`）を使い、buildへ同梱する。
- E2EのselectorはUIライブラリ内部のclassに依存させず、role・label・意味を持つ独自class（`task-card`等）を使う。

## JSDocとコメント

- exportedなfunction、composable、API関数、Store action、共通utility、業務上の型には、責務と契約が分かるJSDocを書く。
- internalなfunctionでも、非同期副作用、認証、CSRF、画面遷移、特殊なnull・既定値、Backend形式変換がある場合はJSDocを書く。
- JSDocとコメントはチャット履歴を前提にせず、そのファイルと参照先の設計資料だけで後続の人間・AIが判断できる内容にする。曖昧な「上記」「例の対応」「一時的に」は使用しない。
- `//`は「何をしているか」の言い換えではなく、互換性、Vueのreactivity／lifecycle、処理順、セキュリティ、外部ライブラリ制約等の「なぜ」を直前に記載する。
- 自明な代入、条件分岐、型名の繰り返しコメントは追加しない。コメントアウトした旧コードは残さない。
- コメント数を増やすこと自体を目的にしない。命名、型、computed、function抽出で明確になる場合はコードを改善し、なお残る契約・判断理由だけをコメントする。
- 実装変更でコメントが古くなった場合は、同じ変更で更新または削除する。
- 作業完了前に、新規・変更したexport、composable、API、Store action、業務上の型を見直し、必要なJSDocと`//`が不足していないか、不要・陳腐化したコメントが残っていないか確認する。

## 検証

Node.js 24で`npm run build`、`npm run typecheck`、`npm run test`を実行する。Nuxt UIのVite pluginはbuild時にComponent型宣言（`components.d.ts`等）を生成するため、clone直後はbuildを先に実行してから型検査する。

- 新規・変更したAPI、composable、Store、業務utilityにはVitestを同じ変更で追加または更新する。
- 正常系だけでなく、入力境界、null・空、401、403、404、409、通信失敗、二重送信、再読込・rollback等、対象処理に実在する異常系を優先して検証する。
- APIのmethod・path・Request形式、composableのAPI非実行条件・Router遷移・Session破棄・Store更新もassertする。
- テストで不具合を発見した場合は原因を修正し、その事象を再現する回帰テストを残す。
- 境界値、状態遷移、API Request変換、競合回復等の高リスク変更では、代表的な実装条件を一時的に誤らせ、VitestまたはPlaywrightが意図した理由で失敗することを確認する。故意変更は必ず復元し、復元後の成功まで確認して、変異コードをコミットしない。
- Backend変更を伴う場合は該当JUnitと`./mvnw verify`も実行する。
- repository conventionのVitestを維持し、exportedな型・関数とAPI境界のJSDoc記載漏れを新規変更で増やさない。composable内の非自明な副作用・変換は自動検査対象外でも必ずレビューする。
