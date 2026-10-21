# Plugins Reference

Universal plugin lifecycle: `new XxxPlugin(config?)` → `view.addPlugin(plugin)` (**before** `view.init()`; throws after) → plugin-specific methods **after** `await view.init()`. Plugins run their `init()` in parallel inside `view.init()`.

Custom plugins extend `Plugin` and implement `async init(view, ctx)`; inside `init` they may call `view.registerMesh/registerLight/registerEffect`.

## DefaultPlugin (`@navaramap/three-default-plugin`)

`new DefaultPlugin()` — no options. Bulk-registers all default descriptors (see [reference-descriptors.md](reference-descriptors.md) for the full key list).

**`addDefaultPhotorealScene(options?)`** — call **after** `init()`. Adds: `sky`, `stars`, `skyLightProbe`, `sun`, `aerialPerspective`, `lensFlare` (desktop only), `toneMapping`, antialiasing (`smaa` desktop / `fxaa` mobile). Returns `{ sky, sun, aerialPerspective, toneMapping, ... }` layer/handle refs (e.g. `layers.sun.update({ sun: { castShadow: true, shadowFar: 1000 } })`).

| Option | Type | Default | Notes |
|---|---|---|---|
| `deferredLighting` | `boolean` | `false` | Enables aerial-perspective `irradiance` AND sets `view.lit = false` (both halves required — otherwise double lighting). Needed for cloud shadows. Does NOT reach transparent materials; meshes with `lit: true` keep forward shading |
| `shadow` | `boolean` | `false` | Sun shadows via aerial perspective; **no-op without `deferredLighting`** |
| `specular` | `boolean` | `false` | Sun specular; **no-op without `deferredLighting`** |

Exposure guidance: `view.toneMappingExposure` ≈ 10 forward-lit satellite, ≈ 6 deferred-lit, ≈ 3 bright map styles.

## AttributionPlugin (`@navaramap/three`)

Created **by default**; access via `view.attribution` (`undefined` when `defaultAttribution: false` or no-DOM). Built-in "Navara" credit always first; links sanitized (http/https/mailto/relative only).

```ts
new AttributionPlugin({ style?: AttributionStyle, position?: "bottom-left" | "bottom-right" }) // manual registration pre-init
```

Methods: `add(items: AttributionItem[])`, `remove(items)` (structural match), `clear()`, `show()`, `hide()`, `setStyle(style)`, `dispose()`.

```ts
// AttributionSource
{ attribution: string, attributionUrl?: string, logo?: string, logoUrl?: string,
  children?: [{ attribution: string, minZoom?: number, maxZoom?: number }],
  creditLayerId?: string /* layer.id — auto-dropped when the layer is deleted */ }
// AttributionHtml
{ attributionHtml: string } // inline <a> allowed
// AttributionStyle (all optional strings): titleColor, linkColor, listStyleColor, textColor, nestedTextColor, backgroundColor, borderColor
```

## PersonViewPlugin (`@navaramap/three-plugins`)

First/third-person walking controller. `addPlugin` before init; **`start()` after init**.

```ts
new PersonViewPlugin(config?: PersonViewConfig)
```

