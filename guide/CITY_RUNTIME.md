# City Runtime

`@navaramap/three-city` provides the prebuilt-city runtime used by the Hong Kong Vue example. It owns streaming, tile visuals, shared materials, traffic, railways, birds and water reflection; it does not replace the global `ThreeView`, plugin, atmosphere or tile pipeline.

## Hong Kong CRS and RTC

- EPSG:2326 uses the International 1924 ellipsoid (`a=6378388`, `1/f=297`), not WGS84/GRS80. The city grid is `x=easting-835625`, `z=816500-northing`.
- Rust `navara_city::projection` and TypeScript `runtime/projection.ts` must implement the same HK1980 ↔ WGS84 seven-parameter Helmert transform. Do not treat HK1980 longitude/latitude as WGS84 or add a manual city offset.
- Static worker meshes and dynamic RTC objects both use transformed WGS84 ECEF. `aLocal` remains in the original city frame for facade, ground and orthophoto textures.
- `geographicToLocal` and `ecefToLocalPoint` are the inverse WGS84 path; preserve height during ECEF reverse transforms. Projection tests use external PROJ reference points and require less than 5 cm horizontal approximation error and less than 1 mm round-trip error.
- The source tile binaries are input data. Projection runs when `constructCityTile` builds meshes in `navara_wasm_worker`; after changing Rust projection, rebuild that worker and reload tiles rather than editing the binaries.
- Manifest `y` is HKPD height. It is preserved through the datum transform as the best available height input, but no geoid/HKPD undulation model is currently bundled; do not claim survey-grade WGS84 ellipsoid heights.

## City descriptor and updates

