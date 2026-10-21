import ThreeView, { Color, type FeatureEvaluator } from "@navaramap/three";
import type { SSAOEffectDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "lighting-effect",
  order: 36,
  title: { en: "SSAO", ja: "SSAO" },
  description: {
    en: "Shape an white building with ambient occlusion alone.",
    ja: "白い建物をSSAOのみで陰影づけする。",
  },
  docs: "three_default_descs/effect-desc/ssao-effect-desc",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#dfe2e6"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  // Render only AO
  view.lit = false;
  view.globe.color = new Color().setStyle("#ffffff");

  view.setCamera({
    lng: -87.6235,
    lat: 41.8775,
    height: 350,
    heading: 315,
    pitch: -25,
    roll: 0,
  });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
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
      clampToGround: false,
    },
  });

  const extrudeByHeight = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
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
  };
  layer.on("featureCreated", extrudeByHeight);
  layer.on("featureUpdated", extrudeByHeight);

  const ssao = view.addEffect<SSAOEffectDesc>({
    ssao: { intensity: 4, quality: "High" },
  });
  view.addEffect({ smaa: {} });

  ctx.ui.addCheckbox("Ambient Occlusion", true, (checked) => {
    ssao.update({ visible: checked });
  });

  return { view };
}
