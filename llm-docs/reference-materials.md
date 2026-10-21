# Materials Reference

Layer render/styling objects. Field tables: **Field | Type | Default | Notes**. "**R**" = required. Build-time-only fields are flagged — they cannot be changed via `layer.update()` (re-create the layer).

| Layer | Material keys |
|---|---|
| `vector` | `point`, `billboard`, `text`, `polyline`, `polygon` |
| `raster` | `raster`, `hillshade`*, `elevationHeatmap`* |
| `terrain` | `terrain` |
| `3d-tiles` | `model` |

*raster-dem source only.

## `point` (vector)

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | `Color` | **R** | |
| `size` | `number` | **R** | meters (px when `sizeInMeters: false`) |
| `height` | `number` | **R** | meters |
| `center` | `{x,y}` | **R** | pivot shift 0–1 |
| `clampToGround` | `boolean` | **R** | |
| `sizeInMeters` | `boolean` | `true` | |
| `opacity` | `number` | `1.0` | pair with `transparent` |
| `transparent` | `boolean` | — | may misbehave with effects |
| `show` | `boolean` | — | |
| `depthTest` | `boolean` | `true` | |
| `pointFacing` | `"upright" \| "flat"` | `"upright"` | per-feature `facing` |
| `rotateWithCamera` | `boolean` | `true` | upright+true = screen-aligned; upright+false = fixed bearing; flat+true = painted facing viewer; flat+false = painted north-up |
| `backfaceCulling` | `boolean` | `false` | only matters with fixed orientation |
| `rotation` | `number` | `0.0` | deg CW from front; per-feature |
| `offsetDepth` | `boolean` | — | prevents z-clipping into surface |
| `declutter` / `declutterPriority` | `boolean` / `number` | `true` / `0.0` | screen-space decluttering; priority per-feature |
| `effectIds` | `string[]` | — | selective effect descriptor ids |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | — | bloom pairing |
| `geometryTypes` | `("point"\|"line"\|"polygon")[]` | `["point"]` | **build-time** |
| `placement` | `"point" \| "line" \| "line-center"` | `"point"` | **build-time** |
| `spacing` | `number` | `250.0` | screen px for `placement: "line"`; **build-time** |
| `rotateToLine` | `boolean` | `true` | **build-time** |

## `billboard` (vector)

All `point` fields apply (`pointFacing` → `billboardFacing`), plus:

| Field | Type | Default | Notes |
|---|---|---|---|
| `url` | `string` | — | Default image per feature; per-feature override via evaluator `image` (`null` reverts). Omit when ALL images come from the evaluator |
| `alphaTest` | `number` | — | Alpha threshold |
| `billboardFacing` | `"upright" \| "flat"` | `"upright"` | |

## `text` (vector)

**No `font` = nothing renders.**

| Field | Type | Default | Notes |
|---|---|---|---|
| `text` | `string` | — | Label content (often per-feature via evaluator) |
| `font` | `string` | — | **Required to render.** Font file URL or family registered via `view.addFontFamily()` |
| `size` | `number` | — | px (or meters when `sizeInMeters`) |
| `sizeInMeters` | `boolean` | `true` | |
| `color` | `Color` | — | |
| `opacity` | `number` | `1.0` | |
| `transparent` | `boolean` | `true` | |
| `height` | `number` | — | meters |
| `center` | `Vec2` | — | pivot 0–1 |
| `clampToGround` | `boolean` | — | |
| `offsetDepth` | `boolean` | — | |
| `depthTest` | `boolean` | `true` | |
| `backfaceCulling` | `boolean` | `false` | |
| `textFacing` | `"upright" \| "flat"` | `"upright"` | same 2×2 table as billboard |
| `rotateWithCamera` | `boolean` | `true` | unused for line placement (except `spreadGlyphs`) |
| `rotation` | `number` | `0.0` | deg; unused for line placement |
| `declutter` / `declutterPriority` | `boolean` / `number` | `true` / `0.0` | |
| `effectIds` | `string[]` | — | bloom glows glyph fill only |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | — | |
| `outlineColor` / `outlineWidth` / `outlineOpacity` | `Color` / `number` / `number` | — / `0.0` / — | px; 0–1 |
| `backgroundColor` | `Color` | — | |
| `borderColor` / `borderWidth` | `Color` / `number` | — / — | width ratio 0–0.5 of frame height |
| `lang` | `string` | — | shaping language (`"en"`, `"ja"`, `"ar"`) |
| `letterSpacing` | `number` | `0` | ems; per-feature |
| `lineHeight` | `number` | `1.0` | |
| `maxWidth` | `number` | `0` (no wrap) | ems; `\n` always breaks |
| `textAlign` | `"left" \| "center" \| "right"` | `"center"` | multi-line only |
| `highQuality` | `boolean` | `false` | MSDF vs SDF atlas |
| `geometryTypes` / `placement` / `spacing` | | `["point"]` / `"point"` / `250.0` | **build-time** |
| `keepUpright` | `boolean` | `true` | **live-updatable** |
| `lineOffset` | `number` | `0.0` | sideways shift; positive = left of travel; **live-updatable** |
| `maxAngle` | `number` | `45.0` | deg of allowed bend; **live-updatable** |
| `spreadGlyphs` | `boolean` | `false` | per-glyph along line; **live-updatable**; per-feature |

