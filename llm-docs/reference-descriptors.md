# Descriptors Reference (Default Mesh / Effect / Light)

All descriptors registered by `DefaultPlugin` (`@navaramap/three-default-plugin`). Usage:

```ts
const handle = view.addMesh({ <key>: { ...config }, ...baseFields });
```

`handle.ref` exposes descriptor-specific methods (noted below). All fields updatable via partial `handle.update({ <key>: {...} })` unless marked **creation-only**.

## Mesh base fields (apply to every mesh descriptor)

Set at the same level as the key: `addMesh({ box: {...}, geodetic: {...}, pickable: true })`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `string` | auto | |
| `visible` | `boolean` | `true` | |
| `position` / `rotation` / `scale` | `{x,y,z}` | — | ECEF; `rotation` in **radians**; become local offsets when a frame is set |
| `matrix` | `Matrix4` | — | Local frame; `effective = matrix · T·R·S` |
| `matrixWorld` | `Matrix4` | — | World frame; `effective = matrixWorld · T·R·S` |
| `geodetic` | `GeodeticPlacement` | — | Geographic placement (WUN frame, glTF-compatible) — see [reference-types.md](reference-types.md) |
| `lit` | `boolean` | follows `view.lit` | Three-state override; shader recompiles on change |
| `pickable` | `boolean` | `false` | GPU click picking → `view.on("featureClick")` with `batchId` (single: `ref.batchId`; instanced: `ref.batchIds`) |

Transform exclusivity: at most one of `matrix` / `matrixWorld` / `geodetic` (else `ConflictingTransformError`).

**Up-axis**: `geodetic` (and `westUpNorthToFixedFrame`) need **no** correction for glTF Y-up assets; `eastNorthUpToFixedFrame`/`northWestUpToFixedFrame` need `Rx(+90°)`; `northUpEastToFixedFrame` faces east at 0 rotation. `heading` = compass bearing of the glTF `+Z` front.

## Mesh descriptors

### `arcLines` — ArclineMeshDesc
Great-circle-style arcs between 2 geographic points. Config: single partial `ArcLineConfig` or array (one descriptor, many arcs).

| Field | Type | Default | Notes |
|---|---|---|---|
| `geometry` | `{lng,lat}[]` | `[]` | exactly 2 points = one arc |
| `thickness` | `number` | `1` | |
| `segments` | `number` | `64` | curve smoothness |
| `height` | `number` | `0` | m above surface |
| `arcHeightScale` | `number` | `0.3` | arc peak vs point distance |
| `srcColor` / `tgtColor` | `Color` | `0xffffff` | gradient endpoints |
| `gradation` | `number` | `0.5` | 0 = src, 1 = tgt |
| `transparent` / `opacity` | `boolean` / `number` | `false` / `1` | |
| `dashed` / `dashSize` / `gapSize` / `dashOffset` | `boolean` / `number` | `false` / `1` / `1` / `0` | world units |
| `effectIds` | `string[]` | — | |

Animate dashes: mutate configs and `handle.update({ arcLines })` inside `view.on("preUpdate", ...)`.

### `box` — BoxMeshDesc

| Field | Type | Default | Notes |
|---|---|---|---|
| `width` / `height` / `depth` | `number` | `1` | X/Y/Z (Y-up) |
| `widthSegments` / `heightSegments` / `depthSegments` | `number` | `1` | |
| `color` | `Color` | `#ffffff` | |
| `emissiveColor` / `emissiveIntensity` | `Color` / `number` | `0x000000` / `0` | |
| `opacity` / `transparent` | `number` / `boolean` | `1` / `false` | |
| `draped` | `boolean` | `false` | Paint onto terrain (stencil decal, terrain-normal shaded); **creation-only** |
| `castShadow` / `receiveShadow` | `boolean` | `false` | |
| `effectIds` | `string[]` | — | |

### `cylinder` — CylinderMeshDesc (axis +Y; `radiusTop: 0` = cone)

`radiusTop`/`radiusBottom` (`1`/`1`), `height` (`1`), `radialSegments` (`32`), `heightSegments` (`1`), `openEnded` (`false`), `thetaStart`/`thetaLength` (rad, `0`/`2π`), `color`, `emissiveColor`/`emissiveIntensity`, `opacity`/`transparent`, `draped` (creation-only), `castShadow`/`receiveShadow`, `effectIds`.

