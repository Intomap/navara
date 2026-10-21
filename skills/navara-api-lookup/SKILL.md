---
name: navara-api-lookup
description: "Fast local-corpus API lookup for Navara (@navaramap/* + navara_wasm) — resolve the exact option name, default, type, descriptor key, or a page that already implements it before writing code, without web searches and without guessing. Use whenever writing or reviewing Navara code (sources/layers/materials, mesh/effect/light descriptors, plugins, camera/atmosphere calls) or when unsure a property exists or which key to pass."
description_zh: "用仓库自带的本地语料（docs/ 文档 + web 各包类型定义 + example 页面）快速查 Navara API：精确的选项名、默认值、类型、descriptor key 与可运行示例，不必联网搜索、不必猜。写/审 Navara 代码（新增图层、材质、mesh/effect/light descriptor、插件、相机）或不确定某属性/键名是否存在时使用。"
---

# Navara API lookup — then write the feature

Every authoritative source is already in this checkout. Read it locally: the docs
site is built from `docs/src/content/docs/` (same files), so web-fetching
navara.world/docs costs a round trip and returns nothing new.

## One command per question

`skills/navara-api-lookup/scripts/navara-lookup.sh` (callable from anywhere):

| Question                                                  | Command                          |
| --------------------------------------------------------- | -------------------------------- |
| Does this option exist? Type / default / unit?            | `navara-lookup.sh prop <name>`   |
| Which key goes in `addMesh`/`addEffect`/`addLight`?       | `navara-lookup.sh keys`          |
| Where is this documented and used at all?                 | `navara-lookup.sh find <term>`   |
| Which docs page covers X, what is its live URL?           | `navara-lookup.sh doc <term>`    |
| Which example already does this end-to-end?               | `navara-lookup.sh example <term>`|
| Cite a docs page in an answer                             | `navara-lookup.sh url <docs path> [anchor]` |

- `prop` prints the doc section (`**Type:**` / `**Default:**` / description) **and** the
  implementation sites, so it answers naming questions in one call — prefer it over
  reading a page. Docs that lag the code show up as a mismatch here.
- `find` takes an unknown-shaped term (`maxZoom`, `clampToGround`, `raster-tile`) and
  groups hits as docs → types/impl → examples.
- `NAVARA_LOOKUP_MAX=80` widens output; `NAVARA_LOOKUP_LOCALE=ja` searches the Japanese
  mirror (default: English corpus, `ja/` only as fallback).
- The script searches English docs first by design: `ja/` is a translation mirror, never
  a second opinion.
- ripgrep is not on `PATH` here; the script uses POSIX `grep -rnI`. For open-ended
  discovery prefer the IDE content-search tool (ripgrep-backed) over piping the script.

## Which source answers which question

| Kind of fact                                | Source of truth                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| option name, default, units, user-visible trap | `docs/src/content/docs/**` — descriptor/material pages use `## Properties` → `### <name>` with `**Type:**`/`**Default:**` |
| accepted `type:` strings, TS unions         | `web/navara_three/src/type/index.ts`, `web/navara_three_default_descs/src/**/<X>Desc.ts` (`XConfig` / `XUpdate`)             |
| source/layer/material field list            | `web/wasm/navara_engine/navara_wasm.d.ts` (generated getters, e.g. `polygonmaterial_extrudedHeight`) — the real config surface |
| descriptor key (`addEffect({ aerialPerspective })`) | `web/navara_three_default_plugin/src/index.ts` → `registerMesh/Effect/Light("key", Desc)`                            |
| full API surface in one file                | `docs/src/content/docs/three/API/navara_three_api.md`, `docs/src/content/docs/engine/API Reference/navara_wasm_api.md`        |
| proven composition that runs in CI          | `web/navara_three/example/pages/**` (one feature per page, API called directly)                                             |
| usage invariants, gotchas, recipes          | `skills/navara-usage/**` — read before writing, not after a broken render                                                   |
| MapLibre Style per-property support status  | `docs/src/content/docs/maplibre_style/supported.json`                                                                       |
| engine internals (pass order, G-buffer)     | `guide/**` — never needed for app code                                                                                      |

Docs and code disagree → the code wins, and the docs page is the bug to fix.
`skills/navara-usage` already records one such drift (`Layer.update()` JSDoc).

## Doc path → URL (for citing)

Strip `docs/src/content/docs/` and the extension, lowercase each segment, spaces →
hyphens, `ja/` moves into the path, `index` collapses to the directory root, and an
anchor is the heading text lowercased:

```
docs/src/content/docs/three_default_descs/Effect Desc/aerial-perspective-effect-desc.md  #shadow
  -> https://navara.world/docs/three_default_descs/effect-desc/aerial-perspective-effect-desc/#shadow
```

Sections: `three/` (Introduction, Source, Layer, Material, API, Core, Tutorial,
Example, Plugins), `three_default_descs/` (`mesh-desc/`, `effect-desc/`, `light-desc/`),
`three_default_plugin/`, `three_plugins/`, `maplibre_style/`, `engine/`, `guides/`.
Next to the prose pages, each section's implementation lives in
`web/navara_three_default_descs/src/{meshes,effects,lights}/` (one file per descriptor).

## Workflow: fact → working feature

1. **Resolve names first.** `prop <option>` (or `keys` for a descriptor key) for every
   property you are about to write. Near-miss names are the expensive failure mode here:
   they compile, run, and change nothing.
2. **Find the closest working page.** `example <term>` → open that page's entry file
   (`main.ts`/`run.ts`) and adapt its composition. Examples deliberately call
   `view.addSource/addLayer/…` directly; do not wrap the API in abstractions.
3. **Load the invariants.** `skills/navara-usage/SKILL.md` (+ the reference file
   matching the topic) covers the rules the snippet assumes: plugins before `init()`,
   WASM math after `init()`, draped vs lit, partial-merge updates, which light a
   material needs. `skills/navara-engine-dev/SKILL.md` applies to any code committed
   to this repository.
4. **Run it in a host.** `web/vue-example` (`pnpm -C web/vue-example dev`) hot-reloads
   `web/navara_*/src` directly — fastest scratch host. For a permanent example page,
   follow `skills/navara-add-example` + `web/navara_three/example/README.md`
   (`pnpm --filter @navaramap/three dev`, pages under `/examples`).
5. **Only after Rust changes:** rebuild WASM (`cargo make build-dev-all`), then refresh —
   Vite cannot hot-reload the binary.
6. **Missing from the docs?** Changing behavior is the docs' job
   (`skills/navara-add-docs-example`); the distilled invariant belongs in
   `skills/navara-usage`.

## Efficiency rules (the point of this skill)

- **Batch independent lookups in one turn.** One `prop`/`find` per unknown, all in
  parallel — never one call, read, then another.
- **Slice-read around a hit** (`read_file` with `offset`/`limit`). A descriptor page or
  `navara_wasm.d.ts` is large; only the matched section matters.
- **Never read `guide/**` for API usage** and never read `docs/**` for internals —
  guessing across that boundary is what produces plausible-but-wrong code.
- **Delegate genuinely repo-wide questions** ("how do draping slots pick layers", "who
  sets `clampToGround`") to the `code-explorer` subagent with one tight question, so the
  file sweep stays out of your context.
- **Verify behavior by rendering** when the question is behavioral, not lexical: a page
  that draws (and the console free of Navara warnings) is the only proof an option took
  effect.
- **Cite with `url`/`prop` output**, and with `file:line` for code — this repo's answers
  point at evidence, never at recollection.

See `references/api-corpus-map.md` for the task → files map (basemap, terrain, meshes,
effects, lights, picking, plugins, …).
