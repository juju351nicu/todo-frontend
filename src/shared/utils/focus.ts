import { nextTick } from "vue";

/**
 * `data-*`属性の値から、その部品を探すselectorを作る関数を返す。
 *
 * フォーカスの戻し先は、templateで`data-*`属性を付けた部品を、composableがselectorで探し直す。
 * 属性名はtemplate側では文字列で書くしかないため、composable側はこの関数で属性名を1か所に書く。
 *
 * @param attributeName 部品に付けた属性の名前（例: `data-dashboard-control`）
 * @returns 属性の値を受け取り、`[属性名="値"]`のselectorを返す関数
 */
export const createDataAttributeSelector =
  (attributeName: `data-${string}`) =>
  (value: string): string =>
    `[${attributeName}="${value}"]`;

/**
 * 次の描画の後、候補のselectorを先頭から順に探し、最初に見つかった操作できる（disabledでない）要素へフォーカスを移す。
 *
 * 更新中に操作部品をdisabledにする画面では、押した部品からフォーカスが外れ（`document.activeElement`がbody）、
 * キーボードだけでは続けて操作できなくなる。更新後は一覧の再描画で別の要素になることがあるため、
 * 要素の参照ではなく`data-*`属性等のselectorで探し直す。
 *
 * - 呼出側は、処理中フラグをfalseへ戻した**後**に呼ぶ（disabledの解除が描画されてから探すため`nextTick`を待つ）。
 * - DOMのない実行環境（単体テスト）では何もしない。
 * - どの候補も見つからない・すべてdisabledの場合は何もしない（フォーカスは動かさない）。
 *
 * @param selectors フォーカスを移す要素のselector（優先順）
 */
export const focusFirstEnabledElement = async (selectors: readonly string[]): Promise<void> => {
  await nextTick();
  if (typeof document === "undefined") {
    return;
  }
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && !element.matches(":disabled")) {
      element.focus();
      return;
    }
  }
};