### `sphere` — SphereMeshDesc

`radius` (`1`), `widthSegments` (`32`), `heightSegments` (`16`), `phiStart`/`phiLength` (rad), `thetaStart`/`thetaLength` (rad), `color`, `emissiveColor`/`emissiveIntensity`, `opacity`/`transparent`, `castShadow`/`receiveShadow`, `effectIds`.

### `plane` — PlaneMeshDesc

`width`/`height` (`1`/`1`), `widthSegments`/`heightSegments` (`1`), `color`, emissive pair, `opacity`/`transparent`, `castShadow`/`receiveShadow`, `effectIds`. Faces `+Z` by default — ground usage: `rotation: { x: -Math.PI/2, y: 0, z: 0 }`.

### `tube` — TubeMeshDesc (tube along Catmull-Rom curve)

| Field | Type | Default | Notes |
|---|---|---|---|
| `points` | `XYZ[]` | **R** | ≥ 2 cartesian points |
| `radius` | `number` | `1` | |
| `tubularSegments` / `radialSegments` | `number` | `64` / `8` | |
| `closed` | `boolean` | `false` | |
| `tension` | `number` | `0.5` | 0 = straighter |
| color/emissive/opacity/shadow/effectIds | | | as box |

### `smoothLines` — SmoothLineMeshDesc (Catmull-Rom lines + point markers)

`points: {lng,lat,height}[]` (`[]`), `tension` (`0.5`), `closed` (`false`), `segments` (`1` per pair), `lineWidth` (px, `1`), `dashed` (`false`), `dashSize` (`1000`), `gapSize` (`500`), `dashOffset` (`0`), `color` (**hex number** `0xffffff`), `showPoints` (`true`), `pointSize` (`2`), `pointColor` (**hex number**).

### `polygon` — PolygonMeshDesc
Single polygon; rebuilt in place on `update()`. Set **exactly one** of `positions` / `points` / `geojson` (setting one clears the others).

| Field | Type | Default | Notes |
|---|---|---|---|
| `positions` | `{lng,lat,height}[] \| [][]` | — | array of arrays = outer ring + holes |
| `points` | `XYZ[] \| XYZ[][]` | — | cartesian local space |
| `geojson` | GeoJSON `Polygon \| LineString` | — | first ring outer, rest holes |
| `clampToGround` | `boolean` | `true` | `false` → drawn at `height`, extrudable |
| `useGroundNormals` | `boolean` | `true` | terrain-normal shading (needs normals-writing terrain) |
| `height` / `extrudedHeight` / `perPositionHeight` | `number` | `0` | when not clamped |
| `color` | `Color` | `0x000000` | |
| `opacity` / `transparent` | `number` / `boolean` | `1` / `false` | |
| `castShadow` / `receiveShadow` | `boolean` | `false` | clamped polygons cast no shadow |
| `effectIds` | `string[]` | — | |
| + PolygonMaterial options | | | `wireframe`, emissive pair, `reflectivity`, `roughness`, `water*`, specular fields, `ior` |

NOT available (layer-only): `tiled`, `show`, `surfaceShow`, `outline*`, `lit` (use mesh `visible`/`lit`). `ref.toGeoJSON(): Polygon`.

### `polyline` — PolylineMeshDesc
Single polyline; rebuilt on `update()`; **lit** (renders black without a light — set `lit: false` for plain color).

`positions` / `points` / `geojson` (exactly one; `geojson` accepts `LineString|Polygon`), `ring` (`false` — closed outline: repeat first position at end), `clampToGround` (`true`), `useGroundNormals` (`false`), `height` (`0`), `width` (px, `1`), `maxWidth` (`1000`), `color` (`0xffffff`), `opacity`/`transparent`, `depthWrite` (`true`), `castShadow`/`receiveShadow`, emissive pair, `effectIds`. `ref.toGeoJSON(): LineString`.

### `gltfModel` — GLTFModelDesc