Key config fields (default): `initialView` (`"tpv"` | `"fpv"`), `character?: { modelUrl (**R**), animation: { idleClip (**R**), walkClip?, dashClip (**R**), speed?, idleSpeed?, walkSpeed?, dashSpeed?, crossfadeDuration }, modelRotationOffset? (rad), modelScale (`3`), hideModelInFpv (`true`), castShadow/receiveShadow (`false`) } — omit for pure camera controller, `collision: { mode: "off"|"clamp"|"ground" (default off), groundOffset (`0`), alignToSlope (`true`), slopeSampleDistance (`4`), maxSlopeTilt (`45`), cameraSlopeFollow (`1`) }`, `allowCameraControl` (`false`), `moveSpeed` (`50` m/s), `rotationSpeed` (`3` deg/frame), `altSpeed` (`30`), `dashSpeedMultiplier` (`2.5`), `minAlt` (`50`) / `maxAlt` (`5000`), `cameraDistance` (`50`), `cameraPitch` (`0`), `cameraLerpSpeed` (`3`), `fpvForwardOffset` (`0`), `fpvHeightOffset` (`1`), `fpvPitch` (`0`), `startLat` (`35.6812`) / `startLng` (`139.7671`) / `startHeight` (`500`) / `startHeading` (`234`), `keys` (remappable `KeyboardEvent.code` arrays: forward/backward/turnLeft/turnRight/ascend/descend/dash/orbitCamera/toggleView).

Methods: `resolveStartHeight(source)` (async, pin start height to terrain — call before `start()`), `start()`, `stop()`, `teleport({lng,lat,alt,heading?})`, `setHeading/getHeading`, `setCameraPitch/getCameraPitch`, `setFpvPitch/getFpvPitch`, `setFpvHeightOffset/getFpvHeightOffset`, `setAnimationSpeed/getAnimationSpeed`, `setViewMode/toggleViewMode`, `setAllowCameraControl`, `setCollision/getCollision`, `getState()`, `onStateChange(fn)`, `onAction(fn)`, `model` (getter, `MeshHandle | null`), `dispose()` (permanent).

Notes: key input suppressed on editable elements; `collision.mode: "ground"` disables ascend/descend and min/maxAlt; sun shadows for person-scale need `sun.shadowFar` tightened.

## OverlayPlugin (`@navaramap/three-plugins`)

Projects geographic positions to screen pixels for HTML overlays.

`new OverlayPlugin({ maxDistance?: 100_000 })`. Methods: `setPositions([{ id, lng, lat, alt }])`, `onUpdate(fn: (state: { projected: Map<id, { x, y, distance }> }) => void): () => void`, `dispose()`. Utility: `moveOverlayElement(el, x, y)` (GPU-accelerated translate). `distance` (meters) drives fade/scale.

## CesiumIonPlugin (`@navaramap/three-plugins`)

Cesium Ion quantized-mesh terrain (endpoint+token resolved at init — the correct Ion path; not `addSource`).

```ts
new CesiumIonPlugin({ assetId: number|string (**R**), accessToken: string (**R**), endpoint?: "https://api.cesium.com/v1/assets" })
ion.addTerrain(options?): Layer // after init()
```

Common `addTerrain` options: `maxZoom`, `minZoom`, `overscaledMaxZoom`, `tms` (Ion = TMS), `geographic` (Ion = geographic), `requestVertexNormals` (needed for lighting), `requestWaterMask`, `skirt`, `skirtExaggeration`, `castShadow`/`receiveShadow`, `show`, `showBoundingBox`. Full set = quantized-mesh source options + terrain material.

## TileJsonPlugin (`@navaramap/three-plugins`)

`new TileJsonPlugin()` — no options. `addPlugin` before init; **`addSource` after init**.

```ts
const source = await tilejson.addSource({
  type: "raster-tile" | "vector-tile" | "raster-dem",
  url: "https://.../tilejson.json", // TileJSON doc, NOT a {z}/{x}/{y} template
  id?, minzoom?, maxzoom?, scheme?,   // overrides (doc fields: tiles[0]→url, minzoom/maxzoom, scheme:"tms"→tms)
  // raster-dem extras: tileSize? (512), encoding? ("mapbox"|"terrarium"; "custom" unsupported)
}); // → Source handle; doc `attribution` auto-registered to view.attribution
tilejson.on("loaded", ({ source, tilejson, attribution }) => {...});
tilejson.dispose();
```

Validation: rejects docs missing `tilejson` semver or with empty `tiles`; unknown `encoding` rejects; extra `tiles[]` endpoints ignored (warn).

## MapLibreStylePlugin (`@navaramap/maplibre-style`, experimental)

Renders a MapLibre Style JSON. `addPlugin` before init (URL styles fetched during init).

```ts
new MapLibreStylePlugin(styleOrUrl: StyleSpecification | string, options?: {
  overrides?: Partial<StyleSpecification>, // only "font-faces" merges currently
  tileJsonPlugin?: TileJsonPlugin,         // custom instance; auto-created otherwise
  forceMapLibreFov?: boolean,              // MapLibre fixed FOV (~36.87°) for camera math
})
plugin.dispose(); // removes layers/sources/credits — do not reuse
```

Helpers: `fetchFontStyleOverrides(family, cssUrl)` (async, Google Fonts etc.), `fontFamilyToStyleOverrides(fontFamilies)`, `convertFontFacesToFontFamilies(fontFaces)` (register results via `view.addFontFamily`).

Limitations: standard MapLibre `glyphs` (SDF PBF) **not supported** — use `font-faces`; per-feature support matrix lives in the docs site (`supported-features.mdx` / MapLibreSupportTable). Lifecycle: fetch style → parse/validate → register fonts → apply camera from root (center/zoom/pitch/bearing) → add sources/layers → track zoom changes.
