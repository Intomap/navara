import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "basemap",
  order: 3,
  title: { en: "Raster Overlay", ja: "ラスタオーバーレイ" },
  description: {
    en: "Display multiple basemaps stacked on top of each other.",
    ja: "複数のベースマップを重ねて表示する。",
  },
  docs: "three/material/raster-material",
};

export async function run(
  ctx: ExampleContext,
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
    url: "https://papers.reearth.land/bluemarble/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const clouds = view.addSource({
    type: "raster-tile",
    url: "https://assets.cms.reearth.io/assets/11/ea0a6a-a94f-47e0-a163-4c675261a1f6/blue-marble-clouds/{z}/{x}/{y}.webp",
    maxZoom: 6,
  });
  const overlay = view.addLayer({
    type: "raster",
    source: clouds,
  });

  let shown = true;
  const button = ctx.ui.addButton("Hide clouds", () => {
    shown = !shown;
    overlay.update({ raster: { show: shown } });
    button.setLabel(shown ? "Hide clouds" : "Show clouds");
  });

  view.attribution?.add([
    { attribution: "NASA Blue Marble Clouds(Converted as raster tiles)" },
  ]);

  return { view };
}
