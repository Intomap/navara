# Getting Started — Core Call Paths

Canonical sequences for every common task with `@navaramap/three`. Read [README.md](README.md) for terminology and hard invariants.

## Install

```bash
npm install @navaramap/three @navaramap/three-default-plugin three postprocessing
# optional:
npm install @navaramap/three-plugins        # person view / overlay / Cesium Ion / TileJSON
npm install @navaramap/three-default-descs  # descriptor classes/types for direct import
```

Install every package your code imports from **explicitly** (transitive deps are not importable under pnpm strict resolution) — importing descriptor types requires installing `@navaramap/three-default-descs` even when the plugin is installed.

Fullscreen page: `<body style="margin:0; width:100%; height:100%; overflow:hidden;">`.

## Canonical lifecycle

```
const plugin = new DefaultPlugin();                     // or individual register* calls
const view = new ThreeView<DefaultDescriptions>({ ... });// constructor options: [api-threeview.md](api-threeview.md)
view.addPlugin(plugin);                                  // MUST be before init(); throws after
await view.init();                                       // WASM + workers + render loop
plugin.addDefaultPhotorealScene();                       // optional photoreal sky/sun/atmosphere preset
// now: addSource / addLayer / addMesh / addLight / addEffect / setCamera / flyTo / events
```

When using `DefaultPlugin`, parameterize as `new ThreeView<DefaultDescriptions>(...)` (import the type from `@navaramap/three-default-plugin`) so descriptor keys are typed.

Minimal runnable example (raster basemap):

```ts
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView({ container: document.body });
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const source = view.addSource({
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source, raster: {} });

view.setCamera({ lng: 139.7671, lat: 35.6812, height: 2_000_000, pitch: -90 });
```

Photoreal earth variant:

```ts
const view = new ThreeView({ useNormal: true }); // useNormal only when NO terrain/hillshade layer exists
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();
plugin.addDefaultPhotorealScene({ deferredLighting: false }); // see options in reference-plugins.md
view.atmosphere.date = new Date("2026-07-16T01:00:00Z");      // trailing Z = deterministic UTC sun position
view.toneMappingExposure = 10;                                // satellite imagery ≈ 10; bright map styles ≈ 3
```

## Path 1: data layers (source → layer)

1. `view.addSource(desc)` → `Source` handle. `id` omitted → auto-generated; re-adding an existing id **overrides**.
2. `view.addLayer({ type, source, ...materials })` → `Layer` handle. `source` may be the handle or its id string.

```ts
// GeoJSON vector with styled polygons
const source = view.addSource({ type: "geojson", data: geojson });
const layer = view.addLayer({
  type: "vector",
  source,
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true, transparent: true, opacity: 0.6 },
});

// Terrain + imagery: add the terrain layer FIRST — layers render in the order added
const dem = view.addSource({ type: "quantized-mesh", url, requestVertexNormals: true, maxZoom: 18 });
view.addLayer({ type: "terrain", source: dem, terrain: { castShadow: true, receiveShadow: true } });
view.addLayer({ type: "raster", source: imagerySource, raster: {} }); // drapes over the terrain

// 3D Tiles (Google Photorealistic etc.)
const tiles = view.addSource({ type: "3d-tiles", url: "https://.../tileset.json" });
view.addLayer({ type: "3d-tiles", source: tiles, model: { show: true } });
```

Update/delete semantics (all `.update()` calls are **partial merges** — omitted fields/materials are preserved):

- `source.update(desc)`: partial but requires `type` (unchangeable) and `url`; tears down and reloads every referencing layer. **Caveat**: inline GeoJSON `data` does not reliably reload via `source.update()` — for dynamic inline data, delete and rebuild both (`layer.delete(); source.delete();` then re-add).
- `source.delete(): boolean` — `false` while any layer still references it (delete layers first).
- `layer.update(desc)` — partial merge into current config; changing `source` re-points and rebuilds; unknown source id is silently ignored (rest of update applies).
- `layer.delete()` — terrain layer deletion falls back to the flat ellipsoid. Toggling terrain off: `update({ terrain: { show: false } })` has no visible effect — delete/re-add the layer.

## Path 2: per-feature styling (FeatureEvaluator)

```ts
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(
    ({ properties }) => {
      const h = properties?.["height"] as number | undefined;
      return { color: new Color().setStyle(h && h > 50 ? "#ff0000" : "#00ff00"), extrudedHeight: h ?? 0 };
    },
    { filters: ["height"] }, // only these property keys are read (performance)
  );
});
// Re-run evaluation after external state changes (e.g. selection):
layer.forceUpdate();
```