- Instantiate the city after `await view.init()` with `view.addMesh<CityMeshDesc>({ city: options })`.
- Partial updates use `city.update({ city: { ...options } })`. The descriptor stores the merged options; callers must still provide a complete new `water` object when changing a water value.
- `CityOptions.water` accepts optional `amplitude`, `speed`, `distortion`, `reflection` and `roughness` values. Omitted values retain the shared defaults.
- `CityOptions.nightLights` controls street/park lamps, vehicle headlights, room intensity/softness, the share and pace of changing rooms, drawn tower-glass city lights and blue night lighting. `nightCityGlass` is independent of the physical daytime `uCityGlass` reflection.
- Window changes use their own clock: `uTime * windowSparePace`, capped to a float-safe range. They must not alter tree sway, water or other users of shared `uTime`.
- `quality: "low"` reduces tree detail distance and halves vehicle and bird counts. Dynamic counts still derive from the caller's configured `cars` and `birds` values.
- `CityMeshDesc.update()` renders dynamics (including the lamp light map) itself; effects such as `CityBloomEffectDesc` must not drive dynamic updates. Bloom can therefore be disabled without freezing vehicle headlights or lamp pools.
- `CityMeshDesc` owns one `CityLampLight` per city: it is created with the shared materials, passed into `PropLibrary` for prop lamp pools and vehicle/train headlight footprints, and updated through `CityDynamics`. Do not create a second lamp-light instance in the dynamic loaders.
- Distant tree crowns use standard scene lighting plus a warm `cityNightFill` night floor (like near leaves), matching the Tokyo reference; the seasonal `foliage()` recolor still applies in autumn/spring. Do not reintroduce the old baked day/night ambient override or the blue-green `uTreeGlow` emissive — the dark olive vertex-colour gradient alone is the intended crown albedo.
- The harbour sea (`runtime/backdrop.ts`) is created only when the manifest carries `sea` (boolean `true` or the legacy string `"True"`). It is one static RTC disc at HKPD `-0.5 m` with the shared ground/water material (`fixedLayer = 4`), so waves, fresnel and mirror all apply; land terrain occludes it. Its mirror reference sphere follows the camera focus in `update()` and is registered in `mirrorTiles` under `"__sea__"`. The orthophoto never paints onto water fixed layers (`uFixedLayer < 3.5` guard in ground.ts).
- Birds default to 150 (Tokyo's reference count). `setCount` must always set both `geometry.instanceCount` and `group.visible`; the 0→N toggle is covered by `dynamicsContracts` tests and should be verified with an instanced-draw probe plus a pixel diff when changing the flight shader.
- City meshes join the existing MRT G-buffer (and therefore screen-space reflections) when the view allocates G-buffer targets; otherwise they render as plain opaque. No city-specific reflection pipeline exists — reuse the engine one.
- `CustomRenderPass` updates shadow maps by calling `renderer.shadowMap.render` directly with the shadow-casting directional, point and spot lights. It must not render the whole scene into a 1×1 colour target just to trigger that update; that duplicates every city draw and triangle.
- `CityWaterMirrorEffectDesc` must render the scene that actually contains the city — `ctx.scenes.mrt` when it is non-empty, otherwise `ctx.scenes.opaque`. Rendering only the opaque scene loses every building reflection once the G-buffer routes the city to MRT. The mirror target clears to transparent black (alpha 0), so the water shader's `thing` mask separates reflected geometry from empty sky; an opaque sky background would fake a reflection everywhere.
- `city.ref.renderStats()` exposes the renderer's cumulative draw-call/triangle counts and current geometry/texture counts. Debug overlays must difference cumulative values between samples and divide by the sampled frame count; the Hong Kong panel reports per-frame averages.
- `CityStats.bytes` counts current in-flight and loaded binary/typed-array bytes, not the complete JS heap or GPU allocation.

## Shared materials and texture color space

- Wall and ground detail textures are linear, mean-normalized `DataArrayTexture` layers. Do not mark them as sRGB or add another sRGB decode in a shader.
- Keep mipmaps and anisotropic filtering. Building facade materials share the same uniforms as the ground, shell, props and dynamics.
- Hong Kong shell buildings use `materials/shell.ts`, not the procedural facade path. Investigate shell texture differences through local coordinates, vertex normals and lighting before changing the texture pipeline.
- The facade uses a cheap view-dependent sky term for daytime glass, with per-room variation, grazing-angle response and a sun glint driven by `view.atmosphere.sunDirection`. Avoid uniform glass emissive fills or a live six-face environment render for the whole city.
- Near leaves keep their texture and species tint in summer. Distant crowns use the dark olive vertex-color gradient from the Tokyo reference; do not replace those colors with a second bright species tint. Near and far tree shaders must remain instanced.
- Props and trees use city-wide pools (`runtime/prop-pool.ts`) keyed by geometry, material, shadow mode, lamp-map ownership and a 4096 m spatial bucket derived from the rounded RTC translation. Tile builds only retain shares; unloading and LOD changes activate/remove shares and the next `CityMeshDesc.update()` rewrites dirty buckets. Capacity grows to 1.5 times the live share count and shrinks once entries fall below half of it. Each bucket owns a real instanced bounding sphere and object-level frustum culling; per-instance attributes (`aTreeSeed`, `aLens`) use a bucket-local deep-cloned geometry so disposing one bucket never releases buffers shared with another. Pool matrices are stored as flat `Float32Array`s and premultiplied by tile RTC translation, while `aTreeSeed` preserves the original tile-local season hash.
- Prop lamp pools (`PROP.LIGHT` street/park and `PROP.POLE` cool tint) are separate global instanced planes in the `CityLampLight` map. `PropLibrary.dispose()` owns both pool roots; tile visuals only release their shares.
- Tree materials (near leaves, branches, distant crowns) and vehicles share the `cityNightFill` night term: a warm `uNight`-scaled floor plus a `uLampMap` sample so street-lamp pools land on foliage and car bodies. Without it, night ambient is blue and objects render black — do not remove it when refactoring these shaders. The emissive lamp lens sits above the metal lamp housing so elevated views see it lit; the vehicle taillight emissive is stronger than the headlight term so red survives tone mapping.
- Birds cruise at 22–252 m altitude within ±280 m of their roost (matching the Tokyo reference; the earlier 10–70 m cruise was hidden behind tall Hong Kong blocks, leaving only ground shadows), and perched birds keep 30% scale so flocks stay visible in typical views. When touching the bird shader, verify visibility with a birds 0/200 pixel diff at a 50–100 m camera, not just unit tests.
- Custom `ShaderMaterial`s (birds, signal lenses) bypass ShaderLib, so `overrideMaterialsForMRT` does not inject their G-buffer outputs: without `setupMaterialForMRT` the deferred draw is rejected (`Active draw buffers with missing fragment shader outputs`) and the geometry renders nothing while its shadows still appear. Their fragment shaders must expose a view-space `normal` variable (flat derivative-based normal works for untextured sprites), and the opt-in call lives in `CityMeshDesc` — runtime modules must not import `@navaramap/three` directly or the package's unit tests break on the worker entry.
- `createCityUniforms()` owns its blank fallback texture. `CityMaterials.dispose()` disposes that fallback, the orthophoto and the shared materials; the descriptor separately owns textures, tiles and dynamics.

## Water and planar mirror

- `materials/ground.ts` computes one local wave normal. PBR normal mapping, Fresnel, sky reflection and planar UV distortion must all use that same normal and the same ENU basis signs.
- Water combines reflection once in `opaque_fragment`: a Fresnel sky fallback and planar city reflection when available. Do not also blend the same mirror in `color_fragment`.
- Planar sampling uses three vertically offset samples for stretched, moving reflections. Distant water retains low-frequency waves while high-frequency detail fades by screen footprint.
- Water depth bias must cover both `gl_Position.z` and logarithmic-depth `vFragDepth`; changing only `gl_Position.z` does not prevent coplanar flicker when log depth is enabled.
- `CityWaterMirrorEffectDesc` renders the existing opaque scene to a half-resolution floating-point target by default. It is an additional scene render, not a free screen-space effect.
- The mirror keeps non-water city tiles visible so buildings can appear in reflections. Its projection is cropped around visible water, then tile groups plus the leaves of the global prop, dynamics, structures and flyover roots are tested against the cropped/oblique mirror frustum and restored in `finally`; the sea disc has no tile bound and remains visible.
- `resolutionScale` is clamped to 0.25–1. `frameInterval` is clamped to 1–4; values above one reuse the previous valid reflection between renders. The shared default is one, while the Hong Kong example uses two for High and three for Performance.
- Oblique clipping uses the standard Lengyel form: `projection[14] = clip.w`. Keep a small below-water clip allowance and compute `uMirrorMatrix` after crop and oblique projection.
- If no water intersects the main frustum, `uMirrorOn` is zero and no mirror render occurs. Do not disable reflection solely through a fixed camera-distance threshold; use resolution and frame interval for performance. All scene background, light membership, render-target, clear and shadow state must be restored with `try/finally`.

## Streaming and lifetime

- `CityStreamer.update()` keeps nearer tiles first and accepts runtime radius and concurrency changes.
- Queued, loading and loaded tiles beyond radius plus hysteresis are removed. Loading fetches are aborted.
- Fetch completion is checked before worker submission. Worker completion must match both the original state object and the streamer generation, preventing stale results from entering a tile that was unloaded and requested again.
- Disposal increments the generation, aborts fetches and drops late worker results. Tile visuals, sign atlases, textures, shared materials and dynamics remain separate ownership domains.
- The city streamer does not automatically participate in the global map `MemoryLedger`; do not describe `CityStats.bytes` as a global GPU memory budget.
- Hong Kong caps the tile-worker pool at four desktop workers and sets `memoryBudget.maxWorkerHeapBytes` to 128 MB. WASM heaps ratchet upward and only release when a worker is recycled, so raising either value trades memory for decode throughput.

## Verification

After changing city shaders, streaming, reflection or disposal:

1. Run the `navara_three_city` type-check, tests and build.
2. Run the consuming example's type-check, tests and build.
3. Compare fixed-camera day, dusk and night captures with stable city settings.
4. Toggle planar reflection and compare water movement and reflected buildings from more than one viewpoint.
5. Exercise Quality, radius and concurrency changes, then re-enter the example to check duplicate pane, worker, tile and GPU-resource cleanup.
6. Measure steady-state performance after tile loading settles. Compare equivalent camera, time and quality settings; do not use shader-compilation frames as the baseline.
