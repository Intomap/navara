# API corpus map — task → files to open

Resolve names with `navara-lookup.sh prop <option>`; use this table to skip the search
step for a whole task. All paths are relative to the repository root.

## What each corpus covers

| Corpus                                   | Contents                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/src/content/docs/three/`            | `Source/` (6 sources + `about`), `Layer/` (4 layer kinds + `about`), `Material/` (10 + `about`), `API/` (ThreeView, camera, color, colormap, globe, events, feature evaluator, types), `Core/` (plugin, custom desc), `Tutorial/`, `Plugins/`, `Example/` |
| `docs/src/content/docs/three_default_descs/` | `mesh-desc/` (25), `effect-desc/` (14), `light-desc/` (4) — every built-in Descriptor and its options           |
| `docs/src/content/docs/three_plugins/`    | `tilejsonplugin`, `overlayplugin`, `personviewplugin`, `cesiumionplugin`                                     |
| `docs/src/content/docs/three/Plugins/`    | `attributionplugin`                                                                                          |
| `docs/src/content/docs/maplibre_style/`   | plugin usage + `supported.json` (per-property support status)                                                |
| `docs/src/content/docs/engine/`           | WASM API reference                                                                                           |
| `docs/src/content/docs/guides/`           | getting started, how Navara works                                                                            |
| `web/navara_three/src/`                   | `ThreeView`, sources/layers, materials, mesh/tile rendering, G-buffer, texture compositing                   |
| `web/navara_three_default_descs/src/{meshes,effects,lights}/` | Descriptor implementations + `XConfig`/`XUpdate` types                                     |
| `web/navara_three_default_plugin/src/index.ts` | the descriptor **keys** and `addDefaultPhotorealScene()`                                                |
| `web/navara_three_plugins/src/`           | TileJSON / Overlay / PersonView / CesiumIon plugins                                                          |
| `web/navara_maplibre_style/src/`          | MapLibre Style JSON → Navara translation, font overrides                                                     |
| `web/wasm/navara_engine/navara_wasm.d.ts` | generated WASM surface: the field list behind every source/layer/material config                             |
| `web/navara_three/example/pages/`         | runnable pages, one feature each (`examples/` = curated track, `debug/` = exploratory)                       |

## Task → docs + a page that already does it

| Task                                     | Docs                                                                              | Example page (`web/navara_three/example/pages/`) |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| raster basemap / imagery                 | `three/Source/raster-tile-source.md`, `three/Layer/raster-layer.md`, `three/Material/raster-material.md` | `examples/basemap/raster-tiles`, `basemap/raster-overlay` |
| tile URL via TileJSON document           | `three_plugins/tilejsonplugin.md`, `three/Source/about.md`                          | `examples/basemap/tilejson`, `plugins/tilejson`  |
| vector tile basemap (MVT)                | `three/Source/vector-tile-source.md`, `three/Layer/vector-layer.md`, `three/Material/{polygon,polyline,point,text,billboard}-material.md` | `examples/basemap/vector-map`, `styling/mvt-*` |
| MapLibre Style JSON as the whole basemap | `maplibre_style/maplibre-style-plugin.md`, `maplibre_style/supported-features.mdx`, `supported.json` | `plugins/maplibre-style`                |
| terrain (DEM or quantized-mesh)          | `three/Source/{raster-dem,quantized-mesh}-source.md`, `three/Layer/terrain-layer.md`, `three/Material/{terrain,hillshade,elevation-heatmap}-material.md` | `examples/terrain/{raster,hillshade,quantized-mesh,elevation-heatmap,exaggeration}` |
| GeoJSON overlay (polygon/line/point)     | `three/Source/geojson-source.md` + the material pages                              | `styling/geojson-*`, `examples/gis/extruded-polygon` |
| 3D Tiles                                 | `three/Source/3d-tiles-source.md`, `three/Layer/3d-tiles-layer.md`                  | `examples/tiles-3d`, `styling/cesium3dtiles`     |
| glTF / instanced glTF model              | `three_default_descs/mesh-desc/{gltf-model-desc,instanced-gltf-model-mesh-desc}.md`, `three/Material/model-material.md` | `gltf-animation`, `model-control`, `mesh-layers/instanced-mesh` |
| primitive meshes (box/sphere/plane/tube/arc/polygon) | `three_default_descs/mesh-desc/*-mesh-desc.md`                          | `mesh-layers/*`, `examples/mesh/*`, `debug/geodesic` |
| splat / 3D Gaussian splatting            | `three_default_descs/mesh-desc/splat-mesh-desc.md`                                  | `splat`                                           |
| photo-real sky, sun, atmosphere          | `three/API/atmosphere.md`, `three_default_plugin/about.md` (`addDefaultPhotorealScene`), `three_default_descs/effect-desc/aerial-perspective-effect-desc.md`, `mesh-desc/sky-mesh-desc.md` | `atmosphere`, `atmosphere-sun-direction`, `showcases/photoreal`, `examples/sky/*` |
| post effects (bloom, outline, SSAO, SSR, DoF, fog, rain, LUT) | `three_default_descs/effect-desc/*.md`                        | `examples/effect/*`, `selective-bloom-effect/*`, `selective-outline-effect/*`, `color-grading-lut`, `ssr-puddle` |
| lights and shadows                       | `three_default_descs/light-desc/*.md`, `guide/RENDERING_PIPELINE.md` (internals)     | `examples/light/*`, `shadows`, `debug/deferred-lighting` |
| camera, flyTo, follow/free-look          | `three/API/camera.md`, `three/API/threeview-functions.md`, `three/API/threeview-properties.md` | `camera`, `camera-studio`, `model-control` |
| picking, hover, feature events           | `three/API/threeview-events.md`, `three/API/threeview-properties.md` (`picking`)     | `debug/mesh-picking`, `debug/picking-layers`, `mesh-layers/custom-pickable` |
| data-driven styling                      | `three/API/feature-evaluator.md`                                                    | `examples/evaluator/*`                            |
| writing a plugin                         | `three/API/plugin.md`, `three/Core/plugin.md`                                        | `plugins/*`, `custom-effect`, `custom-shader`     |
| DOM overlay / marker                     | `three_plugins/overlayplugin.md`                                                     | `plugins/overlay-marker`                          |
| first-person / street view               | `three_plugins/personviewplugin.md`                                                  | `examples/plugin/person-view`                     |
| Cesium ion assets                        | `three_plugins/cesiumionplugin.md`                                                   | `styling/cesium3dtiles1.1`, `showcases/*`         |
| attribution UI                          | `three/Plugins/attributionplugin.md`                                                 | `plugins/attribution`                             |
| weather (rain/snow/clouds)               | `three_default_descs/mesh-desc/{rain,snow}-mesh-desc.md`, `effect-desc/clouds-effect-desc.md`, `effect-desc/fog-light-effect-desc.md` | `weather`, `cloud-fog`, `rainDropEffect` |
| water / reflection                       | `three_default_descs/effect-desc/ssr-effect-desc.md`, `three/Material/polygon-material.md` (`water`) | `water-reflection`, `ssr-puddle`, `terrain/ocean-floor` |
| PMTiles / custom protocols               | —                                                                                   | `pmtiles`, `pmtiles-overture`                     |

## Search patterns (no script)

```bash
D=docs/src/content/docs
# every option heading on a page, in order
grep -nE '^#{2,4} ' "$D/three_default_descs/Effect Desc/aerial-perspective-effect-desc.md"
# one option's body across all descriptor pages (--exclude-dir=ja keeps the mirror out)
grep -rnE --exclude-dir=ja '^### shadow$' -A 12 "$D"
# where a config field really lives (generated WASM surface)
grep -n 'extrudedHeight' web/wasm/navara_engine/navara_wasm.d.ts
# accepted `type:` strings for sources/layers
grep -rnE 'type: "[a-z0-9-]+"' web/navara_three/src/type
# registered descriptor keys
grep -nE 'register(Mesh|Effect|Light)\("' web/navara_three_default_plugin/src/index.ts
# a literal used by any runnable page
grep -rln 'raster-tile' web/navara_three/example/pages
```

`docs/**` uses `**Type:**` / `**Default:**` / `**Description:**` line prefixes, which is
what makes option bodies greppable. `ja/` mirrors the tree with translated headings —
its anchors differ, so never build a Japanese URL by lowercasing an English anchor.