| Field | Type | Default | Notes |
|---|---|---|---|
| `url` | `string` | **R** | glTF/GLB; updating reloads |
| `castShadow` / `receiveShadow` | `boolean` | `false` | |
| `animationEnabled` | `boolean` | — | |
| `animationActiveClip` | `string` | — | |
| `animationSpeed` | `number` | `1.0` | |
| `animationLoop` | `boolean` | `true` | |
| `animationAutoPlay` | `boolean` | `false` | |
| `animationCrossfadeDuration` | `number` | `0.3` | s |
| `animationClips` | `string[]` | — | read-only |

`ref.*`: `playAnimation(name)`, `pauseAnimation()`, `resumeAnimation()`, `stopAnimation()`, `crossFadeAnimation(from,to,duration)`, `blendAnimations([{name,weight}])`, `setAnimationWeight(name,w)`, `setAnimationSpeed(s)`, `setAnimationLoop(b)`, `getAnimationDetails(name?)`, `getAnimationCurrentState()`. Events: `load`, `error`, `animationReady`.

### Instanced meshes — `boxes` / `cylinders` / `spheres` / `planes` / `gltfModels`

One draw call for many copies. Shared config (material/geometry) + per-instance `children[]`.

- `boxes` shared: color/emissive pair, opacity/transparent, castShadow/receiveShadow, effectIds. Child: `width/height/depth` (`1`, as scale multipliers), `color?`, `position` (`{0,0,0}` local), `rotation` (radians), `scale` (`{1,1,1}`), `matrix?` (overrides TRS).
- `cylinders` shared adds `radiusTop`/`radiusBottom` (`1`/`1`), `radialSegments` (`16`), `heightSegments` (`1`), `openEnded`, `thetaStart/Length`, `pickable`. Child: `radius` (`1`, XZ multiplier), `height` (`1`, Y multiplier), + same TRS/color child fields.
- `spheres` shared adds `widthSegments` (`32`), `heightSegments` (`16`), phi/theta ranges, `pickable`. Child: `radius` (`1`), + TRS/color.
- `planes` shared: segments (`1`/`1`), material fields, `pickable`. Child: `width`/`height` (`1`), + TRS/color.
- `gltfModels`: `url` (**R**, loaded once, many copies), `animationActiveClip?`, `animationSpeed` (`1`), `animationLoop` (`true`), `animationAutoPlay` (`false`), `castShadow`/`receiveShadow`, `pickable` (**non-skinned path only**; skinned fallback has empty `batchIds`). Child: `position`/`rotation`/`scale`/`matrix` only. `ref.on`: `load`, `error`, `needsUpdate`; `ref.animationClips`, `playAnimation`, `stopAnimation`.

Instance management via `handle.ref`: `add(config) → index`, `removeAt(index)` (swap-with-last, O(1)), `updateAt(index, partial)`, `clear()`, `replaceAll(configs)`, `count`.

### `rain` — RainMeshDesc (needs `animation: true` for motion)

`particleCount` (`5000`), `speed` (`0.0015`), `color` (**hex number** `0xffffff`), `areaWidth`/`areaHeight` (`500`/`1000`), `radius` (`10`), `width` (`2.0`), `height` (`60`), `opacity` (`0.5`), `alphaMax`/`alphaMin` (`0.5`/`0.05`), `followCamera` (`true`), `maxHeight` (`3000` — fades above), `baseFov` (`45`).

### `snow` — SnowMeshDesc (needs `animation: true`)

`particleCount` (`30000`), `radius` (`10`), `areaWidth`/`areaHeight` (`500`/`1000`), `speed` (`0.00005`), `movementStrength` (`{50,20,50}`), `movementSpeed` (`{0.0005,0.0002,0.0005}`), `size` (`3`), `color` (**hex number**), `opacity` (`1`), `followCamera` (`true`), `maxHeight` (`3000`).

### `sky` — SkyMeshDesc (atmosphere required)

`sun` (`true`), `moon` (`true`), `moonScale` (`1`), `moonIntensity` (`1`), `sunAngularRadius` (rad, `0.004675`), `envMap` (`false`). Sun/moon positions auto-follow `view.atmosphere.date`.

### `skyBox` — SkyBoxMeshDesc (lightweight gradient; no atmosphere needed)

`dayColor` (`0x92c1ff`), `nightColor` (`0x000033`), `sunColor` (`0xffddae`).

### `stars` — StarsDesc

`pointSize` (`1`), `intensity` (`10`), `background` (`true`), `assetsUrl` (star data URL). Rotation/visibility follow the atmosphere date.

