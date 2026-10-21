# Navara MCP Tool Catalog

An MCP tool design for controlling a Navara (`@navaramap/three`) 3D globe from an agent, following the cesium-mcp command paradigm: commands grouped by domain, each a pure operation `params → result` executed against a browser-hosted `ThreeView`. This is a **specification** — each tool maps 1:1 onto the documented API (see [api-threeview.md](api-threeview.md)); composite types are defined in [reference-types.md](reference-types.md).

## Conventions

- Tool names are camelCase, matching the underlying `ThreeView` method.
- Geographic values are **degrees**; heights/distances in **meters**; angles `heading`/`pitch`/`roll` degrees (heading CW from north, pitch negative = down).
- `?:` marks optional params (defaults stated in Notes). Required params must be present.
- Sequencing: a session must call `createView` before anything else; `addSource` before `addLayer`; registration-dependent tools (`addMesh` etc.) require the `DefaultPlugin` (added via `createView({ defaultPlugin: true })`, the default) or a prior `registerDescriptor`.
- Error contract: tools reject with a descriptive message; the catalog notes known rejection causes per tool.

## Toolsets

| Toolset | Tools | Default enabled |
|---|---|---|
| `lifecycle` | createView, disposeView, resizeView, forceUpdate | yes |
| `camera` | setCamera, flyTo, moveCamera, lookAt, cameraFollow, cameraFreeLook, rotateAround, setCameraOptions, getCameraState | yes |
| `source` | addSource, updateSource, deleteSource | yes |
| `layer` | addLayer, updateLayer, deleteLayer, listLayers | yes |
| `descriptors` | addMesh, addLight, addEffect, updateObject, deleteObject, registerDescriptor, addDefaultPhotorealScene | yes |
| `terrain` | sampleTerrainHeight, sampleTerrainMostDetailed, sampleTerrainHeightRange | yes |
| `picking` | pickTerrainPosition, pickDepthPosition | yes |
| `styling` | styleFeatures | no |
| `environment` | setAtmosphereDate, matchSunTimeAt, matchSunElevationAt, getSunState, setGlobeOptions, setToneMappingExposure | no |
| `fonts` | addFontFamilyFromCss, removeFontFamily | no |
| `memory` | getMemoryStats, setSseMultiplierRange, setCacheBytes | no |
| `events` | subscribeEvent, unsubscribeEvent | no |

---

## lifecycle

### `createView`

Creates the view and fully initializes it (construct + `addPlugin` + `await init()` in one atomic tool).

| Param | Type | Required | Notes |
|---|---|---|---|
| `containerSelector` | `string` | no | CSS selector of the host element; default = fullscreen body canvas |
| `backgroundColor` | `string` | no | CSS color; default `"#0a0a0f"` |
| `defaultPlugin` | `boolean` | no | default `true` — register all default descriptors (required by addMesh/addLight/addEffect) |
| `shadow` | `boolean` | no | default `false` — **creation-only**; needed for any sun/terrain shadow |
| `animation` | `boolean` | no | default `false` — continuous rendering (required by weather effects) |
| `picking` | `boolean` | no | default `true` — required for feature picking events |
| `useNormal` | `boolean` | no | default `false` — set `true` when the scene has no terrain/hillshade layer but needs sun lighting |
| `atmosphereDate` | `string` | no | ISO timestamp (use `...Z`); default now |
| `maxZoomDistance` etc. | — | no | Remaining pass-through options mirror ThreeView constructor options (see api-threeview.md) |

**Returns**: `{ viewId, camera: CameraState }`. **Rejections**: calling twice with the same `viewId`.

### `disposeView`

| Param | Type | Required |
|---|---|---|
| `viewId` | `string` | yes |

**Returns**: `{ ok: true }`. Releases WASM, GPU, listeners; all handles become invalid.

### `resizeView`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `width` / `height` | `number` | no | omitted = canvas size |
| `pixelRatio` | `number` | no | |

### `forceUpdate`

Renders one frame when `animation: false`.

| Param | Type | Required |
|---|---|---|
| `viewId` | `string` | yes |

---

## camera

### `setCamera`