## `polyline` (vector)

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | `Color` | **R** | |
| `width` | `number` | **R** | px |
| `clampToGround` | `boolean` | **R** | |
| `show` | `boolean` | — | |
| `height` | `number` | — | meters |
| `tiled` | `boolean` | `false` | forced `true` by clampToGround |
| `maxWidth` | `number` | — | clamp on rendered width in **world meters** (default 1000) — raise for high-altitude views |
| `transparent` | `boolean` | `false` | |
| `depthWrite` | `boolean` | `true` | `false` for transparent lines |
| `castShadow` / `receiveShadow` | `boolean` | — | |
| `lit` | `boolean` | follows `view.lit` | `false` = plain albedo |
| `effectIds` | `string[]` | — | |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | — | |
| `geometryTypes` | `("line"\|"polygon")[]` | `["line"]` | **build-time** |

## `polygon` (vector)

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | `Color` | **R** | |
| `show` | `boolean` | — | |
| `height` | `number` | — | meters; only when not clamped |
| `extrudedHeight` | `number` | — | only when not clamped |
| `perPositionHeight` | `boolean` | — | per-vertex heights from data |
| `clampToGround` | `boolean` | — | |
| `opacity` | `number` | — | requires `transparent: true` |
| `transparent` | `boolean` | — | may misbehave with effects |
| `tiled` | `boolean` | `false` | forced by clampToGround; **outline unsupported when tiled** |
| `outline` | `boolean` | — | **initial-load only**; inferred from `outlineShow` |
| `outlineShow` / `outlineColor` / `outlineWidth` | `boolean` / `Color` / `number` | — | GeoJSON only |
| `surfaceShow` | `boolean` | — | GeoJSON only; with `outlineShow` |
| `wireframe` | `boolean` | — | |
| `castShadow` / `receiveShadow` | `boolean` | — | |
| `lit` | `boolean` | follows `view.lit` | |
| `roughness` | `number` | `0.44` | used by SSR / aerial specular |
| `reflectivity` | `number` | — | F0; <0.01 disables SSR/aerial specular |
| `ior` | `number` | — | |
| `shininess` / `specular` / `specularStrength` | `boolean \| number` | — | |
| `effectIds` | `string[]` | — | |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | — | |
| `water` / `applyWaterNormal` | `boolean` | — | water pipeline (needs `waterTexture` option + watermask terrain for full effect) |
| `waterScaleNormal` / `waterSpeed` | `number` | — | smaller scale = rougher |

## `raster` (raster)

| Field | Type | Default | Notes |
|---|---|---|---|
| `show` | `boolean` | — | |
| `color` | `Color` | — | tint |
| `opacity` | `number` | — | 0–1 |
| `showBoundingBox` | `boolean` | — | debug |

## `hillshade` (raster, raster-dem)

| Field | Type | Default | Notes |
|---|---|---|---|
| `exaggeration` | `number` | `1.0` | elevation-difference factor |

Decoder comes from the **source**. Can stack over a terrain layer for per-pixel normals.

## `elevationHeatmap` (raster, raster-dem)

| Field | Type | Default | Notes |
|---|---|---|---|
| `minHeight` / `maxHeight` | `number` | `0` / `1000` | meters; colormap range |
| `logarithmic` | `boolean` | `false` | |
| `logBoundary` | `number` | `0` | log base. **Pass it explicitly in headless/software-GL environments** — omitting it produces a NaN uniform that renders one constant color on SwiftShader (browsers are unaffected) |

Colormap: `view.globe.elevationColormap = new ColorMap(...)` (global).

## `terrain` (terrain)

| Field | Type | Default | Notes |
|---|---|---|---|
| `show` | `boolean` | `true` | |
| `castShadow` / `receiveShadow` | `boolean` | `false` | shadows need constructor `shadow: true` + sun `castShadow` |
| `lit` | `boolean` | follows `view.lit` | needs normals (`requestVertexNormals` or hillshade) |
| `showBoundingBox` | `boolean` | `false` | debug |
| `skirt` | `boolean` | `true` | `false` to see underground models |
| `skirtExaggeration` | `number` | `1.0` | |
| `exaggeration` | `number` | `1` | vertical exaggeration; **runtime-updatable via `layer.update()`**; reset on delete; sampling/heightReference `"terrain"` return exaggerated heights; 3D Tiles/glTF NOT stretched |
| `exaggerationRelativeHeight` | `number` | `0` | meters kept in place: `(h − rel) × exaggeration + rel` |

## `model` (3d-tiles)

| Field | Type | Default | Notes |
|---|---|---|---|
| `show` | `boolean` | — | |
| `color` | `Color` | — | |
| `opacity` / `transparent` | `number` / `boolean` | `1.0` / `false` | |
| `metalness` / `roughness` / `ior` / `reflectivity` | `number` | — | read by SSR / aerial specular |
| `shininess` / `specular` / `specularStrength` | `number` / `boolean` / `number` | — | `specular` enables the pair |
| `lit` | `boolean` | follows `view.lit` | |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | — | |
| `effectIds` | `string[]` | — | |
| `height` | `number` | — | meters |
| `size` | `number` | — | scale factor |
| `shouldRotateInDefault` | `boolean` | — | auto-orient on ellipsoid |
| `castShadow` / `receiveShadow` | `boolean` | — | castShadow needs view shadows + sun castShadow |
| `maxSse` | `number` | — | LOD SSE; higher = faster/lower quality |
| `pointSize` | `number` | — | point clouds |
| `depthWrite` | `boolean` | `true` | |
| `showBoundingBox` | `boolean` | — | debug |
| `normals` | `boolean` | — | recompute creased normals |
| `creaseNormalAngle` | `number` | `π/6` | radians; when `normals` on |
| `animationActiveClip` | `string` | — | clip name (full control → `gltfModel` descriptor) |
| `animationSpeed` | `number` | — | 1.0 = normal |
| `water` / `applyWaterNormal` / `waterScaleNormal` / `waterSpeed` | `boolean` / `number` | — | water pipeline |