### `glowGlobe` — GlowGlobeMeshDesc (Fresnel atmosphere halo)

`radiusScale` (`1.2`, ×WGS84 semi-major), `coefficient` (`0.5`, larger = more edge spread), `exponent` (`5.0`, higher = sharper), `glowColor` (`0x8cf3ff`), `opacity` (`0.5`).

### `splat` — SplatMeshDesc (3D Gaussian Splatting: `.spz`/`.ply`/`.sog`/`.rad`/`.splat`/`.ksplat`; no NGSP v4)

`url` (**R**, **creation-only**), `lod` (`false`, **creation-only**), `originCellSize` (`2000` m, **creation-only**). No lighting/shadows/picking/selective effects. Upside-down captures → `geodetic: { pitch: 180 }`. Events: `load`, `error` (fetch failure warns, no throw).

### `axesHelper` / `arrowHelper` — debug helpers

- `axesHelper`: `size` (`5`, **creation-only**).
- `arrowHelper`: `direction: XYZ` (**R**, normalized), `origin` (`{0,0,0}`), `length` (`1`), `color` (`#ffffff`), `headLength`, `headWidth` — all updatable.

## Effect descriptors

All share `id` (auto — the token used in mesh `effectIds`) and `visible` (`true`). Duplicable effects: `fogLight`, `rainDrop`.

| Key | Purpose | Key fields (default) |
|---|---|---|
| `aerialPerspective` | Atmospheric inscatter/transmittance | `inscatter` (`true`), `transmittance` (`true`), `irradiance` (`false` — deferred diffuse lighting; pair with `view.lit = false`), `sky` (`false`), `sun`/`moon` (`true`), `useNormalBuffer` (`true`), `albedoScale` (`2/π`), `shadow` (`false` — needs irradiance + view shadows + sun castShadow), `shadowIntensity` (`1`), `shadowSoftness` (`1.5` px), `shadowSamples` (`12`), `specular` (`false`), `specularIntensity` (`1`) |
| `clouds` | Volumetric clouds (atmosphere; needs photoreal scene) | `qualityPreset` (`"medium"` ∈ low/medium/high/ultra), `coverage` (`0.25`), `resolutionScale` (`1`), `lightShafts` (`null`), `shadows` (`true`, needs irradiance), `shadowCascadeCount` (`3`), `haze` (`true`), `hazeDensityScale` (`3e-5`), `scatteringCoefficient` (`1`), `absorptionCoefficient` (`0`), anisotropy `scatterAnisotropy1/2/Mix` (`0.7`/`-0.2`/`0.5`), `skyLightScale` (`1`), `groundBounceScale` (`1`), `powderScale`/`powderExponent` (`0.8`/`150`), `localWeatherVelocity` (`{0,0}`), haze exponent/scattering/absorption (`0.001`/`0.9`/`0.5`), `maxIterationCount` (`64`), `minStepSize`/`maxStepSize` (`100`/`1000`), `shadowFarScale` (`0.05`), `shadowMapSize` (`512×512`), weather/shape/turbulence repeat+offset vectors |
| `colorGradingLUT` | LUT color grading (`.3dl`) | `url` (LUT file), `blendMode` (`"colorBurn"`), `opacity` (`0.78`) |
| `depthOfField` | Bokeh DoF | `focusDistance` (`1000` m), `focalLength` (`1000` m), `bokehScale` (`7`) |
| `fogLight` | Volumetric fog lit by point lights (duplicable) | `lights[]` (`{ position: ECEF, color, intensity, radius?=500 }`), `maxLights` (`100`), `fogDensity` (`5`), `useSurfaceLighting` (`true`), `downsample` (`4` — main perf lever), `maxLightsPerTile` (`64`), `haloFalloff` (`0.1`), `extentScale` (`1.0`), `tileSize` (`32`), `maxFar` (camera far), `debugShowGrid` (`false`) |
| `fxaa` | Fast AA | none beyond `visible` |
| `lensFlare` | Sun/moon flare | `intensity` (`0.005`) |
| `rainDrop` | Screen-space rain droplets (needs `animation: true`; duplicable) | `opacity` (`1`), `dropGridSize` (`12` — lower = bigger drops), `dropDensity` (`1`), `dropLayers` (`4`), `dropSizeFactor` (`0.015`), `noiseScale` (`200`), `refractionStrength` (`0.3`), `minDropStrength` (`0.01`), fade window `0.3–0.8`, `dropThresholdFactor` (`0.08`), density/jitter adjust fields |
| `selectiveBloom` | Bloom on meshes listing this id in `effectIds` | `strength` (`0.8`; thin lines need 2–4), `radius` (`0.85`), `threshold` (`0.0`), `smoothing` (`0.1`), `levels` (`8`), `resolutionScale` (`0.5`) |
| `selectiveOutline` | Sobel outlines on `effectIds` meshes | `color` (`0xffffff`), `thickness` (`1.0`), `edgeStrength` (`1.0`), `resolutionScale` (`1.0`) |
| `smaa` | High-quality AA | `quality` (`"medium"`), `edgeDetectionMode` (`"color"` ∈ color/depth/luma) |
| `ssao` | Ambient occlusion | `samples` (`null`), `radius` (`null`), `intensity` (`1`), `color` (`0x000000`), `halfRes` (`false`), `quality` (`"Low"` — **capitalized** values Low/Medium/High/Ultra) |
| `ssr` | Screen-space reflections (applies where material reflectance + roughness < 1, or `water: true`) | `resolutionScale` (`0.5`), `iterations` (`100`), `binarySearchIterations` (`4`), `pixelZSize` (`100`), `pixelStride` (`5`), `pixelStrideZCutoff` (`1000`), `maxRayDistance` (`5000`), `screenEdgeFadeStart` (`0.75`), eye fade (`0`/`1`), `jitter` (`1`), `blendMode` (`"normal"`, **creation-only**), `useConeTracing` (`true`) + cone fields, `resolveKernelSize` (`3`, odd only), `geometryBuffer` (`null` = engine MRT) |
| `toneMapping` | HDR → LDR | `mode` (`ToneMappingMode.AGX`; also `ACES_FILMIC`, `NEUTRAL`, `LINEAR`, `REINHARD`, `REINHARD2`, `UNREAL`, …). Exposure via `view.toneMappingExposure` |
| `skyEnvMap` | Sky environment map (core package, not default-plugin) | `resolution` (`256`, creation-only); requires photoreal scene; drives reflections/env lighting |

