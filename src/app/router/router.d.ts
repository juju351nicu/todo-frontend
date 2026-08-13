import "vue-router";

import type { PermissionCode } from "@/features/auth/types/auth";

export {};

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    /** 画面表示に1件以上必要なBackend permission。最終認可はBackendで再検査する。 */
    requiredAnyPermissions?: readonly PermissionCode[];
  }
}
