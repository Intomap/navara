import ThreeView, { Color, ColorMap } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

// Ref: https://colorbrewer2.org/#type=sequential&scheme=Oranges&n=9
const ORANGES_COLOR_MAP = new ColorMap("sequential", "Oranges", [
  [255 / 255, 245 / 255, 235 / 255], // #fff5eb
  [254 / 255, 230 / 255, 206 / 255], // #fee6ce
  [253 / 255, 208 / 255, 162 / 255], // #fdd0a2
  [253 / 255, 174 / 255, 107 / 255], // #fdae6b
  [253 / 255, 141 / 255, 60 / 255], // #fd8d3c
  [241 / 255, 105 / 255, 19 / 255], // #f16913
  [217 / 255, 72 / 255, 1 / 255], // #d94801
  [166 / 255, 54 / 255, 3 / 255], // #a63603
  [127 / 255, 39 / 255, 4 / 255], // #7f2704
]);

export const meta: ExampleMeta = {
  section: "styling",
  order: 2,
  title: { en: "Color by Attribute", ja: "属性で色分け" },
  description: {
    en: "Color 3D Tiles buildings from a feature attribute with FeatureEvaluator.",
    ja: "FeatureEvaluator で 3D Tiles の建物を属性値に応じて色分けする。",
  },
  docs: "three/api/feature-evaluator",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#cccccc"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-08-03T01:00:00Z");

  view.setCamera({
    lng: 135.75452,
    lat: 34.98542,
    height: 155.92,
    heading: 31.33,
    pitch: -13.94,
    roll: 0,
  });

  view.addLight({ ambient: { intensity: 1 } });
  view.addLight({ sun: { intensity: 2, applyColor: true } });

  const terrain = view.addSource({
    type: "quantized-mesh",
    url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
    maxZoom: 18,
    minZoom: 2,
    requestVertexNormals: true,
  });
  view.addLayer({ type: "terrain", source: terrain });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const buildings = view.addSource({
    type: "3d-tiles",
    url: "https://assets.cms.plateau.reearth.io/assets/1a/742b55-cd5f-460e-991c-f3b03242f2db/26100_kyoto-shi_city_2025_citygml_1_op_bldg_3dtiles_26106_shimogyo-ku_lod2_no_texture/tileset.json",
  });
  const layer = view.addLayer({
    type: "3d-tiles",
    source: buildings,
    model: { color: new Color().setHex(0xffffff), metalness: 0, roughness: 1 },
  });

  const MAX_HEIGHT = 130.5;
  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const measuredHeight =
          (properties?.["bldg:measuredHeight"] as number) ?? 0;
        const t = measuredHeight / MAX_HEIGHT;
        const [r, g, b] = ORANGES_COLOR_MAP.linear(t);
        return { color: new Color().setRGB(r, g, b) };
      },
      { filters: ["bldg:measuredHeight"] },
    );
  });

  view.attribution?.add([
    {
      attribution:
        "3D City Model (Project PLATEAU) Kyoto City (FY2025) - MLIT PLATEAU",
      attributionUrl:
        "https://www.geospatial.jp/ckan/dataset/plateau-26100-kyoto-shi-2025",
    },
    {
      attribution: "Re:Earth Terrain",
      attributionUrl: "https://terrain.reearth.land/",
    },
    {
      attribution: "© Mapterhorn",
      attributionUrl: "https://mapterhorn.com/attribution",
    },
  ]);

  return { view };
}