Instant reposition (no animation).

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `lng` / `lat` | `number` | no | degrees |
| `height` | `number` | no | Camera altitude (or **target elevation** when `distance` set) |
| `distance` | `number` | no | Camera placed this far from the lng/lat/height target along the forward ray |
| `heading` / `pitch` / `roll` | `number` | no | degrees; pitch negative = down (valid range −180..0) |

**Returns**: `CameraState`.

### `flyTo`

Animated arc flight. **Returns** `Promise<{ completed: boolean }>` — `false` when interrupted by a newer camera op. Optional `{ duration?, maxHeight?, easing? }` (`duration` ms, 0 = jump; `easing` ∈ `linear|quadInOut|cubicInOut|cubicOut|quinticInOut`). Requires `lng`, `lat`, and exactly one of `height`/`distance`.

Params: `viewId` + `CameraPosition` + `options?`.

### `moveCamera`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `direction` | `"forward" \| "backward" \| "left" \| "right" \| "up" \| "down"` | yes | |
| `amount` | `number` | yes | meters |

### `lookAt`

Points camera at a target from an ENU offset.

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `target` | `{ lng, lat, height }` | yes | degrees/meters |
| `offset` | `{ east, north, up }` | yes | meters in the local East-North-Up frame |

### `cameraFollow` / `cameraFreeLook`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `enabled` | `boolean` | yes | |
| `target` | `{ lng, lat, height }` | no | required when enabling |
| `offset` | `{ east, north, up }` | no | `cameraFollow` only |

**Notes**: while active, camera move events are suppressed — poll `getCameraState` instead.

### `rotateAround`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `angle` | `number` | yes | **radians** (the only radian camera param) |

### `setCameraOptions`

Interactive-control behavior. All params optional, partial update: `autoRotate/enableSpin/enableZoom/enableTilt` (booleans), `spinSpeed` (2.0), `zoomSpeed` (0.6), `spinDuration` (500), `zoomDuration` (100), `translateDuration` (500), `minimumZoomDistance`, `maximumZoomDistance`, `autoAdjustNearFar` (true). Plus `fov` (degrees 1–180), `near`, `far` (`far > near > 0`).

### `getCameraState`

**Returns**: `CameraState = { positionGeographic: { lng, lat, height }, positionECEF: {x,y,z}, orientation: { heading, pitch, roll }, fov, near, far }`.

---

## source

### `addSource`

Registers a data source; returns a handle id referenceable by layers.

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `id` | `string` | no | auto-generated if omitted; re-adding an existing id **overrides** it |
| `type` | `"geojson" \| "raster-tile" \| "vector-tile" \| "raster-dem" \| "quantized-mesh" \| "3d-tiles" \| "b3dm" \| "pnts"` | yes | |
| `url` | `string` | yes* | *except geojson may use `data` instead. Tile templates contain `{z}/{x}/{y}`; `3d-tiles` = tileset.json URL; vector-tile also accepts `.pmtiles` |
| `data` | `object` | no | Inline GeoJSON (geojson only; `url` wins if both) |
| `tms` | `boolean` | no | Y-flip (raster-tile/raster-dem: default `false`; quantized-mesh: default `true`) |
| `geographic` | `boolean` | no | quantized-mesh tiling scheme, default `true` (EPSG:4326) |
| `minZoom` / `maxZoom` / `overscaledMaxZoom` | `number` | no | defaults 0 / 20 / 24 |
| `elevationDecoder` | `"japan-gsi" \| "mapbox" \| "terrarium" \| {r_scaler,g_scaler,b_scaler,offset,...}` | no | raster-dem only |
| `tileSize` | `number` | no | raster-dem, default 256 |
| `requestVertexNormals` / `requestWaterMask` | `boolean` | no | quantized-mesh; normals needed for lighting/shadows, watermask for water/SSR |
| `token` | `string` | no | quantized-mesh Bearer token |
| `tiled` | `boolean` | no | geojson spatial index for large datasets, default `false` |
| `crs` | `string` | no | geojson / vector-tile / 3d-tiles |

**Returns**: `{ sourceId }`. **Note**: Cesium Ion assets must go through the Ion flow, not a plain `quantized-mesh` source.

### `updateSource`

