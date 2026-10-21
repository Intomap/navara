import ThreeView, { Color } from "@navaramap/three";
import type { LightProbeDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

const CYBER_SH_COEFFICIENTS = [
  [0.4, 0.4, 0.65],
  [-0.15, -0.12, -0.38],
  [-0.33, 0.24, 0.0],
  [0.04, 0.03, 0.11],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export const meta: ExampleMeta = {
  section: "lighting-effect",
  order: 4,
  title: { en: "Image Based Lighting", ja: "イメージベースドライティング" },
  description: {
    en: "Light white buildings with spherical harmonics for a neon basemap.",
    ja: "球面調和関数で白い建物をネオンベースマップ向けにライティング",
  },
  docs: "three_default_descs/light-desc/light-probe-desc",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#04030a"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.globe.color = new Color().setStyle("#05060d");

  view.setCamera({
    lng: -74.0145,
    lat: 40.6975,
    height: 300,
    heading: 22,
    pitch: -8,
    roll: 0,
  });

  view.addLight<LightProbeDesc>({
    lightProbe: { intensity: 1.5, coefficients: CYBER_SH_COEFFICIENTS },
  });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/paint-voltage/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const buildings = await tilejson.addSource({
    type: "vector-tile",
    url: "https://papers.reearth.land/overture_buildings/tilejson.json",
  });
  const layer = view.addLayer({
    type: "vector",
    source: buildings,
    sourceLayers: ["building"],
    polygon: {
      color: new Color().setStyle("#ffffff"),
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
  });

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const height = properties?.["height"] as number | undefined;
        const numFloors = properties?.["num_floors"] as number | undefined;
        return {
          extrudedHeight: height ?? (numFloors != null ? numFloors * 3.2 : 8),
        };
      },
      { filters: ["height", "num_floors"] },
    );
  });

  return { view };
}
