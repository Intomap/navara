import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "getting-started",
  order: 5,
  title: { en: "Camera", ja: "Camera" },
  description: {
    en: "Set the initial view with setCamera, then move the camera with an animated flyTo.",
    ja: "setCamera で初期位置を設定し、flyTo でアニメーション付きでカメラ移動する。",
  },
  docs: "three/api/camera",
};

const CAMERA_DISTANCE = 3700;
const AIRPORTS = [
  { label: "Haneda", lng: 139.7798, lat: 35.5494 },
  { label: "Paris CDG", lng: 2.5479, lat: 49.0097 },
  { label: "San Francisco", lng: -122.379, lat: 37.6213 },
  { label: "Dubai", lng: 55.3644, lat: 25.2532 },
];

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const [haneda] = AIRPORTS;
  view.setCamera({
    lng: haneda.lng,
    lat: haneda.lat,
    distance: CAMERA_DISTANCE,
    heading: 0,
    pitch: -60,
    roll: 0,
  });

  for (const { label, lng, lat } of AIRPORTS) {
    ctx.ui.addButton(label, async () => {
      const completed = await view.flyTo(
        { lng, lat, distance: CAMERA_DISTANCE, heading: 0, pitch: -60, roll: 0 },
        { duration: 2000, easing: "quinticInOut" },
      );
      // `false` means another button interrupted this flight mid-way.
      console.log(`flyTo ${label}: ${completed ? "completed" : "interrupted"}`);
    });
  }

  return { view };
}
