# City Performance

Goal: bring the Hong Kong real-time city example up to a solid frame rate (60 fps where the display
allows) **without changing the picture** — the same bar Tokyo set in its `performance.md`. The reference
is the Tokyo demo (`/Users/adamchiang/tokyo`), whose whole-city day frame is 13.9 ms / 32.9 ms night
(6.4 ms / 6.5 ms script time after its steps 1–6) on an RTX 5090.

## What limits the frame

Unlike Tokyo — where three.js was CPU-bound walking and drawing thousands of small objects several times
per frame — the Hong Kong city is **geometry-bound**: its buildings are dense white-model triangle meshes
(the Tokyo compiler notes a single 143 × 209 m block arrives as 42,000 triangles, half of them under
0.04 m²), so the visible set is ~33 million triangles. Those triangles are drawn several times per frame:

- the MRT G-buffer main pass,
- the CSM shadow map (4 cascades at 4096 px; `buildings`/`prefab`/`photo` all `castShadow`),
- the planar water mirror (a second render of the whole city at 0.5 resolution, every 2 frames),
- the night lamp-light map (top-down light map for headlight/lamp footprints).

At night the triangle count is unchanged but the frame is longer, so the pixel side adds cost on top:
lamp-light map, lit-window emissive, and night glass.

The `Performance` panel now reports, per frame, the draw calls and triangles of the two city re-render
passes separately (`mirror …k tris`, `lamp …k tris`) alongside the totals, so each optimization's effect
on those passes can be read directly.

## Baseline (before the work)

Measured on macOS with the Hong Kong example at its default settings (radius 1150 m, quality High, 4K
shadow, clouds High, mirror 0.5/2):

| Scene | Frame | Draw calls | Triangles |
|---|---|---|---|
| Hong Kong, day | 150.2 ms (6.7 fps) | 967 | 33.4 M |
| Hong Kong, night | 200.0 ms (5.0 fps) | 790 | 32.6 M |

Draw calls are low (789–967), so the limit is triangles × passes, not object count.

## Checklist

- [x] 1. Rust mesh decimation + distance LOD: `MeshBuffers::weld` deduplicates identical vertices into an
      indexed mesh (lossless), and `MeshBuffers::thin` drops triangles below `LOD1_MIN_AREA` (0.5 m²) for a
      `buildings_lod1`/`prefab_lod1` copy. The runtime swaps in LOD1 beyond `LOD_DISTANCE` (700 m).
- [x] 2. Shadow layering: tiles beyond `LOD_DISTANCE` stop `castShadow` on buildings/prefab/photo.
- [x] 3. Per-pass instrumentation: the panel reports mirror and lamp-light pass draw calls and triangles
      separately, plus the baseline record in this file.
- [ ] 4. Shared photo/facade materials (Tokyo step 7): **deferred** — the facade shader already shares one
      program via `customProgramCacheKey`, and ~132 per-tile material instances cost ≈0.6 ms against a
      150 ms frame; the bottleneck is triangles (33 M), not materials. The full texture-array merge also
      needs the runtime to assign atlas layers, which conflicts with baking them in Rust. Revisit only
      after the geometry/pass work is measured.
- [x] 5. Dynamic-structure triangulation to Rust: `navara_city::structures` ports `RailSoup`/`prism`/`sweep`
      + earcut (footbridges/platforms/canopies/flyovers) and exposes `constructStructures`/`constructFlyovers`
      WASM entry points. `CityMeshDesc.loadDynamics` consumes the worker tasks
      `constructStructuresMesh`/`constructFlyoversMesh` with a main-thread fallback. This removes the
      per-tile load hitch (not the steady-state frame time).
- [x] 6. Scene-traversal cuts: verified already in place — mirror-tile bounding spheres are cached at tile
      load, the prop pool syncs matrices only when dirty, and the lamp-light extent is clamped.

## Results

| Step | Day | Night | Picture |
|---|---|---|---|
| baseline | 150.2 ms | 200.0 ms | |
| weld + LOD1 + shadow layering | *pending measurement* | *pending measurement* | needs fixed-camera pixel diff |

> The Rust + WASM changes compile and the unit tests pass (`cargo test -p navara_city` 26 passed,
> `navara_three_city` 29 passed, `navara_worker` type-check clean; `constructStructures`/`constructFlyovers`
> are exposed by the regenerated worker bindings). The full `cargo make build-example`
> is blocked by a pre-existing toolchain issue: `web/navara_three`'s `.d.ts` bundling (unplugin-dts /
> API Extractor) rejects TypeScript 6.0.3 (bundled engine is 5.9.3), which is unrelated to these changes.
> Measure the day/night numbers on the machine once that build is unblocked.
