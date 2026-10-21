import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "getting-started",
  order: 1,
  title: { en: "Hello World", ja: "Hello World" },
  description: {
    en: "The shortest code to put a map on screen. Copy-paste and go.",
    ja: "HTML に地図を表示する最短コード。コピペで動く。",
  },
  docs: "three/tutorial/basic-visualization",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({ useNormal: true });

  // Plugin settings
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  // Initialize
  await view.init();

  // Set up the default scene
  defaultPlugin.addDefaultPhotorealScene();
  view.atmosphere.date = new Date("2026-07-16T01:00:00Z");
  view.toneMappingExposure = 10;

  // Camera — close enough that the globe nearly fills the frame.
  view.setCamera({
    lng: 140,
    lat: 25,
    height: 8_000_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  // Layer
  const imagery = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/bluemarble/tilejson.json",
  });
  view.addLayer({ type: "raster", source: imagery });

  return { view };
}
