# ADR（決めたことの記録）

ADR（Architecture Decision Record）は、設計上の大きな決定を「なぜそう決めたか」とともに1件1ファイルで残すものです。
設計書（`docs/frontend-architecture.md` 等）は「今どうなっているか」を書き、ADR は「なぜそうしたか、ほかに何を考えたか」を書きます。

## 一覧

| 番号 | 決定 | 状態 |
|---|---|---|
| [0001](0001-nuxt-ui-instead-of-vuetify.md) | UI 基盤を Vuetify 3 から Nuxt UI 4（Vite plugin）と Tailwind CSS 4 へ移す | 採用（デザインは段階的に移行中） |

認証（Cookie の Session）等、Backend と共通の決定は `todo-backend/docs/adr/` にあります。

## 書き方

`todo-backend/docs/adr/README.md` と同じです。

- ファイル名は `NNNN-英語の短い説明.md`。番号は欠番を作らず、採用しなかった決定も残す。
- 決定を変えるときは、元の ADR を書き換えず、新しい ADR を作って元の ADR の「状態」を「置き換え（NNNN）」にする。
- 見出しは「背景」「決定」「理由」「考えたほかの案」「影響」「関連資料」。
