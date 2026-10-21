import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { GOOGLE_MAPS_API_KEY } from "../../../lib/helpers/keys";
import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "basemap",
  order: 6,
  title: {
    en: "Google Photorealistic 3D Tiles",
    ja: "Google フォトリアル 3D Tiles",
  },
  description: {
    en: "Render Google Photorealistic 3D Tiles.",
    ja: "Google フォトリアル 3D Tiles を表示する。",
  },
  docs: "three/source/3d-tiles-source",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();
  view.toneMappingExposure = 5;
  view.atmosphere.date = new Date("2026-07-01T16:30:00Z");

  view.setCamera({
    lng: -1.5115,
    lat: 48.636,
    distance: 500,
    heading: 320,
    pitch: -13,
    roll: 0,
  });

  const tilesSource = view.addSource({
    type: "3d-tiles",
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY,
    )}`,
  });
  const tiles = view.addLayer({
    type: "3d-tiles",
    source: tilesSource,
    model: { maxSse: 20 },
  });

  view.attribution?.add([
    {
      attribution: "Google Maps Photorealistic 3D Tiles",
      attributionUrl: "https://www.google.com/permissions/geoguidelines/",
      logo: `${ctx.assetsUrl}credits/GoogleMaps.png`,
      creditLayerId: tiles.id,
    },
  ]);

  return { view };
}
