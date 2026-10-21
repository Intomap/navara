import ThreeView, { Color } from "@navaramap/three";
import type { GlowGlobeMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "3d",
  order: 7,
  title: { en: "Glow Globe", ja: "グローグローブ" },
  description: {
    en: "Wrap the planet in a fresnel atmosphere halo with GlowGlobeMesh.",
    ja: "GlowGlobeMesh で地球のリムに沿ったフレネルの大気グローを描く。",
  },
  docs: "three_default_descs/mesh-desc/glow-globe-mesh-desc",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: 15,
    lat: 30,
    height: 8_500_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/blackmarble/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  view.addMesh<GlowGlobeMeshDesc>({
    glowGlobe: {
      radiusScale: 1.08,
      coefficient: 0.35,
      exponent: 6,
      glowColor: new Color().setHex(0x4aa8ff),
      opacity: 0.9,
    },
  });

  return { view };
}
