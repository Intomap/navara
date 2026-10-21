# Sources & Layers Reference

Field tables for all 7 source types and 4 layer types, plus handle contracts. Materials referenced here → [reference-materials.md](reference-materials.md).

## Source ↔ Layer compatibility

| Layer `type` | Accepts source `type` | Material keys |
|---|---|---|
| `vector` | `geojson`, `vector-tile` | `point`, `billboard`, `text`, `polyline`, `polygon` |
| `raster` | `raster-tile`, `raster-dem` | `raster`, `hillshade`*, `elevationHeatmap`* |
| `terrain` | `raster-dem`, `quantized-mesh` | `terrain` |
| `3d-tiles` | `3d-tiles` | `model` |

*require a `raster-dem` source (the elevation decoder comes from the source).

Common source semantics:
- `addSource(desc) → Source`. `id` optional (auto-generated). Re-adding an existing `id` **overrides**.
- `source.update(desc)`: partial, but `type` always required (unchangeable) and `url` required per type. Reloads every referencing layer (terrain re-meshes); layer-only settings (materials, `sourceLayers`) preserved.
- `source.delete(): boolean`: ref-counted — `false` (no-op) while referenced.
- Layers reference sources by handle or id string.

## Source types

### `geojson`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"geojson"` | yes | — | |
| `url` | `string` | no | — | Mutually exclusive with `data`; takes precedence |
| `data` | GeoJSON `FeatureCollection \| Feature \| Geometry` | no | — | Inline document |
| `crs` | `string` | no | — | |
| `tiled` | `boolean` | no | `false` | Tiled spatial index (GeoJSON-VT) for large datasets |

### `raster-tile` (XYZ / TMS imagery)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"raster-tile"` | yes | — | |
| `url` | `string` | yes | — | Template with `{z}/{x}/{y}` |
| `tms` | `boolean` | no | `false` | Y-flipped scheme |
| `minZoom` / `maxZoom` / `overscaledMaxZoom` | `number` | no | `0` / `20` / `24` | |

### `vector-tile` (MVT)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"vector-tile"` | yes | — | |
| `url` | `string` | yes | — | `{z}/{x}/{y}` template or `.pmtiles` archive (no placeholders; host needs HTTP Range + CORS; MVT payload only) |
| `maxZoom` | `number` | no | `20` | |
| `overscaledMaxZoom` | `number` | no | `24` | |
| `maxSse` | `number` | no | `2.0` | Tile traversal SSE |
| `crs` | `string` | no | — | |

Which source-layers render is chosen per **layer** via `sourceLayers`. Multiple vector layers can share one vector-tile source (shared tiles/cache).

### `raster-dem` (RGB-encoded elevation)

Powers `terrain` meshing and `hillshade` / `elevationHeatmap` raster rendering.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"raster-dem"` | yes | — | |
| `url` | `string` | yes | — | Template |
| `tms` | `boolean` | no | `false` | |
| `elevationDecoder` | `ElevationDecoder` | no | default | See below |
| `tileSize` | `number` | no | `256` | |
| `minZoom` / `maxZoom` / `overscaledMaxZoom` | `number` | no | `0` / `20` / `24` | |

Decoders — exported constants, **callable functions** (`MAPBOX_ELEVATION_DECODER()`): `MAPBOX_ELEVATION_DECODER()`, `TERRARIUM_ELEVATION_DECODER()`, `JAPAN_GSI_ELEVATION_DECODER()`. Custom decoder fields (numbers): `r_scaler` (ex. `256.0`), `g_scaler` (`1.0`), `b_scaler` (`1/256`), `offset` (`-32768`), `max_offset` (`8848`), `min_offset` (`-11034`), `boundary` (`0.01`), `epsilon` (`0.001`).

### `quantized-mesh` (Cesium terrain; default geographic EPSG:4326, TMS)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"quantized-mesh"` | yes | — | |
| `url` | `string` | yes | — | Template |
| `geographic` | `boolean` | no | `true` | `false` = WebMercator |
| `tms` | `boolean` | no | `true` | South-origin Y |
| `requestVertexNormals` | `boolean` | no | `false` | Needed for lighting / shadow-receiving terrain |
| `requestWaterMask` | `boolean` | no | `false` | Needed for water / SSR |
| `token` | `string` | no | — | Bearer `Authorization` header |
| `minZoom` / `maxZoom` / `overscaledMaxZoom` | `number` | no | `0` / `20` / `24` | |