`EvaluatedValue` fields: `color, show, height, extrudedHeight, text, width, size, letterSpacing, opacity, declutterPriority, image, facing, rotateWithCamera, spreadGlyphs, rotation, emissive, emissiveIntensity` — all optional; evaluated values override material defaults. Evaluated values **persist per feature** — an evaluator that stops returning a property leaves the last value in place (return the material value to hand control back). `layer.update()` re-emits `featureUpdated`, so a registered evaluator re-runs and reapplies. See [api-threeview.md](api-threeview.md#featureevaluator).

## Path 3: camera

```ts
view.setCamera({ lng: 139.75, lat: 35.68, height: 1000, heading: 0, pitch: -45, roll: 0 }); // instant
const done = await view.flyTo({ lng: 139.7454, lat: 35.6586, height: 0, distance: 2000, pitch: -30 },
                              { duration: 4000, maxHeight: 5000 }); // false = interrupted
view.lookAt({ lng, lat, height: 0 }, new Vector3(0, 0, 1000));       // ENU offset from target
view.cameraFollow(true, { lng, lat, height }, new Vector3(0, -200, 100));
view.cameraFreeLook(true, { lng, lat, height });                      // position-locked look-around
```

Details and the rest (`moveCamera`, `rotateAround`, FOV, interactive `CameraOptions`, camera events) → [api-threeview.md](api-threeview.md).

## Path 4: terrain queries

```ts
// synchronous, reads only tiles already resident (coarse from far away)
const h = view.sampleTerrainHeight({ lat: 35.6812, lng: 139.7671 });

// async, most-detailed; accurate regardless of camera; use before placing objects
const terrain = view.addSource({ type: "quantized-mesh", url, maxZoom: 15 });
const [ground] = await view.sampleTerrainMostDetailed(terrain, [{ lat, lng }]);
if (ground.height !== undefined) { /* place model at height: ground.height */ }

// min/max over an extent (sizing volumes that must enclose the ground)
const range = view.sampleTerrainHeightRange({ west: 138.7, south: 35.3, east: 138.8, north: 35.4 });

// push-style observers (return cleanup functions)
const stop = view.observeTerrainHeightAt({ lat, lng }, (height) => { ... });
const stop2 = view.observeTerrainHeightRange(extent, ({ min, max }) => { ... });
```

Heights follow the terrain layer's `exaggeration`.

## Path 5: meshes / lights / effects (descriptors)

Registration precedes `add*` — `DefaultPlugin` covers everything; otherwise:

```ts
import { BoxMeshDesc, SunLightDesc, SSAOEffectDesc } from "@navaramap/three-default-descs";
view.registerMesh("box", BoxMeshDesc);
view.registerLight("sun", SunLightDesc);
view.registerEffect("ssao", SSAOEffectDesc);
```

```ts
const handle = view.addMesh({                       // placement via geodetic frame (WUN, glTF-compatible)
  box: { width: 100, height: 200, depth: 100, color: new Color().setStyle("#ff8800") },
  geodetic: { lng: 139.76, lat: 35.68, height: 0, heading: 45 },
  pickable: true,
});
handle.update({ box: { height: 300 } });            // partial update
handle.delete();

view.addLight({ sun: { castShadow: true, shadowFar: 1000 } });
view.addEffect({ toneMapping: { mode: ToneMappingMode.AGX } });
view.addEffect({ smaa: { quality: "ultra" } });
```

Selective effects: mesh `effectIds: [effectHandle.id]` opts that mesh into e.g. `selectiveBloom` / `selectiveOutline`.

Descriptor field tables → [reference-descriptors.md](reference-descriptors.md).

## Path 6: events + picking

```ts
view.on("click", (e) => { e.map.x /* ECEF on globe */; });
view.on("featureClick", (info) => {                 // requires picking: true (default)
  // info: { batchId, properties?, layerId? } | null
});
view.on("idle", () => { /* no tile activity for idleThreshold ms */ });
```

Full event table → [api-threeview.md](api-threeview.md#events).

## Gotcha checklist

| Gotcha | Rule |
|---|---|
| `addPlugin` after `init()` | **Throws.** Always register plugins before init. |
| `shadow: true` later | Impossible — constructor-only. |
| Sun shadows do nothing | Requires constructor `shadow: true` + `sun.castShadow: true` + `castShadow/receiveShadow` on objects. |
| Person-sized shadows invisible | `sun.shadowFar` defaults to 50 km — tighten (e.g. 1000). |
| Vector-tile labels invisible | `text.font` is mandatory for text rendering. |
| Model rotated 90°/180° | Source engine disagrees on the front axis; adjust `geodetic.heading` (glTF front = `+Z`). |
| `position` alone puts model at odd orientation | Bare `position` is raw ECEF — use `geodetic` (or a tangent-frame `matrixWorld`) for geographic placement. |
| `layer.update()` didn't change geometry types / placement / polygon outline | Those are build-time-only (see [reference-materials.md](reference-materials.md)) — re-create the layer. |
| Polyline invisible (black on dark basemap) | Non-draped (`clampToGround: false`) polylines are **lit** — with zero lights they draw black. Add `view.addLight({ ambient: { intensity: 1 } })` (draped lines ignore lights). |
| High-altitude polyline sub-pixel | `width` is screen px but clamped by `maxWidth` in **world meters** (default 1000) — raise it (e.g. `100_000`) for high views. |
| Two stacked point/sprite layers: underlay vanishes | `declutter` is on by default — set `declutter: false` on both layers. |
| WASM math (`geodeticToVector3`, `EllipsoidGeodesic`, …) throws at module top level | It requires `view.init()` (or standalone `initNavaraApi()`); call after init. |
| Draped polygons look unlit | Deferred/irradiance interplay — see `deferredLighting` note in [reference-plugins.md](reference-plugins.md). |
| `deferredLighting: true` double-lighting | It sets `view.lit = false`; scenes needing forward shadows/transparent-material lighting must keep `irradiance: false`. |
| Weather effects frozen | `rain`/`snow`/`rainDrop` need `animation: true` (constructor or `view.animation = true`). |
| Two transforms set | `matrix` / `matrixWorld` / `geodetic` are mutually exclusive — throws `ConflictingTransformError`. |
| Camera events silent during follow | `cameraFollow`/`cameraFreeLook` suppress `movestart/move/moveend` — poll `camera.positionGeographic` on `preRender`. |
| Cesium Ion terrain via `addSource` | Ion assets need `CesiumIonPlugin` (endpoint+token resolved at init), not a plain `quantized-mesh` source. |
