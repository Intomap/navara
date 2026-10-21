import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "basemap",
  order: 4,
  title: { en: "TileJSON", ja: "TileJSON" },
  description: {
    en: "Display a basemap from TileJSON.",
    ja: "TileJSON からベースマップを表示する。",
  },
  docs: "three/source/raster-tile-source",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: -70,
    lat: 15,
    height: 8_000_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/watercolor/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  return { view };
}
