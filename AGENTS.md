# Work Management Frontend 作業指示

Codex等のAIコーディングツールは、変更前にこのファイル、`docs/coding-guidelines.md`、`docs/frontend-architecture.md`を最後まで読むこと。

## 実装原則

- TypeScriptを使用し、機能は`src/features/<feature>`、全体構成は`src/app`、複数機能の共通処理は`src/shared`へ配置する。
- 依存方向は`view -> composable -> store/api -> shared/api`とし、ComponentからBackend APIを直接呼ばない。
- 画面の状態と操作は、最初は1画面につき1つの`useXxxPage`へまとめる。再利用可能な独立責務が明確になった場合だけ分割する。
- Backend認証はSpring Session JDBCの`JSESSIONID`とCSRFを使用する。JWT、Session ID、OAuth token、パスワードをWeb Storageやログへ保存しない。
- BackendのRequest／Responseとの変換を境界へ集約し、画面内にsnake_case変換や既定値処理を散らさない。

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

Node.js 24で`npm run typecheck`、`npm run test`、`npm run build`を実行する。
