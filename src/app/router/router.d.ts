import "vue-router";

import type { PermissionCode } from "@/features/auth/types/auth";

export {};

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    /** 画面表示に1件以上必要なBackend permission。最終認可はBackendで再検査する。 */
    requiredAnyPermissions?: readonly PermissionCode[];
    /** `"blank"`の場合はヘッダー・サイドメニューを持つ共通レイアウトを使用しない。未指定は共通レイアウト。 */
    layout?: "blank";
  }
}
