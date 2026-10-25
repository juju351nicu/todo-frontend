/**
 * Nuxt UIの全体テーマ。`vite.config.js`の`@nuxt/ui/vite`プラグインへ`ui`として渡す。
 *
 * 移行前のVuetify 3既定デザイン（Material Design）と同じ見た目を保つため、色・寸法・大文字表記・影を
 * Vuetifyの既定値へ合わせている。画面側では`class`による個別上書きを最小限にし、見た目の変更はこのファイルへ集約する。
 * 色の実値は`src/app/theme/main.css`の`@theme`で定義する。移行計画は`../nuxt-ui-migration-plan.md`を参照。
 *
 * Vuetifyとの対応:
 * - `variant`: tonal→`soft`、text→`ghost`、outlined→`outline`、elevated／flat→`solid`
 * - `size`: x-small→`xs`、small→`sm`、default→`md`、large→`lg`
 */

/** Nuxt UIのsemantic color名。`color` propとcompoundVariantsで使用する。 */
const semanticColors = ["primary", "secondary", "success", "info", "warning", "error"] as const;

// Vuetifyのelevated buttonは影付きで、hover時は前景色を4%重ねるだけなので背景をほぼ維持する。
const buttonSolidVariants = semanticColors.map((color) => ({
  color,
  variant: "solid" as const,
  class: `shadow-elevation-2 hover:bg-${color}/92 active:bg-${color}/88`,
}));

// Vuetifyのoutlinedは前景色そのものの枠線、tonalは前景色12%の背景を使う。
const buttonOutlineVariants = semanticColors.map((color) => ({
  color,
  variant: "outline" as const,
  class: `ring-${color} hover:bg-${color}/4`,
}));
const buttonSoftVariants = semanticColors.map((color) => ({
  color,
  variant: "soft" as const,
  class: `bg-${color}/12 hover:bg-${color}/16 active:bg-${color}/20`,
}));
const buttonGhostVariants = semanticColors.map((color) => ({
  color,
  variant: "ghost" as const,
  class: `hover:bg-${color}/4 active:bg-${color}/12`,
}));

// Vuetifyのv-alertは塗りつぶし（既定）とtonalで、tonalは前景色12%の背景を使う。
const alertSoftVariants = semanticColors.map((color) => ({
  color,
  variant: "soft" as const,
  class: { root: `bg-${color}/12` },
}));

const badgeSoftVariants = semanticColors.map((color) => ({
  color,
  variant: "soft" as const,
  class: `bg-${color}/12`,
}));
const badgeOutlineVariants = semanticColors.map((color) => ({
  color,
  variant: "outline" as const,
  class: `ring-${color}`,
}));