**Cesium Ion assets** (endpoint+token resolved at runtime) → use `CesiumIonPlugin`, not `addSource`.

### `3d-tiles`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"3d-tiles"` (also `"b3dm"` / `"pnts"` for single-asset sources) | yes | — | |
| `url` | `string` | yes | — | `tileset.json` URL |
| `crs` | `string` | no | — | |

Support: 3D Tiles 1.0 (`b3dm`, `pnts`, Google Photorealistic) and 1.1 (GLB content, `EXT_mesh_features`, `EXT_structural_metadata`, Draco/meshopt/quantization). No implicit tiling; GLB containers only (no external-`.bin` `.gltf`). `pnts` limits: `POSITION_QUANTIZED`-only tiles not rendered; `RGB565`/`CONSTANT_RGBA`/`NORMAL`/`BATCH_ID`+batch-table unsupported; Draco point compression POSITION/RGB/RGBA only.

## Layer types

### `vector`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"vector"` | yes | — | |
| `source` | `SourceRef` | yes | — | geojson or vector-tile |
| `sourceLayers` | `string[]` | no | — | vector-tile only |
| `point` / `billboard` / `text` | `Material` | no | — | Point geometry (markers / icons / labels) |
| `polyline` | `Material` | no | — | LineString / MultiLineString |
| `polygon` | `Material` | no | — | Polygon / MultiPolygon |

Geometry derivation (per material `geometryTypes` + `placement`) — **build-time options**: set at layer creation; `layer.update()` only affects tiles loaded afterwards. Array **replaces** the default — include the native category to keep it:

- `point`/`billboard`/`text`: default `["point"]`; may add `"line"` / `"polygon"`.
  - point + line → one point per vertex; billboard/text + line → one per line (first vertex) unless `placement`.
  - point + polygon → one per ring vertex; billboard/text + polygon → one per part (pole of inaccessibility).
- `polyline`: default `["line"]`; may add `"polygon"` → every boundary ring as closed polyline (use polygon `outline` for extruded side edges).
- `placement` (`"point"` default | `"line"` | `"line-center"`): `"line"` repeats every `spacing` (screen px, default 250); `rotateToLine` (default `true`) rotates billboards/points.

### `raster`

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"raster"` | yes | |
| `source` | `SourceRef` | yes | raster-tile (imagery) or raster-dem (hillshade/heatmap) |
| `raster` | `RasterMaterial` | no | |
| `hillshade` | `HillshadeMaterial` | no | raster-dem only |
| `elevationHeatmap` | `ElevationHeatmapMaterial` | no | raster-dem only; colormap via `view.globe.elevationColormap` |

### `terrain`

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"terrain"` | yes | |
| `source` | `SourceRef` | yes | raster-dem or quantized-mesh |
| `terrain` | `TerrainMaterial` | no | Same options regardless of source format |

Draping: raster layers (multiple, stacked in add order) and `clampToGround` vector materials drape onto terrain. Vector-**tile** draping onto quantized-mesh is **not yet supported** (GeoJSON clampToGround works over both).

### `3d-tiles`

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"3d-tiles"` | yes | |
| `source` | `SourceRef` | yes | 3d-tiles source |
| `model` | `ModelMaterial` | no | e.g. `maxSse` for Google Photorealistic |

Layer events carry `credit` on `featureCreated`/`featureRemoved`/`featureVisibilityChanged` — use for attribution (e.g. Google ToS).

## TileJsonPlugin shortcut

`TileJsonPlugin.addSource({ type: "raster-tile" | "vector-tile" | "raster-dem", url: <tilejson.json URL>, id?, minzoom?, maxzoom?, scheme? })` fetches a TileJSON 3.0.0 document and registers the corresponding source (fields overridable per-key; `encoding` only `"mapbox"|"terrarium"`; only first `tiles[]` endpoint used). Must be called **after** `init()`. See [reference-plugins.md](reference-plugins.md).
