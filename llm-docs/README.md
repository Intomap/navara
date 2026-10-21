# Navara LLM Docs

Machine-oriented documentation for **Navara** (`@navaramap/*`): a 3D globe map engine (Rust/WASM GIS core + Three.js rendering). Everything here is distilled from the official docs so that an LLM or coding agent can read it top-to-bottom and call the API correctly on the first try. Plain Markdown — not part of the Starlight docs site.

## Package map

| Package | Install | Role | When needed |
|---|---|---|---|
| `@navaramap/three` | always | `ThreeView`, source/layer API, camera, events; re-exports `@navaramap/three-api` math | Always |
| `@navaramap/three-default-plugin` | almost always | `DefaultPlugin`: bulk-registers all default descriptors (mesh/effect/light); `addDefaultPhotorealScene()` | Almost always |
| `@navaramap/three-default-descs` | via plugin or direct | Individual descriptor classes (`BoxMeshDesc`, `SunLightDesc`, …) and their types | Direct imports / manual registration |
| `@navaramap/three-api` | optional | Engine-free GIS math (coordinate transforms, geodesic, RTE). Also re-exported from `@navaramap/three` | GIS math without the map engine |
| `@navaramap/three-plugins` | optional | `PersonViewPlugin`, `OverlayPlugin`, `CesiumIonPlugin`, `TileJsonPlugin`, `moveOverlayElement` | Use-case plugins |
| `@navaramap/maplibre-style` | optional (experimental) | `MapLibreStylePlugin`: render MapLibre Style JSON | MapLibre style compatibility |

Peer dependencies: `three`, `postprocessing`.

```bash
npm install @navaramap/three @navaramap/three-default-plugin three postprocessing
```

## Reading order

1. **[getting-started.md](getting-started.md)** — install, canonical lifecycle (`init → source → layer → update/delete → camera → terrain`), ordering rules and gotchas. **Read this first.**
2. **[reference-types.md](reference-types.md)** — shared types (`CameraPosition`, `LatLngHeight`, `GeodeticPlacement`, `Color`, …) used by everything else.
3. **[api-threeview.md](api-threeview.md)** — `ThreeView` complete method/property/event reference plus sub-APIs (`view.camera`, `view.globe`, `view.atmosphere`, `Color`, `ColorMap`, `FeatureEvaluator`, fonts).
4. **[api-three-api.md](api-three-api.md)** — `@navaramap/three-api` functions: coordinate transforms, tangent frames, geodesic, RTE, geometry builders.
5. **[reference-sources-layers.md](reference-sources-layers.md)** — the 7 source types and 4 layer types with field tables, and the `Source`/`Layer` handle contracts.
6. **[reference-materials.md](reference-materials.md)** — the 11 layer material objects (field/type/default tables).
7. **[reference-descriptors.md](reference-descriptors.md)** — all default mesh/effect/light descriptors (key, class, fields).
8. **[reference-plugins.md](reference-plugins.md)** — plugin registration rules and option tables.
9. **[mcp-tools.md](mcp-tools.md)** — the same capability set expressed as an MCP-style tool catalog (tool name + description + params + returns), modeled on the cesium-mcp command paradigm.

## Terminology and conventions

- **Degrees everywhere** in public API (`lng`, `lat`, `heading`, `pitch`, `roll`, camera `fov`). Radians appear only in Euler `rotation` fields and Three.js math. `height`/`alt` are **meters above the WGS84 ellipsoid** unless stated otherwise (e.g. `heightReference: "terrain"`).
- **ECEF** = Earth-Centered Earth-Fixed cartesian meters (`{x, y, z}` / Three.js `Vector3`).
- **`heading`** is degrees clockwise from north (0 = north). `pitch` negative = looking down. Asset "front" is glTF `+Z`.
- **Coordinate convention** (`LatLngHeight`): `{ lat, lng, height }` — note the `lat`-first field name, `lng` (not `lon`).
- `Color` is Navara's own class (`new Color().setStyle("#ff0000")`); a few descriptor fields take a plain **hex number** instead — flagged per field in the reference tables.
- Field tables use: **Field | Type | Default | Notes**. "Required" means no default. "**Creation-only**" means the field cannot be changed via `update()` — delete and re-add the object instead.
- Handles are invalid after `delete()`; `Layer.update()` overwrites with a full description, `BaseHandle.update()` (mesh/light/effect) is partial.

## Hard invariants (violating these breaks code)

1. `new ThreeView(options)` → `view.addPlugin(p)` (**before** init; throws afterwards) → `await view.init()` → everything else.
2. `shadow: true` is **constructor-only**.
3. Descriptor classes must be registered (`registerMesh/registerLight/registerEffect` or `DefaultPlugin`) before the matching `addMesh/addLight/addEffect`. Layers need no registration.
4. `addSource` before any layer referencing it; delete layers before their source (`source.delete()` returns `false` while referenced).
5. Layer ↔ source type compatibility: `vector ← {geojson, vector-tile}`; `raster ← {raster-tile, raster-dem}`; `terrain ← {raster-dem, quantized-mesh}`; `3d-tiles ← {3d-tiles}`.
6. Feature-picking events (`featureClick`, …) require `picking: true` (default).
7. Plugin post-init calls (`personView.start()`, `cesiumIon.addTerrain()`, `tilejson.addSource()`, `plugin.addDefaultPhotorealScene()`) must run **after** `await view.init()`.

Source of truth: `docs/src/content/docs/` in the navara repository (mirrored under `public/docs/`).
