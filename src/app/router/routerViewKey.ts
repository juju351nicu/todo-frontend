import type { RouteParamsGeneric } from "vue-router";

/**
 * 画面（`RouterView`の中のComponent）を作り直すかを決めるkeyを、route paramから作る。
 *
 * Vue Routerは、同じrouteのままparamだけが変わる遷移（通知から別ProjectのBoardを開く、ブラウザーの戻る操作で
 * `/projects/1/wbs`から`/projects/2/wbs`へ戻る等）ではComponentを再利用し、初期表示の処理を呼び直さない。
 * Board・WBSは初期表示でProjectのデータを読み、各領域のDialogや読込中のResponseを多く持つため、
 * Projectが変わったら画面を作り直し、前のProjectの表示・入力・遅れて届くResponseを残さない。
 *
 * - keyにするのは`projectId`だけ。query（`?taskId=`等）の変更では作り直さない（画面側がqueryを見て対応する）。
 * - `projectId`のないrouteはundefinedを返し、keyを付けない（これまでどおりComponentを再利用する）。
 *
 * @param params 現在のrouteのparam
 * @returns `projectId`があればその値（配列なら先頭）、なければundefined
 */
export const resolveRouterViewKey = (params: RouteParamsGeneric): string | undefined => {
  const projectId = params.projectId;
  return Array.isArray(projectId) ? projectId[0] : projectId;
};
