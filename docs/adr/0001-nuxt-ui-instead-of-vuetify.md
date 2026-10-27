# 0001. UI 基盤を Vuetify 3 から Nuxt UI 4（Vite plugin）と Tailwind CSS 4 へ移す

- 状態: 採用（見た目は段階的に移行中。§影響）
- 記録日: 2026-10-28（移行は 2026-10。todo-frontend PR #2）

## 背景

画面は Vuetify 3 で作っていました。AI（Claude Code・Codex）と並走して画面を作るようになり、次の問題がありました。

- Vuetify は `density`・`variant`・`elevation`・`ma-2` 等の独自の API が多く、バージョン2と3の書き方を AI が混同しやすい。
- 見た目がどこで決まっているか（コンポーネントの props、独自の class、上書きの CSS）が散らばり、AI も人も追いにくい。
- E2E のセレクターが `.v-card` 等のライブラリ内部の class に依存していた。

## 決定

- UI 基盤を **Nuxt UI 4** と **Tailwind CSS 4** にする。Nuxt には移らず、素の Vue 3（Vite）に `@nuxt/ui/vite` の plugin で入れる。
- 見た目の既定は `src/app/theme/nuxtUiTheme.ts`（コンポーネントの寸法・variant）と `src/app/theme/main.css`（色・breakpoint・共通 utility）の2ファイルに集める。画面側の `class` で個別に上書きしない。
- アイコンは `i-mdi-*`（`@iconify-json/mdi`）を使い、移行前と同じ図柄にする。
- 移行は Vuetify と一時的に共存させながら画面ごとに進め、すべてのコミットで build・typecheck・test が通る状態を保った。Vuetify は削除済みで、再び入れない。
- 移行の時点では、見た目を Vuetify の既定に合わせた。その後、参考デザインへ段階的に寄せている（配色は完了）。

## 理由

- Tailwind の class は AI の学習データに多い書き方なので、AI が意図どおりに書きやすい。
- 公式の AI 向け資料（`https://ui.nuxt.com/llms.txt`）と MCP サーバー（`https://ui.nuxt.com/mcp`）があり、AI が最新の props・slots を確かめられる。
- テーマを1か所に集められるので、「見た目がどこで決まるか」が分かりやすい。
- Reka UI をもとにしており、アクセシビリティの属性がそろう。Playwright で `getByRole`・`getByLabel` が使いやすく、E2E がライブラリ内部の class に依存しなくなる。

## 考えたほかの案

| 案 | 選ばなかった理由 |
|---|---|
| Vuetify 3 を続ける | 上の背景の問題が残る。AI が書き方を混同しやすい |
| Nuxt へ移り、Nuxt UI を使う | ルーティング・ビルド・SSR の前提まで変わり、変更が大きすぎる。Vite plugin で Nuxt UI だけ使える |
| 一度にすべての画面を書き換える | `.vue` 57ファイル・Vuetify のタグ約1,600か所あり、途中で動作を確かめられない |

## 影響

- 良くなること：AI が画面を書きやすく、見た目の既定が2ファイルにまとまった。E2E のセレクターが role・label になった。
- 気をつけること：
  - 移行前の Vuetify に合わせた寸法（button の大文字表記・字間・影・高さ、card の影、入力欄の欄内ラベル、table・modal・tabs・badge の寸法）が、まだ `nuxtUiTheme.ts`・`main.css` に残っている。参考デザインへ寄せるときは、この2ファイルを減らす。
  - FullCalendar・dhtmlx-gantt・vuedraggable は移行の対象外（周りの UI だけ移した）。
  - Vite 8（rolldown）で遅延読み込みの route が白画面になるため、`vite.config.js` で UI 基盤を `vendor-ui` chunk にまとめている。外すと再発する。
  - Nuxt UI の型宣言は build のときに生成されるため、CI は build → typecheck → test の順に実行する。
- あとで決めること：デザイン移行の残りの段階（badge と警告の色の見分け、button、card、入力欄、table・modal・tabs・badge の寸法）。

## 関連資料

- `docs/frontend-architecture.md` の「UI基盤（Nuxt UI）」
- `AGENTS.md` の「UI（Nuxt UI）」（variant・size の対応表、breakpoint）
- リポジトリ外の資料：`../nuxt-ui-migration-plan.md`（移行の計画・経緯・対応表）
