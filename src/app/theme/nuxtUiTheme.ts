/**
 * Nuxt UIの全体テーマ。`vite.config.js`の`@nuxt/ui/vite`プラグインへ`ui`として渡す。
 *
 * 移行前のVuetify 3既定デザイン（Material Design）を、参考デザイン（濃い紫のサイドバー、ピンクの主要button、
 * プラムのアクセント）へ段階的に寄せた（2026-10）。buttonとtabは大文字表記・字間・固定の高さをやめ、cardは影の代わりに枠線、
 * 入力欄はラベルを欄の上に出す枠線表示、badgeは高さを余白で決める。表の行の高さ（40px）は移行前のまま残している。
 * 画面側では`class`による個別上書きを最小限にし、見た目の変更はこのファイルへ集約する。
 * 色の実値は`src/app/theme/main.css`の`@theme`で定義する。移行計画は`../検討メモ/nuxt-ui-migration-plan.md`を参照。
 *
 * Vuetifyとの対応:
 * - `variant`: tonal→`soft`、text→`ghost`、outlined→`outline`、elevated／flat→`solid`
 * - `size`: x-small→`xs`、small→`sm`、default→`md`、large→`lg`
 */

/**
 * Nuxt UIの`color` propで使う色名。semantic color 6種に加え、移行前の画面がVuetifyのMaterial色名で
 * 指定していたteal・indigo・amber-darken-3・deep-purpleを同じ名前で使えるようにする。
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

// 塗りつぶしbuttonは影を付けない。Nuxt UI既定のhover（75%）では白文字とのコントラストが下がるため、背景をほぼ維持する。
const buttonSolidVariants = semanticColors.map((color) => ({
  color,
  variant: "solid" as const,
  class: `hover:bg-${color}/92 active:bg-${color}/88 disabled:opacity-40 aria-disabled:opacity-40`,
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

// 薄い背景・下線・上角だけ丸めるfilled表示（移行前のVuetify v-text-field既定）。`variant="soft"`を明示した場合だけ使う。
const filledFieldClass =
  "text-default bg-black/4 hover:bg-black/8 focus:bg-black/12 focus-visible:bg-black/12 data-[state=open]:bg-black/12 " +
  "rounded-t-sm rounded-b-none border-b border-black/42 focus:border-primary focus-visible:border-primary " +
  "focus:shadow-[inset_0_-1px_0_0_var(--ui-primary)] focus-visible:shadow-[inset_0_-1px_0_0_var(--ui-primary)] focus-visible:outline-0";
// 入力欄の既定。白背景に枠線を付け、フォーカス中は主色の2pxの枠線にする（参考デザインのoutline）。
const outlinedFieldClass =
  "text-default bg-default rounded-sm ring ring-inset ring-black/38 hover:ring-black/87 focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-0";

/** ラベルを入力欄の外（上）に出すため、入力欄の中にラベルの高さを確保しない。`md`は40px、`sm`は36px。 */
const fieldSizeVariants = {
  sm: { base: "min-h-9 px-3 text-sm gap-2", leading: "ps-3", trailing: "pe-3", leadingIcon: "size-5", trailingIcon: "size-5" },
  md: { base: "min-h-10 px-3 text-sm gap-2", leading: "ps-3", trailing: "pe-3", leadingIcon: "size-5", trailingIcon: "size-5" },
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
    { leading: true, size: "sm" as const, class: "ps-10" },
    { leading: true, size: "md" as const, class: "ps-10" },
    { trailing: true, size: "sm" as const, class: "pe-10" },
    { trailing: true, size: "md" as const, class: "pe-10" },
  ],
  defaultVariants: {
    variant: "outline" as const,
  },
};