export const nuxtUiTheme = {
  colors: {
    primary: "vuetify-primary",
    secondary: "vuetify-secondary",
    success: "vuetify-success",
    info: "vuetify-info",
    warning: "vuetify-warning",
    error: "vuetify-error",
    neutral: "neutral",
  },
  // Vuetifyと同じMDIの図柄を使い、Nuxt UI既定のLucideとアイコンが混在しないようにする。
  icons: {
    arrowDown: "i-mdi-arrow-down",
    arrowLeft: "i-mdi-arrow-left",
    arrowRight: "i-mdi-arrow-right",
    arrowUp: "i-mdi-arrow-up",
    caution: "i-mdi-alert-circle",
    check: "i-mdi-check",
    chevronDoubleLeft: "i-mdi-chevron-double-left",
    chevronDoubleRight: "i-mdi-chevron-double-right",
    chevronDown: "i-mdi-menu-down",
    chevronLeft: "i-mdi-chevron-left",
    chevronRight: "i-mdi-chevron-right",
    chevronUp: "i-mdi-menu-up",
    close: "i-mdi-close",
    copy: "i-mdi-content-copy",
    copyCheck: "i-mdi-check",
    ellipsis: "i-mdi-dots-horizontal",
    error: "i-mdi-close-circle",
    external: "i-mdi-open-in-new",
    eye: "i-mdi-eye",
    eyeOff: "i-mdi-eye-off",
    info: "i-mdi-information",
    loading: "i-mdi-loading",
    menu: "i-mdi-menu",
    minus: "i-mdi-minus",
    plus: "i-mdi-plus",
    reload: "i-mdi-refresh",
    search: "i-mdi-magnify",
    success: "i-mdi-check-circle",
    warning: "i-mdi-alert",
  },
  button: {
    slots: {
      base: "rounded-sm font-medium uppercase tracking-[.0892857143em] justify-center",
    },
    variants: {
      size: {
        xs: { base: "h-5 px-2 text-[0.625rem] gap-1", leadingIcon: "size-3.5", trailingIcon: "size-3.5" },
        sm: { base: "h-7 px-3 text-xs gap-1.5", leadingIcon: "size-4", trailingIcon: "size-4" },
        md: { base: "h-9 px-4 text-sm gap-2", leadingIcon: "size-4.5", trailingIcon: "size-4.5" },
        lg: { base: "h-11 px-5 text-base gap-2", leadingIcon: "size-5", trailingIcon: "size-5" },
        xl: { base: "h-13 px-6 text-lg gap-2", leadingIcon: "size-6", trailingIcon: "size-6" },
      },
    },
    compoundVariants: [
      ...buttonSolidVariants,
      ...buttonOutlineVariants,
      ...buttonSoftVariants,
      ...buttonGhostVariants,
      // 色指定なしのVuetify buttonはsurface色（白背景・影付き）で表示される。
      {
        color: "neutral" as const,
        variant: "solid" as const,
        class: "bg-default text-default shadow-elevation-2 hover:bg-elevated active:bg-accented",
      },
      { color: "neutral" as const, variant: "outline" as const, class: "ring-current bg-transparent" },
      { color: "neutral" as const, variant: "soft" as const, class: "bg-inverted/12 hover:bg-inverted/16" },
      // Vuetifyのicon buttonは正方形ではなく円形で、寸法はsizeの高さと同じになる。
      { square: true, size: "xs" as const, class: "size-5 p-0 rounded-full" },
      { square: true, size: "sm" as const, class: "size-7 p-0 rounded-full" },
      { square: true, size: "md" as const, class: "size-9 p-0 rounded-full" },
      { square: true, size: "lg" as const, class: "size-11 p-0 rounded-full" },
    ],
    defaultVariants: {
      color: "neutral" as const,
      variant: "solid" as const,
    },
  },
  alert: {
    slots: {
      root: "rounded-sm px-4 gap-4 items-start",
      icon: "size-7",
      title: "text-xl font-medium",
      description: "text-base opacity-100",
      close: "text-current",
    },
    compoundVariants: [...alertSoftVariants],
  },
  badge: {
    slots: {
      base: "rounded-full font-normal",
    },
    variants: {
      size: {
        xs: { base: "h-5 px-2 text-[0.625rem] gap-1 rounded-full" },
        sm: { base: "h-6.5 px-2.5 text-xs gap-1 rounded-full" },
        md: { base: "h-8 px-3 text-sm gap-1.5 rounded-full" },
        lg: { base: "h-9.5 px-3.5 text-base gap-1.5 rounded-full" },
      },
    },
    compoundVariants: [
      ...badgeSoftVariants,
      ...badgeOutlineVariants,
      { color: "neutral" as const, variant: "soft" as const, class: "bg-inverted/12 text-default" },
      { color: "neutral" as const, variant: "outline" as const, class: "ring-current text-default" },
    ],
    // Vuetifyのv-chipは色指定なしで前景色12%のtonal表示になる。
    defaultVariants: {
      color: "neutral" as const,
      variant: "soft" as const,
    },
  },
  card: {
    slots: {
      root: "rounded-sm",
      header: "px-4 py-2 text-xl font-medium leading-8 tracking-[.0125em]",
      // Vuetifyはtitle直後のtextの上paddingを0にする。
      body: "p-4 text-sm tracking-[.0178571429em] not-first:pt-0",
      footer: "flex items-center gap-2 p-2 min-h-13",
    },
    variants: {
      variant: {
        // Vuetifyのv-card既定（elevated）。
        solid: {
          root: "bg-default text-default shadow-elevation-1",
          title: "text-default",
          description: "text-muted",
        },
        outline: {
          root: "bg-default ring-0 border border-default divide-y-0",
        },
        soft: {
          root: "bg-inverted/12 divide-y-0",
        },
        subtle: {
          root: "bg-elevated/50 ring-0 border border-default divide-y-0",
        },
      },
    },
    defaultVariants: {
      variant: "solid" as const,
    },
  },
};
