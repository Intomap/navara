import ThreeView, { Color } from "@navaramap/three";
import type { ArclineMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { flightArcs } from "./data";

export const meta: ExampleMeta = {
  section: "3d",
  order: 5,
  title: { en: "Arc Lines", ja: "アークライン" },
  description: {
    en: "Draw lines between coordinate pairs with ArclineMesh.",
    ja: "ArclineMesh で 2 地点を結ぶ線を描く。",
  },
  docs: "three_default_descs/mesh-desc/arcline-mesh-desc",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  // Render every frame for the dash animation.
  view.animation = true;

  view.setCamera({
    lng: 146,
    lat: 33,
    height: 7_600_000,
    heading: 0,
    pitch: -73,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/blackmarble/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  // `gradation` (0→1) sweeps a bright band from srcColor to tgtColor.
  const arcs = view.addMesh<ArclineMeshDesc>({
    arcLines: {
      geometry: flightArcs,
      srcColor: new Color().setStyle("#cfcfcf"),
      tgtColor: new Color().setStyle("#0091ff"),
      thickness: 1.2,
      segments: 96,
      arcHeightScale: 0.35,
      gradation: 0.3,
      dashed: false,
      dashSize: 1500_000,
      gapSize: 500_000,
    },
  });

  let dashed = false;
  const dashButton = ctx.ui.addButton("Dashed: off", () => {
    dashed = !dashed;
    arcs.update({ arcLines: { dashed } });
    dashButton.setLabel(dashed ? "Dashed: on" : "Dashed: off");
  });

  let gradation = 0;
  view.on("preUpdate", () => {
    gradation = gradation - 5000;
    arcs.update({ arcLines: { dashOffset: gradation } });
  });

  return { view };
}