Partial update; **requires `type`** (cannot change) and `url`. Reloads every referencing layer.

| Param | Type | Required |
|---|---|---|
| `viewId`, `sourceId` | `string` | yes |
| `desc` | `SourceDescription` (same shape as addSource) | yes |

### `deleteSource`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId`, `sourceId` | `string` | yes | |

**Returns**: `{ deleted: boolean }` — `false` while any layer still references it (delete layers first).

---

## layer

### `addLayer`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `type` | `"vector" \| "raster" \| "terrain" \| "3d-tiles"` | yes | must match the source type (see matrix below) |
| `source` | `string` | yes | sourceId |
| `sourceLayers` | `string[]` | no | vector-tile only: which source layers to render |
| `point` / `billboard` / `text` / `polyline` / `polygon` | `Material` objects | no | vector layers |
| `raster` / `hillshade` / `elevationHeatmap` | `Material` objects | no | raster layers (`hillshade`/`elevationHeatmap` need raster-dem) |
| `terrain` | `TerrainMaterial` | no | terrain layers |
| `model` | `ModelMaterial` | no | 3d-tiles layers |

Layer ↔ source matrix: `vector ← {geojson, vector-tile}` · `raster ← {raster-tile, raster-dem}` · `terrain ← {raster-dem, quantized-mesh}` · `3d-tiles ← {3d-tiles}`. Material field tables → [reference-materials.md](reference-materials.md).

**Returns**: `{ layerId }`. **Note**: layers render in the order added (terrain before imagery).

### `updateLayer`

Partial merge — omitted fields/materials preserved (all `.update()` calls merge). Changing `source` rebuilds; unknown sourceId silently ignored.

| Param | Type | Required |
|---|---|---|
| `viewId`, `layerId` | `string` | yes |
| `desc` | `LayerDescription` | yes |

### `deleteLayer`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId`, `layerId` | `string` | yes | terrain deletion → globe falls back to flat ellipsoid |

### `listLayers` *(derived read-only tool)*

**Returns**: `[{ layerId, type, sourceId }]` — from the bridge's handle registry (the API returns handles, not a list; the bridge tracks them).

---

## descriptors (mesh / light / effect)

Descriptors require registered classes — satisfied by `defaultPlugin: true` in `createView` or `registerDescriptor`.

### `registerDescriptor`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `kind` | `"mesh" \| "light" \| "effect"` | yes | |
| `key` | `string` | yes | name used in the `add*` config |
| `className` | `string` | yes | e.g. `"BoxMeshDesc"` — resolvable only for classes shipped in the bridge bundle |

### `addMesh`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `descriptor` | `Record<string, object>` | yes | single-key object: `{ box: {...} }`, `{ gltfModel: { url } }`, … — key = registered descriptor key |
| `id` | `string` | no | auto-generated if omitted |
| `visible` | `boolean` | no | default `true` |
| `geodetic` | `GeodeticPlacement` | no | `{ lng, lat, height=0, heading=0, pitch=0, roll=0, scale=1, heightReference: "ellipsoid"\|"terrain" }` — preferred geographic placement (glTF-compatible WUN frame) |
| `position` / `rotation` / `scale` | `{x,y,z}` | no | raw ECEF placement; `rotation` in **radians**; becomes local offset when a frame is set |
| `matrixWorld` | `number[16]` | no | column-major; mutually exclusive with `geodetic` |
| `pickable` | `boolean` | no | default `false`; requires `picking: true` |

**Returns**: `{ objectId }`. Descriptor field tables → [reference-descriptors.md](reference-descriptors.md). **Rejections**: unknown key; both `geodetic` and `matrixWorld` set (`ConflictingTransformError`).

### `addLight` / `addEffect`

Same envelope as `addMesh` minus placement/pickable. Config keys: lights `sun / ambient / skyLightProbe / lightProbe`; effects `aerialPerspective / clouds / fogLight / fxaa / smaa / ssao / ssr / toneMapping / depthOfField / lensFlare / rainDrop / selectiveBloom / selectiveOutline / colorGradingLUT / skyEnvMap`.

**Returns**: `{ objectId }` — the effect `id` is also the token meshes use in `effectIds` for selective effects.

