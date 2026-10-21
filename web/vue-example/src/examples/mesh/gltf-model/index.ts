import ThreeView, { Color } from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "3d",
  order: 2,
  title: { en: "glTF Model", ja: "glTF Model" },
  description: {
    en: "Pin a glTF model to a map coordinate with addMesh.",
    ja: "glTF モデルを addMesh で地図上の座標にピン留めする。",
  },
  docs: "three_default_descs/mesh-desc/gltf-model-desc",
};

const CAR = { lng: 138.036142, lat: 36.085621, height: 1 };
const ROAD_BEARING = 321;

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#0f1118"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
  view.addLight({ ambient: { intensity: 1.2 } });
  view.addLight({ sun: { intensity: 2 } });

  view.setCamera({
    lng: CAR.lng,
    lat: CAR.lat,
    height: 2,
    distance: 26,
    heading: ROAD_BEARING + 90,
    pitch: -8,
    roll: 0,
  });
  view.camera.fov = 25;

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/black/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const car = view.addMesh<GLTFModelDesc>({
    gltfModel: { url: `${ctx.assetsUrl}glTF/car/scene.gltf` },
    // `heading` is the bearing the model's front faces; the West-Up-North frame
    // `geodetic` builds matches glTF's own Y-up axes, so no up-axis correction.
    geodetic: { ...CAR, heading: ROAD_BEARING },
  });

  view.attribution?.add([
    {
      attribution: "Classic Muscle car by Lexyc16 (CC BY 4.0)",
      attributionUrl:
        "https://sketchfab.com/3d-models/classic-muscle-car-641efc889e5f4543bae51d0922e6f4b3",
    },
  ]);

  return { view };
}
