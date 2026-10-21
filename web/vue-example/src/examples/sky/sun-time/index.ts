import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { GOOGLE_MAPS_API_KEY } from "../../../lib/helpers/keys";
import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "lighting-effect",
  order: 2,
  title: { en: "Sun & Time of Day", ja: "太陽と時刻" },
  description: {
    en: "Auto-play the sun movement and fly between cities keeping the same sun position.",
    ja: "太陽の動きを自動再生し、太陽の位置を保ったまま各都市へ移動する。",
  },
  docs: "three/api/atmosphere",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({ animation: true });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const scene = defaultPlugin.addDefaultPhotorealScene();
  scene.aerialPerspective.update({
    aerialPerspective: { sun: true, sky: true, irradiance: true },
  });
  scene.sky.delete();

  view.setCamera({
    lng: -73.9709,
    lat: 40.7589,
    heading: -115.1,
    pitch: -34.9,
    distance: 3000,
    roll: 0,
  });
  view.camera.fov = 75;

  const tilesSource = view.addSource({
    type: "3d-tiles",
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY,
    )}`,
  });
  const tiles = view.addLayer({
    type: "3d-tiles",
    source: tilesSource,
    model: { maxSse: 20, normals: true },
  });

  const TIMES = [
    { label: "Dawn", date: "2025-01-01T12:32:00Z", exposure: 60 },
    { label: "Midday", date: "2025-01-01T17:00:00Z", exposure: 20 },
    { label: "Dusk", date: "2025-01-01T21:45:00Z", exposure: 40 },
  ];

  let index = 0;
  const applyTime = () => {
    view.atmosphere.date = new Date(TIMES[index].date);
    view.toneMappingExposure = TIMES[index].exposure;
  };
  applyTime();

  const timeButton = ctx.ui.addButton(`Time: ${TIMES[index].label}`, () => {
    index = (index + 1) % TIMES.length;
    applyTime();
    timeButton.setLabel(`Time: ${TIMES[index].label}`);
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
