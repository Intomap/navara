import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "terrain",
  order: 5,
  title: { en: "TileJSON", ja: "TileJSON" },
  description: {
    en: "Render elevation tiles as 3D terrain from TileJSON.",
    ja: "TileJSONから標高タイルを 3D 地形として表示する。",
  },
  docs: "three/layer/terrain-layer",
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

  view.atmosphere.date = new Date("2026-07-16T00:30:00Z");
  view.addLight({ ambient: { intensity: 0.5 } });
  view.addLight({ sun: { intensity: 2.5, applyColor: true } });

  view.setCamera({
    lng: 102.4,
    lat: 18.93,
    height: 400,
    distance: 13000,
    heading: 15,
    pitch: -26,
    roll: 0,
  });

  const dem = await tilejson.addSource({
    type: "raster-dem",
    url: "https://terrain.reearth.land/terrarium/ellipsoid/tilejson.json",
  });

  view.addLayer({
    type: "terrain",
    source: dem,
  });

  view.addLayer({
    type: "raster",
    source: dem,
    hillshade: { exaggeration: 1.0 },
  });

  return { view };
}