**Creation-only fields across effects/meshes**: splat `url/lod/originCellSize`, ssr `blendMode`, `skyEnvMap.resolution`, axesHelper `size`, box/cylinder `draped`, sun `distance`.

## Light descriptors

Lights affect only surfaces **with normals** (terrain with `requestVertexNormals`, hillshade, `useNormal: true`, models).

| Key | Purpose | Fields (default) |
|---|---|---|
| `ambient` | Uniform ambient (no atmosphere needed) | `color` (`0xffffff`), `intensity` (`1` — too high = flat) |
| `lightProbe` | Static SH IBL (3rd order) | `intensity` (`1`; night ≈ `0.05`), `sh?` (THREE `SphericalHarmonics3`), `coefficients?` (`[R,G,B][]` — wins over `sh`) |
| `skyLightProbe` | Dynamic sky IBL (**atmosphere required**; auto-updates every frame) | `intensity` (`1`; night scenes ≈ `5.0`) — the only updatable field |
| `sun` | Directional sun + CSM shadows (**needs view `shadow: true`**; atmosphere recommended) | `distance` (`300`, **creation-only**), `color` (`0xffffff`, used when `applyColor`), `applyColor` (`false` = atmosphere-computed color), `intensity` (`1`), `castShadow` (`true`), `shadowCascadeCount` (`4`), `shadowMapSize` (`2048` per cascade), `shadowFar` (`50000` m — **tighten for small scenes**, e.g. 1000), `shadowMode` (`"practical"` ∈ uniform/logarithmic/practical), `shadowLambda` (`0.8`), `shadowMargin` (`5000`), `shadowFade` (`true`), `shadowIntensity` (`1`), `shadowBias` (`0.0001`), `shadowNormalBias` (`0`), `shadowRadius` (`1`, fixed 9-tap filter), `debugCSMHelper` (`false`) |

Direction auto-computed from `view.atmosphere.date` for `sun`, `skyLightProbe`, `sky`, `stars`.