### `updateObject`

Partial update for any mesh/light/effect handle (vs. layers which need full descriptions).

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId`, `objectId` | `string` | yes | |
| `descriptor` | `Record<string, object>` | no | partial per-key config (e.g. `{ box: { height: 300 } }`) |
| `visible` | `boolean` | no | |
| `geodetic` | `Partial<GeodeticPlacement>` | no | untouched sub-fields preserved |

**Rejections**: creation-only fields (e.g. splat `url`, `draped`, sun `distance`, axesHelper `size`, ssr `blendMode`) — delete and re-add instead.

### `deleteObject`

| Param | Type | Required |
|---|---|---|
| `viewId`, `objectId` | `string` | yes |

### `addDefaultPhotorealScene`

One-call photoreal preset (sky, stars, skyLightProbe, sun, aerialPerspective, lensFlare (desktop), toneMapping, smaa/fxaa).

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | must be called after init (always true via MCP) |
| `deferredLighting` | `boolean` | no | default `false`; enables aerial-perspective `irradiance` + sets `view.lit = false` |
| `shadow` / `specular` | `boolean` | no | default `false`; **no-op without `deferredLighting`** |

**Returns**: `{ objectIds: { sky, sun, aerialPerspective, ... } }`.

---

## terrain

### `sampleTerrainHeight`

Synchronous, resident-tiles-only (coarse when far from terrain).

| Param | Type | Required |
|---|---|---|
| `viewId` | `string` | yes |
| `positions` | `{ lat, lng }[]` | yes |

**Returns**: `heights: (number \| null)[]` — `null` when no terrain data resident. Respects terrain `exaggeration`.

### `sampleTerrainMostDetailed`

Accurate async sampling; use before placing objects on the ground.

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId`, `sourceId` | `string` | yes | raster-dem or quantized-mesh source |
| `positions` | `{ lat, lng }[]` | yes | |
| `level` | `number` | no | fixed zoom level (no parent fallback) |

**Returns**: `[{ lat, lng, height: number \| null, level }]` in input order.

### `sampleTerrainHeightRange`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `extent` | `{ west, south, east, north }` | yes | degrees; `west ≤ east` (no antimeridian) |

**Returns**: `{ min, max }` (meters; `0` where no tiles loaded) or error before terrain setup.

---

## picking

