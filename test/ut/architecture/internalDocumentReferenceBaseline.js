/**
 * コメントに資料の番号の書き方（改善提案の番号・動作確認の項目のパス・動作確認資料の略称・開発段階名・§番号）が
 * 残っているファイルと件数。`repositoryConvention.spec.js`が、この値と実際の件数の一致を検査する。
 * コメントを業務上の意味と理由の文へ書き直して件数が減ったら、同じ変更でこの値も減らす（0になった行は消す）。
 * 新しいファイル・行を足してはいけない（`docs/coding-guidelines.md`「資料を知らない人が読めるコメントにする」）。
 */
export const INTERNAL_DOCUMENT_REFERENCE_BASELINE = Object.freeze({});
