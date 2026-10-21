# ThreeView API Reference

Complete reference for `@navaramap/three`'s `ThreeView` and its sub-APIs. Prerequisites: [README.md](README.md) (terminology, invariants), [reference-types.md](reference-types.md) (shared types).

## Constructor

```ts
new ThreeView<Descriptions = unknown>(options?: ThreeViewOptions)
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `container` | `HTMLElement` | — | Rendering container; canvas created inside |
| `canvas` | `HTMLCanvasElement \| OffscreenCanvas` | — | Use this canvas instead |
| `pixelRatio` | `number` | device default | High-DPI render quality |
| `disableAutoResize` | `boolean` | `false` | Disable window-resize handling |
| `debug` | `boolean` | `false` | Perf stats overlays |
| `atmosphere` | `AtmosphereOptions` | — | `{ atmosphereAssetsUrl?, stbnUrl?, date? }` — sun/moon positions derive from `date` |
| `backgroundColor` | `Color \| number` | `0x0a0a0f` | Numeric hex accepted, converted to `Color` |
| `picking` | `boolean` | `true` | Required for `featureClick`/`featureHover`/`featureEnter`/`featureLeave` |
| `animation` | `boolean` | `false` | Render every frame; `false` = render on change / `forceUpdate()` |
| `multisampling` | `number` | `0` | MSAA count; >0 costs performance |
| `halfFloat` | `boolean` | `true` | Half-float post-processing |
| `logarithmicDepthBuffer` | `boolean` | `true` | Depth precision; some effects require `false` |
| `shadow` | `boolean` | `false` | **Creation-only.** Shadow mapping (needed by `sun.castShadow`) |
| `idleThreshold` | `number` | `100` | Ms without data/tile activity before `idle` event |
| `mobileOptimization` | `boolean` | auto-detected | Lower pixel ratio / lighter effects |
| `cacheBytes` | `number` | device-dependent (desktop: ¼ RAM cap 2 GB; mobile: 512 MB) | Tile-cache budget; runtime-settable via `view.cacheBytes` |
| `lodFog` | `Partial<LodFogSettings>` | `{ density: 2.0e-4, sseFactor: 2.0 }` | Distance-based SSE relaxation (LOD only, no visual fog) |
| `dynamicSse` | `Partial<DynamicSseSettings>` | `{ enabled: true, density: 2.0e-4, sseFactor: 24, heightFalloff: 0.25, minHeight: 0, maxHeight: 8000 }` | Tilt/height-dependent SSE relaxation |
| `memoryBudget` | `MemoryBudgetOptions` | derived | `{ maxWorkerHeapBytes?, fontBudgetBytes?, maxPendingRequests?, sseMultiplierMin?, sseMultiplierMax? }` |
| `waterTexture` | `{ enabled: boolean; url?: string }` | disabled | Shared water normal texture for water materials |
| `defaultAttribution` | `boolean \| { style?, position? }` | `true` | `false` → `view.attribution` is `undefined` |
| *(GlobeOptions)* | see below | — | Inherited globe options |

GlobeOptions (also constructor options): `maxSse` (2.0, **init-only**), `segments` (64, **init-only**), `color`, `hideUnderground` (`true`), `shouldComputeNormalFromVertex` / `useNormal` (**init-only**), `transparent` (`false`), `opacity` (`1.0`), `wireframe` (`false`).

```ts
type LodFogSettings = { enabled: boolean; density: number; sseFactor: number };
type DynamicSseSettings = { enabled: boolean; density: number; sseFactor: number; heightFalloff: number; minHeight: number; maxHeight: number };
```

## Methods

### Lifecycle

| Method | Signature | Notes |
|---|---|---|
| `init` | `async init(): Promise<void>` | Required before any other use; loads WASM, starts render loop |
| `dispose` | `dispose(): void` | Releases everything; call on teardown |
| `resize` | `resize(width?, height?, pixelRatio?): void` | Omitted dims = canvas size |
| `forceUpdate` | `forceUpdate(): void` | Re-render next frame when `animation: false` |

### Content management

| Method | Signature | Notes |
|---|---|---|
| `addSource` | `addSource(s: SourceDescription): Source` | See [reference-sources-layers.md](reference-sources-layers.md) |
| `addLayer` | `addLayer(l: LayerDescription): Layer` | Resource layers only (vector/raster/terrain/3d-tiles) |
| `addMesh` | `addMesh<L = unknown>(l: MeshDescription): MeshHandle<L>` | Descriptor key must be registered |
| `addLight` | `addLight<L = unknown>(l: LightDescription): LightHandle<L>` | |
| `addEffect` | `addEffect<L = unknown>(l: EffectDescription): EffectHandle<L>` | |
| `updateLayerById` | `updateLayerById(id: string, l: LayerDescription): void` | Partial merge (omitted fields preserved) |
| `updateMeshById` | `updateMeshById(id: string, updates): void` | Partial |
| `updateLightById` | `updateLightById(id: string, updates): void` | Partial |
| `updateEffectById` | `updateEffectById(id: string, updates): void` | Partial |
| `deleteLayerById` | `deleteLayerById(id: string): boolean` | `true` if found and deleted |
| `deleteMeshById` | `deleteMeshById(id: string): boolean` | |
| `deleteLightById` | `deleteLightById(id: string): boolean` | |
| `deleteEffectById` | `deleteEffectById(id: string): boolean` | |
| `registerMesh` | `registerMesh(name: string, meshClass: MeshDescConstructor): void` | |
| `registerLight` | `registerLight(name: string, lightClass: LightDescConstructor): void` | |
| `registerEffect` | `registerEffect(name: string, effectClass: EffectDescConstructor): void` | |
| `addPlugin` | `addPlugin(plugin: Plugin): this` | **Before `init()` only**; chainable |

### Camera

`CameraPosition = { lng?, lat?, height?, pitch?, heading?, roll?, distance? }` — all degrees/meters. When `distance` is set, `height` is the **target elevation** and the camera sits `distance` meters away along the forward ray; without `distance`, `height` is the camera's own altitude.

| Method | Signature | Notes |
|---|---|---|
| `setCamera` | `setCamera(camPos: CameraPosition): void` | Instant reposition |
| `flyTo` | `flyTo(camPos: CameraPosition & Required<Pick<CameraPosition,"lng"\|"lat">> & ({height:number}\|{distance:number}), options?: FlyToOptions): Promise<boolean>` | Arc flight; resolves `false` when interrupted; new `flyTo`/`setCamera` interrupts |
| `moveCamera` | `moveCamera(move: CameraDirection, amount: number): void` | `CameraDirection`: `Forward Backward Left Right Up Down` (enum import from `@navaramap/three`) |
| `moveCameraWithDirection` | `moveCameraWithDirection(dir: number[], amount: number): void` | ECEF direction vector |
| `lookAt` | `lookAt(target: LatLngHeight, offset: Vector3): void` | `offset` in ENU meters |
| `cameraFollow` | `cameraFollow(enabled: boolean, target?: LatLngHeight, offset?: Vector3): void` | Suppresses camera move events while active |
| `cameraFreeLook` | `cameraFreeLook(enabled: boolean, target?: LatLngHeight): void` | Position-locked look-around; wheel zoom disabled |
| `rotateAroundAxis` | `rotateAroundAxis(axis: Vector3, angle: number): void` | `angle` radians; zero axis = default |
| `rotateAround` | `rotateAround(angle: number): void` | Orbit around current look-at point |

```ts
type FlyToOptions = { duration?: number; maxHeight?: number; easing?: "linear" | "quadInOut" | "cubicInOut" | "cubicOut" | "quinticInOut" };
// duration ms; omitted → 2–3 s from distance. easing default "quinticInOut" ("cubicOut" when descending from > 11,500 m). duration: 0 = jump
```

### Terrain sampling

| Method | Signature | Notes |
|---|---|---|
| `sampleTerrainHeight` | `sampleTerrainHeight(pos: LatLng): number \| undefined` | Sync; resident tiles only; coarse from far away; respects `exaggeration` |
| `sampleTerrainMostDetailed` | `async sampleTerrainMostDetailed(source: SourceRef, positions: LatLng[], options?: { level?: number; signal?: AbortSignal }): Promise<SampledTerrainPosition[]>` | Fetches most-detailed tiles; result order matches input; `SampledTerrainPosition = { lat, lng, height?: number, level: number }`; `source` = raster-dem/quantized-mesh handle or id |
| `sampleTerrainHeightRange` | `sampleTerrainHeightRange(extent: GeographicExtent): { min: number; max: number } \| undefined` | Sync; resident tiles; `0` where nothing loaded; antimeridian-crossing extents unsupported in observer variant |
| `observeTerrainHeightAt` | `observeTerrainHeightAt(pos: LatLng, cb: (height: number) => void): () => void` | Returns cleanup fn |
| `observeTerrainHeightRange` | `observeTerrainHeightRange(extent: GeographicExtent, cb: (range: {min,max}) => void): () => void` | Returns cleanup fn |

### Picking

| Method | Signature | Notes |
|---|---|---|
| `pickTerrainPosition` | `pickTerrainPosition(x: number, y: number): Vector3 \| null` | Terrain hit at CSS-pixel screen coords (`MouseEvent.clientX/Y`); ECEF result |
| `pickDepthPosition` | `pickDepthPosition(x: number, y: number): Vector3 \| null` | Full-scene depth (hits any geometry, not just terrain) |

### Fonts

| Method | Signature | Notes |
|---|---|---|
| `addFontFamily` | `addFontFamily(family: FontFamily): this` | `FontFamily = { family: string; faces: { url: string; unicodeRanges: { from: number; to: number }[] }[] }`; first matching face per codepoint wins; uncovered codepoints fall back to `faces[0]` |
| `removeFontFamily` | `removeFontFamily(family: string): this` | |

Prefer `view.addFontFamily(await fetchFontFamilyFromCss("MapFont", "https://fonts.googleapis.com/css2?..."))` — see [Fonts utilities](#font-utilities).

### Memory

| Method | Signature | Notes |
|---|---|---|
| `setSseMultiplierRange` | `setSseMultiplierRange(min: number, max: number): void` | Memory-pressure SSE degrade range; `(1, 1)` disables |
| `memoryStats` | `memoryStats(): MemoryStats \| undefined` | `undefined` before `init()`; fields: `bufferTotalBytes, externalBufferBytes, bufferCount, gpuBytesEst, externalCpuBytes, reservedBytes, budgetBytes?, evictedCount, sseMultiplier, retainedVector/Terrain/Raster/Tiles3d` |
| `workerMemoryStats` | `async workerMemoryStats(): Promise<WorkerMemoryStats \| undefined>` | `{ tileWorkers?: { perSlot, totalBytes, maxWorkerHeapBytes }, fontWorker?: { heapBytes, fontCount, atlasCount, glyphCount, fontBytes, atlasBytes, colorAtlasBytes, budgetBytes? } }` |

## Properties

| Property | Type | Writable | Notes |
|---|---|---|---|
| `camera` | `ThreeViewCamera` | no | See [below](#viewcamera) |
| `globe` | `Globe` | no | See [below](#viewglobe) |
| `atmosphere` | `Atmosphere` | no | See [below](#viewatmosphere) |
| `attribution` | `AttributionPlugin \| undefined` | no | `undefined` when `defaultAttribution: false` or no-DOM |
| `toneMappingExposure` | `number` | yes | ~10 satellite imagery, ~3 bright styles, ~6 deferred-lit scenes |
| `lit` | `boolean` | yes (default `true`) | Scene default of the `lit` material option; toggling recompiles shaders once |
| `animation` | `boolean` | yes | Continuous rendering toggle |
| `buffers` | `{ selectiveEffect, emissive, shadow, globeNormal }` | no | Allocated G-buffer attachments (derived from effect requirements) |
| `screenSize` | `Vector2` | no | Pixels |
| `pixelRatio` | `number` | no | |
| `shadowMapViewersEnabled` | `boolean` | yes | Debug |
| `cacheBytes` | `number \| undefined` | yes | Lowering evicts over next frames; `undefined` disables budgeting |
| `lodFog` | get `LodFogSettings \| undefined` / set `Partial<LodFogSettings>` | yes | Partial setter merges |
| `dynamicSse` | get `DynamicSseSettings \| undefined` / set `Partial<DynamicSseSettings>` | yes | Partial setter merges |

## Events

`view.on(event, handler)` / `view.off(event, handler)`.

| Event | Payload | Notes |
|---|---|---|
| `click` | `MapPointerEvent` | `MapPointerEvent = { map: {x,y,z} /* ECEF on globe */ } & PointerEvent` |
| `pointerdown/enter/leave/move/up` | `MapPointerEvent` | `pointerleave` for touch fires after lift |
| `pointercancel` | `PointerEvent` | No map coords |
| `featureClick` | `PickedFeature \| null` | `PickedFeature = { batchId: number; properties?: Record<string, unknown>; layerId?: string }`; `null` on empty space; requires `picking: true`; lazy (GPU pick only while listeners exist) |
| `featureHover` | `PickedFeature \| null` | Fires on change only; mouse only |
| `featureEnter` / `featureLeave` | `PickedFeature` | Hover enter/leave; mouse only |
| `layer` | `(k: LayerEventName, layerId: string, ...args) => void` | Any layer event |
| `preUpdate` / `postUpdate` | `(time: number) => void` | `time` = DOMHighResTimeStamp ms |
| `preRender` / `postRender` | `(time: number) => void` | Every frame when `animation: true` |
| `resize` | `(width: number, height: number) => void` | |
| `idle` | `() => void` | Once per idle period; animations don't count as activity |

## `view.camera` — ThreeViewCamera

Properties: `raw` (Three.js `PerspectiveCamera` — **never write `raw.fov`/frustum fields directly**, use the `fov` setter), `positionECEF` `{x,y,z}` (ro), `positionGeographic` `{lng,lat,height}` (ro), `orientation` `{heading,pitch,roll}` degrees (ro), `fov` (setter clamps 1–180; getter `undefined` before init), `near` / `far` (get/set, `far > near > 0`), `options` (partial-set `CameraOptions`).

```ts
type CameraOptions = {
  autoAdjustNearFar?: boolean;      // default true
  minimumZoomDistance?: number;     // default ~6,356,752 m from Earth center
  maximumZoomDistance?: number;     // default ~63,567,523
  spinSpeed?: number;               // 2.0
  zoomSpeed?: number;               // 0.6
  spinDuration?: number;            // 500 ms inertia
  zoomDuration?: number;            // 100
  translateDuration?: number;       // 500
  enableSpin?: boolean;             // true
  enableZoom?: boolean;             // true
  enableTilt?: boolean;             // true
};
```

Camera events (`camera.on/off/once`): `movestart`, `move` (every frame in motion), `moveend`, `frustumChanged`. Instantaneous ops emit `move`+`moveend` together without `movestart`. Follow modes suppress all of them.

## `view.globe` — Globe

| Property | Type | Default | Notes |
|---|---|---|---|
| `maxSse` | `number` | `2.0` | **Init-time only** |
| `segments` | `number` | `64` | **Init-time only** |
| `color` | `Color \| undefined` | — | Surface color before tiles load |
| `hideUnderground` | `boolean` | `true` | |
| `useNormal` | `boolean` | `false` | **Init-time only** |
| `transparent` | `boolean` | `false` | Enables `opacity` |
| `opacity` | `number` | `1.0` | Requires `transparent: true` |
| `wireframe` | `boolean` | `false` | |
| `elevationColormap` | `ColorMap \| undefined` | — | LUT for `elevationHeatmap` material |

## `view.atmosphere` — Atmosphere

| Member | Signature | Notes |
|---|---|---|
| `date` | `Date` (get/set) | Drives sun/moon; use UTC (`...Z`) strings |
| `sunDirection` / `moonDirection` | `Vector3` (ro) | Do not mutate; use getters |
| `getSunDirection()` / `getMoonDirection()` | `(): Vector3` | Clone, ECEF |
| `isAtNight(position: XYZ)` | `: boolean` | |
| `getSunElevation({ lat, lng })` | `: number` degrees | Includes refraction |
| `getSolarTime({ lng })` | `: number` hours `[0,24)` | Local apparent solar time |
| `setSolarTime({ lng }, hours)` | `: void` | Inverse of `getSolarTime` |
| `setDateAt(from, to)` / `setDateFromCameraAt(to)` | `: void` | Match hour angle (time of day) |
| `setElevationAt(from, to)` / `setElevationFromCameraAt(to)` | `: void` | Match sun elevation (shadow length); clamps at polar night |
| `on("sunChanged", (sunDirection: Vector3) => void)` | | |

## Color

```ts
const c = new Color().setStyle("#00aaff"); // constructor takes NO args
```

Methods (chainable unless noted): `setRGB(r,g,b)` (sRGB 0–1), `setRGBLinear(r,g,b)`, `setHex(0xff0000)`, `setStyle("#f00" \| "rgb(...)" \| "rgba(...)" \| "hsl(...)" \| "red")`, `copy(target)` (copies **to** target), `clone(): Color`, `toArray(): [r,g,b]`, `toHex(): number`, `srgb(): Color`, `raw: THREE.Color` (ro).

## ColorMap

```ts
new ColorMap(type: "sequential" | "diverging", name: string, lut: readonly (ColorTuple | Color)[])
// ColorTuple = [r, g, b] each 0–1; LUT needs ≥ 2 entries
```

Members: `type`, `name`, `lut` (normalized), `count` (ro); `linear(value): ColorTuple`, `quantize(count): ColorTuple[]` (count ≥ 2), `ticks(range: [min,max], count): number[]`, `createImage(): HTMLCanvasElement`, `flatten(): Float32Array`. No built-in presets — construct from palettes (docs use ColorBrewer examples).

## FeatureEvaluator

Obtained from layer events (`featureCreated` / `featureUpdated`):

```ts
layer.on("featureUpdated", ({ evaluator, featureSetId, updatedAt }) => {
  evaluator.evaluate(
    (info: { batchId: number; properties?: Record<string, unknown>; layerId?: string }) => {
      return { /* EvaluatedValue subset */ };
    },
    { filters: ["propA", "propB"] }, // optional: only read these property keys
  );
});
```

Methods: `readFeatureProperties(f)`, `readFilteredFeatureProperties(keys, f)`, `evaluate(f, options?)`. Identify features across LODs by **properties** (e.g. an id field), not `batchId` (only valid within a feature set).

`EvaluatedValue` (all optional; overrides material defaults; return only what changes):

| Field | Type | Applies to |
|---|---|---|
| `color` | `Color` | all |
| `show` | `boolean` | all |
| `height` | `number` (m) | all |
| `extrudedHeight` | `number` (m) | polygons |
| `text` | `string` | text features |
| `width` | `number` (px) | polylines |
| `size` | `number` | point/text |
| `letterSpacing` | `number` (em) | text |
| `opacity` | `number` 0–1 | polygons/points/billboards/models/text |
| `declutterPriority` | `number` | points/billboards/text with declutter |
| `image` | `string \| null` | billboards (atlas-packed per URL; `null` reverts) |
| `facing` | `"upright" \| "flat"` | points/billboards/text |
| `rotateWithCamera` | `boolean` | points/billboards/text |
| `spreadGlyphs` | `boolean` | text on lines |
| `rotation` | `number` (deg, CW) | points/billboards/text |
| `emissive` / `emissiveIntensity` | `Color` / `number` | batched polygons / 3D Tiles models / points / billboards / text; drives selective bloom (material `effectIds` must include the bloom effect id) |

## Font utilities

| Function | Signature | Notes |
|---|---|---|
| `fetchFontFamilyFromCss` | `(family: string, cssUrl: string \| string[], options?: { fontFamily?; fontWeight?; fontStyle?; requestInit? }): Promise<FontFamily>` | Fetches stylesheet(s), parses `@font-face`; font files download lazily per codepoint use |
| `parseFontFamilyFromCss` | `(family: string, cssText: string, options?: { ...filters; baseUrl? }): Promise<FontFamily>` | Throws when no `@font-face` matches |
| `parseCssUnicodeRange` | `(value: string): Promise<{ from: number; to: number }[]>` | Parses `unicode-range` (`U+26`, `U+0102-0103`, `U+4??`); throws on malformed |

Face priority: first face whose `unicodeRanges` contain the codepoint wins; CSS-parsed faces come out in **reverse stylesheet order**; use `fontFamily` as an **array** to force order (needed for Google Fonts CSS API's alphabetical output).
