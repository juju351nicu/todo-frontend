# Work Management Frontend コーディング規約

この規約は、Vue 3・TypeScriptで構成するFrontendを、人間とClaude Code、Codex等のAIコーディングツールが同じ判断で変更できる状態に保つための基準である。既存コードを変更する場合も、変更範囲をこの規約へ段階的に寄せる。

## TypeScriptと機能構成

- 新規コードはTypeScriptで作成し、`any`で型エラーを回避しない。外部入力は`unknown`から検証して扱う。
- BackendのRequest／Response、画面フォーム、表示用データを必要に応じて分離する。
- Backend API呼出しはfeatureの`api`、画面状態と操作は`composables`、画面をまたぐ状態だけを`stores`へ置く。
- 最初からcomposableを細分化せず、1画面につき1つの`useXxxPage`を基本とする。
- 複数機能で共用するものだけを`shared`へ置き、`shared`から個別featureへ依存させない。

## JSDoc

次の要素には、名前だけでは分からない責務と契約をJSDocで記載する。

- exportedなfunction、composable、API関数、Store action、共通utility
- Backend APIや業務コードを表すtype、interface、主要なproperty
- Props、Emit、Slotに非自明な制約があるVue Component
- internalなfunctionのうち、非同期副作用、認証・CSRF、画面遷移、特殊なnull・既定値、Backend形式変換を扱うもの

JSDocには必要に応じて次を含める。

- 何を担当し、何を担当しないか
- `@param`: 値の意味、単位、許容範囲
- `@returns`: Promiseの成功結果、空配列、null・undefinedの扱い
- `@throws`: 呼出側が対処すべき例外と発生条件
- BackendのAPIパス、snake_case、コード値等との対応
- Session、CSRF、個人情報に関する安全条件

### 後続の人間・AIへ残す最低契約

JSDocはチャット、口頭説明、Gitのコミットメッセージがなくても、対象コードを安全に利用・変更できる情報を残す。すべての項目を機械的に埋めるのではなく、対象に該当するものだけを具体的に記載する。

- composable: 担当する画面状態と操作、返すref／computedの意味、呼び出すAPI、Router・Store・通知等の副作用、初期化と再読込の条件、エラー時の状態。
- API関数: HTTPメソッドと用途、認証・CSRFの前提、Request／Responseの意味、204・空配列・nullの扱い、呼出側が区別すべき失敗条件。単純な共通Client委譲では、パスをコードから読める場合に重複記載しなくてよい。
- Store action・utility: 変更する共有状態、永続化の有無、再実行時の契約、外部状態や時刻への依存。
- type・interface・property: Backend項目との対応、コード体系、日時・数値の単位、null・未指定の意味、画面専用かAPI境界か。名称とTypeScript型だけで明白なpropertyへ重複説明は書かない。
- 互換処理・回避策: 守っているBackend／ブラウザ仕様、Vue・Pinia・Router・外部ライブラリの制約、削除できる条件。根拠が設計資料にある場合は、リポジトリ相対パスと見出しを記載する。

「上記の対応」「例の仕様」「念のため」「一時的に」のように参照先や終了条件が分からない表現は使わない。確定した契約と推測を混ぜず、未確定事項はIssueまたは計画資料へ移す。JSDocの量や行数を増やすこと自体は品質ではない。

```ts
/**
 * 現在のHttpSessionから認証利用者を復元する。
 *
 * @returns 認証中は利用者情報、未認証の場合はnull
 * @throws Backendへ接続できず、認証有無を判定できない場合
 */
export const fetchSessionUser = async (): Promise<SessionUserResponse | null> => {
  // 401は通信失敗ではなく「未認証」という正常な状態として呼出側へ返す。
  // ...
};
```

型名や関数名の単なる言い換えは避ける。例えば「Todoを取得する」だけで終わらせず、一覧条件、対象利用者、空結果、エラー時の契約等、呼出側の判断に必要な情報を書く。
実装に存在しない例外、再試行、キャッシュ等の保証を説明へ追加してはならない。

## `//`コメント

- `//`は、互換性維持、Vueのreactivity／lifecycle、非同期処理順、セキュリティ条件、ライブラリの制約等の「なぜ」を対象コードの直前へ書く。
- Backendの旧JSON名を受ける、CSRF取得後に更新APIを呼ぶ、Router guardでSession復元を待つ等、順序を変えると壊れる処理には理由を書く。
- 楽観的更新のrollback、複数リクエストの競合回避、watchの停止、Event伝播抑止等は、どの不整合や二重実行を防いでいるかを書く。
- コメントだけを別の場所へ残さず、説明対象の分岐・呼出し・設定の直前へ置く。離れた設計判断は資料へ記載し、コメントから資料を参照する。
- `loading = true`に「ローディングを開始」、`if`に「条件分岐」等の逐語的コメントは追加しない。
- コメントで複雑さを隠さず、先に関数抽出、型定義、命名改善を検討する。
- `TODO`、`FIXME`を残す場合は、解消条件と参照するIssueまたは計画資料を併記する。
- コメントアウトした旧実装、デバッグ用`console.log`を残さない。変更履歴はGitで管理する。

```ts
// 悪い例: Sessionを取得する。
await authStore.restoreSession();

// 良い例: 認証判定前に保護画面を描画しないよう、初回遷移だけSession復元の完了を待つ。
await authStore.restoreSession();
```

処理を読めば分かる「何をしたか」は書かず、コードだけでは失われる「なぜこの順序・分岐・値なのか」を書く。ただし命名、型、computed、function抽出で十分に表現できる内容へコメントを追加しない。

コメントは日本語を基本とし、Vue、Pinia、Router、CSRF等の公式用語は原語を使用する。実装変更でコメントが古くなった場合は、同じ変更で更新または削除する。

## Vue Component

- `views`は画面全体を組み立て、処理を画面composableへ委譲する。
- `components`はPropsとEmitを中心とし、Backend APIを直接呼ばない。
- PropsとEmitは型を明示する。boolean Propsの既定値や更新Event等、利用側が誤解しやすい契約にはJSDocを書く。
- Template内へ複雑な条件式を置かず、意味の分かるcomputedまたはfunctionへ抽出する。

## 認証・API

- 全APIリクエストで`credentials: "include"`を使用する。
- 更新系APIでは共通HTTPクライアントからCSRFヘッダーを設定する。
- 401は認証状態を破棄してログインへ戻し、403は権限不足として区別する。
- Session ID、OAuth token、パスワードをconsole、URL、Web Storageへ出さない。
- APIのRequest／Response変更はBackendのOpenAPI定義と照合する。

## 検証とレビュー

```bash
npm run typecheck
npm run test
npm run build
```

- [ ] feature、app、sharedの責務と依存方向を守っている。
- [ ] exported APIと業務上の型へ、契約が分かるJSDocを書いている。
- [ ] JSDocだけで責務、前提、戻り値、主要な副作用、失敗条件を判断でき、チャット履歴や曖昧な指示語へ依存していない。
- [ ] 非自明な副作用・処理順・互換対応へ、理由が分かる`//`コメントを書いている。
- [ ] 実装の逐語訳、推測、不要・古いコメント、コメントアウトした旧コードを残していない。
- [ ] Session、CSRF、秘密情報を安全に扱っている。
- [ ] 型検査、テスト、production buildが成功している。
