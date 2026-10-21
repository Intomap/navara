import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "2d",
  order: 4,
  title: { en: "Billboard", ja: "Billboard" },
  description: {
    en: "Stand an icon image (billboard) at a GeoJSON point.",
    ja: "GeoJSON のポイントにアイコン画像（ビルボード）を立てる。",
  },
  docs: "three/material/billboard-material",
};

const EVEREST = { lng: 86.925, lat: 27.9881 };

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: EVEREST.lng,
    lat: EVEREST.lat,
    distance: 7000,
    heading: 0,
    pitch: -55,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const source = view.addSource({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [EVEREST.lng, EVEREST.lat] },
    },
  });
  view.addLayer({
    type: "vector",
    source,
    billboard: {
      url: `${ctx.assetsUrl}example.png`,
      color: new Color().setStyle("#ffffff"),
      size: 160,
      sizeInMeters: false,
      center: { x: 0, y: -0.5 },
      transparent: true,
      clampToGround: true,
    },
  });

  return { view };
}
