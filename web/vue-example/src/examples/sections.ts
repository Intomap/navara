/**
 * Display-section model for the Vue example gallery, ported from the original
 * React gallery (`web/navara_three/example/pages/examples/sections.ts`).
 *
 * Display section is intentionally decoupled from the directory: e.g.
 * `gis/*` lives under "2D" / "2.5D", `mesh/*` under "3D", and `weather/*` +
 * `effect/*` fold into the "lighting-effect" section.
 */

/** Display section keys, in gallery order. */
export const SECTION_KEYS = [
  "getting-started",
  "2d",
  "2.5d",
  "3d",
  "basemap",
  "terrain",
  "tiles-3d",
  "styling",
  "interaction",
  "lighting-effect",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** Languages the gallery UI supports for example titles, in toggle order. */
export const SUPPORTED_LANGS = ["en", "ja"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

/**
 * A localized string: either a bare string (applies to every language) or
 * per-language variants. Authoring in a single language is fine — it becomes
 * the fallback for the others.
 */
export type Localized = string | Partial<Record<Lang, string>>;

/**
 * Resolve a {@link Localized} value for `lang`, falling back to the default
 * language, then to whatever variant is present.
 */
export const localize = (text: Localized | undefined, lang: Lang): string => {
  if (text == null) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text[DEFAULT_LANG] ?? Object.values(text)[0] ?? "";
};

/** Heading shown for each section in the gallery, per language. */
export const SECTION_LABELS: Record<SectionKey, Record<Lang, string>> = {
  "getting-started": { en: "Getting Started", ja: "Getting Started" },
  "2d": { en: "2D", ja: "2D" },
  "2.5d": { en: "2.5D", ja: "2.5D" },
  "3d": { en: "3D", ja: "3D" },
  basemap: { en: "Basemap", ja: "ベースマップ" },
  terrain: { en: "Terrain", ja: "地形" },
  "tiles-3d": { en: "3D Tiles", ja: "3D Tiles" },
  styling: { en: "Styling", ja: "スタイリング" },
  interaction: { en: "Interaction & UI", ja: "インタラクション・UI" },
  "lighting-effect": {
    en: "Lighting & Effects",
    ja: "ライティング・エフェクト",
  },
};

/** Gallery metadata for one example (mirrors the original `meta.ts` files). */
export type ExampleMeta = {
  /** Display section this example is grouped under (decoupled from directory). */
  section: SectionKey;
  /** Title shown in the sidebar and panel header. */
  title: Localized;
  /** One-line summary of what the example does. */
  description: Localized;
  /** Featured (★). Surfaced in the top "Featured" band. */
  signature?: boolean;
  /** Sort order within its section/group (ascending; unset sorts last). */
  order?: number;
  /** Optional sub-group label within a section. */
  group?: Localized;
  /**
   * Optional docs path for the primary API, relative to the docs site
   * (e.g. "three/tutorial/basic-visualization"). Rendered only when absolute.
   */
  docs?: string;
};