export const nuxtUiTheme = {
  // 色名とpaletteの対応。brand・plumは`main.css`で定義した独自palette、それ以外はTailwind標準palette。
  // 移行前のMaterial色名（teal等）は画面側の指定を変えずに、近いTailwind paletteへ対応させる。
  colors: {
    primary: "brand",
    secondary: "plum",
    success: "green",
    info: "sky",
    // orangeはprimary（ピンク）・error（赤）と同じ赤系に見えるため、黄系のyellowで「注意」を見分けやすくする。
    warning: "yellow",
    error: "red",
    teal: "teal",
    indigo: "indigo",
    "amber-darken-3": "amber",
    "deep-purple": "violet",
    // 参考デザインの温かみのある灰色の背景・文字に合わせる。
    neutral: "stone",
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
      // 大文字表記・字間は付けない（日本語の文言には効かず、英字のラベルだけが目立つため）。
      // 無効buttonは、塗りつぶし以外を26%、色付きの塗りつぶしを40%の不透明度で表す。
      base: "rounded-sm font-medium justify-center disabled:opacity-26 aria-disabled:opacity-26",
    },
    variants: {
      // 高さは固定せず、上下の余白で決める（文言が折り返しても文字がはみ出さない）。
      size: {
        xs: { base: "px-2 py-0.5 text-[0.625rem] gap-1", leadingIcon: "size-3.5", trailingIcon: "size-3.5" },
        sm: { base: "px-3 py-1.5 text-xs gap-1.5", leadingIcon: "size-4", trailingIcon: "size-4" },
        md: { base: "px-4 py-2 text-sm gap-2", leadingIcon: "size-4.5", trailingIcon: "size-4.5" },
        lg: { base: "px-5 py-2.5 text-base gap-2", leadingIcon: "size-5", trailingIcon: "size-5" },
        xl: { base: "px-6 py-3 text-lg gap-2", leadingIcon: "size-6", trailingIcon: "size-6" },
      },
    },
    compoundVariants: [
      ...buttonSolidVariants,
      ...buttonOutlineVariants,
      ...buttonSoftVariants,
      ...buttonGhostVariants,
      // 色指定なしのbuttonは白背景で表示する。影を付けないため、白い背景の上でも見えるよう枠線を付ける。
      {
        color: "neutral" as const,
        variant: "solid" as const,
        class: "bg-default text-default ring ring-inset ring-accented hover:bg-elevated active:bg-accented",
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
  // ラベルは入力欄の上に置く（入力欄に重ねない。アイコンや入力値と重ならず、狭い画面でも読める）。
  // 下に補足・エラー用の22pxを確保し、補足・エラーは入力欄の下へ通常の流れで置く。
  // 補足・エラーを出さない検索欄等では、UFormFieldへ`class="pb-0"`を指定する。
  formField: {
    slots: {
      root: "relative pb-5.5 has-[[data-slot=help]]:pb-0 has-[[data-slot=error]]:pb-0",
      label: "block text-sm leading-5 font-medium text-default",
      error: "mt-0 min-h-5.5 pt-0.5 text-xs leading-4",
      help: "mt-0 min-h-5.5 pt-0.5 text-xs leading-4",
      hint: "text-xs",
    },
    variants: {
      orientation: {
        vertical: { container: "mt-1" },
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
        sm: { base: "px-3 py-2 text-sm" },
        md: { base: "px-3 py-2 text-sm" },
      },
    },
    compoundVariants: [],
  },
  // Dialogは画面から浮かせるため影を残し、cardと同じ枠線を付ける。本文は入力欄と同じ文字の大きさにする。
  // 閉じる操作はfooterのbuttonとEscで行い、右上の閉じるbuttonは出さない（各Dialogのfooterに「閉じる」等がある）。
  modal: {
    slots: {
      overlay: "bg-black/32",
      content: "rounded-sm shadow-elevation-24 ring ring-default divide-y-0 text-default",
      header: "min-h-0 px-6 pt-4 pb-2.5 sm:px-6",
      title: "text-lg font-medium text-default",
      description: "text-sm text-muted",
      body: "px-6 pt-4 pb-6 sm:px-6 sm:pt-4 sm:pb-6 text-sm",
      footer: "justify-end gap-2 px-4 py-2 sm:px-4",
      close: "hidden",
    },
  },
  // 区切り線なしで、選択中のtabだけprimary色と2pxの下線を付ける。buttonと同じく大文字表記・字間は付けず、高さは余白で決める。
  tabs: {
    slots: {
      list: "p-0",
      trigger: "rounded-none px-4 py-3 data-[state=inactive]:text-muted",
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
        // 高さは固定せず、上下の余白で決める（表の行の中でも詰まって見えない大きさにする）。
        xs: { base: "px-2 py-0.5 text-[0.625rem] gap-1 rounded-full" },
        sm: { base: "px-2.5 py-1 text-xs gap-1 rounded-full" },
        md: { base: "px-3 py-1 text-sm gap-1.5 rounded-full" },
        lg: { base: "px-3.5 py-1.5 text-base gap-1.5 rounded-full" },
      },
    },
    compoundVariants: [
      ...badgeSoftVariants,
      ...badgeOutlineVariants,
      { color: "neutral" as const, variant: "soft" as const, class: "bg-inverted/12 text-default" },
      { color: "neutral" as const, variant: "outline" as const, class: "ring-current text-default" },
    ],
    // 色指定なしのbadgeは、前景色12%の薄い背景（soft）で表示する。
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
        // 影は付けず、枠線でcardの境界を示す（参考デザインのoutline）。
        solid: {
          root: "bg-default text-default ring ring-default",
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
