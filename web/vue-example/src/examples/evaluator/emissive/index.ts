import ThreeView, { Color } from "@navaramap/three";
import type { SelectiveBloomEffectDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "styling",
  order: 4,
  title: { en: "Emissive by Attribute", ja: "属性で発光" },
  description: {
    en: "Drive per-feature emissive from an attribute and make it glow with selective bloom.",
    ja: "属性値から地物ごとの emissive を決め、selective bloom で発光させる。",
  },
  docs: "three/api/feature-evaluator",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#0b0d12"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.globe.color = new Color().setStyle("#15181c");

  view.addLight({ ambient: { intensity: 0.5 } });

  view.setCamera({
    lng: -74.0145,
    lat: 40.6975,
    height: 300,
    heading: 22,
    pitch: -8,
    roll: 0,
  });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const bloom = view.addEffect<SelectiveBloomEffectDesc>({
    selectiveBloom: { strength: 0.6, radius: 0.4, threshold: 0 },
  });

  const buildings = await tilejson.addSource({
    type: "vector-tile",
    url: "https://papers.reearth.land/overture_buildings/tilejson.json",
  });

  const layer = view.addLayer({
    type: "vector",
    source: buildings,
    sourceLayers: ["building"],
    polygon: {
      color: new Color().setStyle("#2b262b"),
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
      effectIds: [bloom.id],
    },
  });

  const GLOW_COLOR = new Color().setStyle("#ff6b2c");
  const MAX_HEIGHT = 200;
  const GLOW = 2;

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const height = properties?.["height"] as number | undefined;
        const numFloors = properties?.["num_floors"] as number | undefined;
        const extrudedHeight =
          height ?? (numFloors != null ? numFloors * 3.2 : 8);
        const t = Math.min(extrudedHeight / MAX_HEIGHT, 1);
        return {
          extrudedHeight,
          emissive: GLOW_COLOR,
          emissiveIntensity: GLOW * t,
        };
      },
      { filters: ["height", "num_floors"] },
    );
  });

  return { view };
}