### `pickTerrainPosition` / `pickDepthPosition`

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId` | `string` | yes | |
| `x` / `y` | `number` | yes | CSS pixels (`MouseEvent.clientX/Y`) |

**Returns**: `{ x, y, z }` ECEF or `{ hit: false }`. `pickDepthPosition` hits any geometry (terrain, meshes, 3D Tiles); `pickTerrainPosition` terrain only.

---

## styling

### `styleFeatures`

Applies per-feature dynamic styling to a vector/3d-tiles layer (wraps the `featureUpdated` + `FeatureEvaluator.evaluate` pattern). The bridge installs a persistent evaluator; call `forceUpdate` (via `updateLayer`) to re-run after data changes.

| Param | Type | Required | Notes |
|---|---|---|---|
| `viewId`, `layerId` | `string` | yes | |
| `filterProperties` | `string[]` | no | only these property keys are read (performance) |
| `rules` | `Array<{ when?: Expr; value: EvaluatedValue }>` | yes | first matching rule wins; `when` is a JSON predicate over feature properties, e.g. `{ "height": { "gt": 50 } }`; omit `when` = default rule |

`EvaluatedValue` fields: `color` (CSS string), `show`, `height`, `extrudedHeight`, `text`, `width`, `size`, `opacity`, `image`, `facing` (`"upright"\|"flat"`), `rotateWithCamera`, `rotation`, `letterSpacing`, `declutterPriority`, `emissive`, `emissiveIntensity` (see [api-threeview.md](api-threeview.md#featureevaluator)).

**Returns**: `{ applied: true }`.

---

## environment

| Tool | Params | Returns | Notes |
|---|---|---|---|
| `setAtmosphereDate` | `viewId`, `date: string` (ISO; use `Z`) | `{ sunDirection: {x,y,z}, moonDirection: {x,y,z} }` | Drives sun/moon, `SunLightDesc`, `SkyMeshDesc` |
| `matchSunTimeAt` | `viewId`, `lng`, `hours: number (0–24)` | `{ date }` | Adjust date so local solar time at `lng` = `hours` |
| `matchSunElevationAt` | `viewId`, `from: {lat,lng}`, `to: {lat,lng}` | `{ date }` | Match shadow length/brightness; clamps at polar night |
| `getSunState` | `viewId`, `position?: {lat,lng}` | `{ sunDirection, moonDirection, isAtNight?, sunElevation? }` | |
| `setGlobeOptions` | `viewId`, `options: Partial<{ color, hideUnderground, transparent, opacity, wireframe, elevationColormap }>` | `{ ok }` | `maxSse`/`segments`/`useNormal` are creation-only (via `createView`) |
| `setToneMappingExposure` | `viewId`, `exposure: number` | `{ ok }` | ~10 satellite, ~3 bright styles, ~6 deferred-lit |

## fonts

| Tool | Params | Returns | Notes |
|---|---|---|---|
| `addFontFamilyFromCss` | `viewId`, `family: string`, `cssUrl: string \| string[]`, `options?: { fontFamily?, fontWeight?, fontStyle? }` | `{ family }` | Parses `@font-face` from stylesheet; font files lazy-load. Text layers render nothing without a font |
| `removeFontFamily` | `viewId`, `family: string` | `{ ok }` | |

## memory

| Tool | Params | Returns | Notes |
|---|---|---|---|
| `getMemoryStats` | `viewId` | `MemoryStats` + `WorkerMemoryStats` | See api-threeview.md; `undefined` before init (always post-init here) |
| `setSseMultiplierRange` | `viewId`, `min`, `max` | `{ ok }` | `(1, 1)` disables memory-pressure degrade |
| `setCacheBytes` | `viewId`, `bytes: number \| null` | `{ ok }` | `null` disables budgeting; lowering evicts over next frames |

## events

Push events need a subscription bridge. Design: `subscribeEvent` registers a server-side listener; events arrive as JSON-RPC notifications.

| Tool | Params | Notes |
|---|---|---|
| `subscribeEvent` | `viewId`, `event` ∈ `click \| featureClick \| featureHover \| idle \| preRender \| postRender \| camera:movestart \| camera:moveend \| layer:<event>` , `throttleMs?` | `featureClick` payload: `{ batchId, properties?, layerId? } \| null`; requires `picking: true`. Pointer events carry `map: {x,y,z}` ECEF |
| `unsubscribeEvent` | `viewId`, `event` | |

**Note**: `featureHover/featureEnter/featureLeave` are mouse-only; camera events are suppressed during follow modes — poll `getCameraState`.

---

## Session recipes

**Show a city with terrain and buildings:**

```
createView({ shadow: true }) →
addSource({ type: "quantized-mesh", url, requestVertexNormals: true, maxZoom: 18 }) →
addLayer({ type: "terrain", source, terrain: { castShadow: true, receiveShadow: true } }) →
addSource({ type: "raster-tile", url }) → addLayer({ type: "raster", source }) →
addSource({ type: "3d-tiles", url: tilesetUrl }) → addLayer({ type: "3d-tiles", source, model: { show: true } }) →
addDefaultPhotorealScene({}) → setAtmosphereDate({ date: "...Z" }) → setToneMappingExposure({ exposure: 10 }) →
flyTo({ lng, lat, height: 0, distance: 3000, pitch: -45 })
```

**Place a model on the ground:**

```
sampleTerrainMostDetailed({ sourceId, positions: [{ lat, lng }] }) →
addMesh({ descriptor: { gltfModel: { url } }, geodetic: { lng, lat, height: <sampled>, heading: 45 } })
```

**Style GeoJSON by property:**

```
addSource({ type: "geojson", data }) →
addLayer({ type: "vector", source, polygon: { color: "#00aaff", clampToGround: true, transparent: true, opacity: 0.6 } }) →
styleFeatures({ layerId, filterProperties: ["population"], rules: [
  { when: { population: { gt: 1000000 } }, value: { color: "#ff0000" } },
  { value: { color: "#00aaff" } }
]})
```
