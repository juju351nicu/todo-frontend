/**
 * Prettierの整形規則。
 *
 * 導入前のコードの書き方（二重引用符、文末のセミコロン、2文字の字下げ、
 * 複数行の関数呼出しの最後の引数にはカンマを付けない）に合わせ、整形による差分を小さくしている。
 * 1行の長さは、導入前のコードとの差分が最も小さかった100文字にする。
 *
 * @type {import("prettier").Config}
 */
export default {
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  // 配列・objectの最後の要素にはカンマを付け、関数の引数には付けない（導入前の書き方）。
  trailingComma: "es5",
  endOfLine: "lf",
};
