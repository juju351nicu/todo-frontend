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

/**
 * Nuxt UIの`color` propで使う色名。semantic color 6種に加え、移行前の画面がVuetifyのMaterial色名で
 * 指定していたteal・indigo・amber-darken-3・deep-purpleを同じ名前で使えるようにする。
 * 移行期間中はVuetifyの同名色class（`!important`付き）が優先されるため、Vuetifyと同じ色値の名前に限っている。
 * `vite.config.js`の`theme.colors`と`src/app/theme/main.css`の`@source inline`にも同じ一覧を指定する。
 */
export const themeColors = [
  "primary",
  "secondary",
  "success",
  "info",
  "warning",
  "error",
  "teal",
  "indigo",
  "amber-darken-3",
  "deep-purple",
] as const;

const semanticColors = themeColors;

// Vuetifyのelevated buttonは影付きで、hover時は前景色を4%重ねるだけなので背景をほぼ維持する。
const buttonSolidVariants = semanticColors.map((color) => ({
  color,
  variant: "solid" as const,
  class: `shadow-elevation-2 hover:bg-${color}/92 active:bg-${color}/88 disabled:opacity-40 aria-disabled:opacity-40 disabled:shadow-none`,
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

// Vuetify v-text-field既定のfilled表示（薄い背景・下線・上角だけ丸める）。Vuetifyのoutlinedは`outline`variantで表す。
const filledFieldClass =
  "text-default bg-black/4 hover:bg-black/8 focus:bg-black/12 focus-visible:bg-black/12 data-[state=open]:bg-black/12 " +
  "rounded-t-sm rounded-b-none border-b border-black/42 focus:border-primary focus-visible:border-primary " +
  "focus:shadow-[inset_0_-1px_0_0_var(--ui-primary)] focus-visible:shadow-[inset_0_-1px_0_0_var(--ui-primary)] focus-visible:outline-0";
const outlinedFieldClass =
  "text-default bg-default rounded-sm ring ring-inset ring-black/38 hover:ring-black/87 focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-0";

/** Vuetifyのdensity default（56px）とcompact（40px）をNuxt UIの`md`／`sm`へ対応させる。 */
const fieldSizeVariants = {
  sm: { base: "min-h-10 px-3 text-base gap-2", leading: "ps-3", trailing: "pe-3", leadingIcon: "size-6", trailingIcon: "size-6" },
  md: { base: "min-h-14 px-4 text-base gap-2", leading: "ps-3", trailing: "pe-3", leadingIcon: "size-6", trailingIcon: "size-6" },
};

const fieldTheme = {
  slots: {
    leadingIcon: "text-black/60",
    trailingIcon: "text-black/60",
  },
  variants: {
    size: fieldSizeVariants,
    variant: {
      soft: filledFieldClass,
      outline: outlinedFieldClass,
    },
  },
  compoundVariants: [
    { leading: true, size: "sm" as const, class: "ps-11" },
    { leading: true, size: "md" as const, class: "ps-12" },
    { trailing: true, size: "sm" as const, class: "pe-11" },
    { trailing: true, size: "md" as const, class: "pe-12" },
  ],
  defaultVariants: {
    variant: "soft" as const,
  },
};

export const nuxtUiTheme = {
  colors: {
    primary: "vuetify-primary",
    secondary: "vuetify-secondary",
    success: "vuetify-success",
    info: "vuetify-info",
    warning: "vuetify-warning",
    error: "vuetify-error",
    teal: "material-teal",
    indigo: "material-indigo",
    "amber-darken-3": "material-amber",
    "deep-purple": "material-deep-purple",
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
      // Vuetify 3.4の無効buttonは、塗りつぶし以外を26%、色付きの塗りつぶしを40%の不透明度で表す。
      base: "rounded-sm font-medium uppercase tracking-[.0892857143em] justify-center disabled:opacity-26 aria-disabled:opacity-26",
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
        class: "bg-default text-default shadow-elevation-2 hover:bg-elevated active:bg-accented disabled:shadow-none",
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
  // Vuetifyのv-text-fieldと同じく、ラベルを入力欄内の上部へ置き、下に補足・エラー用の22pxを確保する。
  // Vuetifyの`hide-details`に相当する箇所では、UFormFieldへ`class="pb-0"`を指定する。
  formField: {
    slots: {
      root: "relative pb-5.5 [&:has([data-slot=label])_[data-slot=base]]:pt-5",
      label: "absolute start-4 top-1.5 z-10 pointer-events-none text-xs leading-4 font-normal text-muted",
      error: "absolute start-4 bottom-0.5 mt-0 text-xs",
      help: "absolute start-4 bottom-0.5 mt-0 text-xs",
      hint: "text-xs",
    },
    variants: {
      orientation: {
        vertical: { container: "mt-0" },
      },
    },
  },
  input: fieldTheme,
  select: fieldTheme,
  selectMenu: fieldTheme,
  inputMenu: fieldTheme,
  textarea: {
    ...fieldTheme,
    variants: {
      ...fieldTheme.variants,
      size: {
        sm: { base: "px-3 pt-2 pb-2 text-base" },
        md: { base: "px-4 pt-4 pb-2 text-base" },
      },
    },
    compoundVariants: [],
  },
  // Vuetify v-dialog内のv-cardと同じ余白・影・scrim。Vuetifyのdialogには右上の閉じるbuttonがないため非表示にする。
  modal: {
    slots: {
      overlay: "bg-black/32",
      content: "rounded-sm shadow-elevation-24 ring-0 divide-y-0 text-default",
      header: "min-h-0 px-6 pt-4 pb-2.5 sm:px-6",
      title: "text-xl font-medium text-default",
      description: "text-sm text-muted",
      body: "px-6 pt-4 pb-6 sm:px-6 sm:pt-4 sm:pb-6 text-base",
      footer: "justify-end gap-2 px-4 py-2 sm:px-4",
      close: "hidden",
    },
  },
  // Vuetify v-tabsと同じく、区切り線なし・高さ48px・大文字表記で、選択中のtabだけprimary色と2pxの下線を付ける。
  tabs: {
    slots: {
      list: "p-0",
      trigger: "h-12 rounded-none px-4 uppercase tracking-[.0892857143em] data-[state=inactive]:text-black/60",
      content: "pt-4",
    },
    compoundVariants: [
      {
        orientation: "horizontal" as const,
        variant: "link" as const,
        class: { list: "border-b-0 mb-0", indicator: "bottom-0 h-0.5" },
      },
    ],
    defaultVariants: {
      variant: "link" as const,
    },
  },
  // Vuetify v-data-table（density compact）の行高40px・区切り線・見出し太さ。
  table: {
    slots: {
      th: "h-10 px-4 py-0 text-sm font-medium text-default whitespace-nowrap",
      td: "h-10 px-4 py-0 text-sm text-default whitespace-nowrap",
      separator: "bg-(--ui-border)",
      empty: "py-2 text-center text-sm text-default",
    },
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
      header: "px-4 sm:px-4 py-2 text-xl font-medium leading-8 tracking-[.0125em]",
      // Vuetifyはtitle直後のtextの上paddingを0にする。
      body: "p-4 sm:p-4 text-sm tracking-[.0178571429em] not-first:pt-0",
      footer: "flex items-center gap-2 p-2 sm:px-2 min-h-13",
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
