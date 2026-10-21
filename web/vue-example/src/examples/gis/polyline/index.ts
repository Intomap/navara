import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "2d",
  order: 2,
  title: { en: "Polyline", ja: "Polyline" },
  description: {
    en: "Draw GeoJSON lines with a fixed color and width.",
    ja: "GeoJSON のラインを色・太さ固定のポリラインで描画する。",
  },
  docs: "three/material/polyline-material",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: 12.334,
    lat: 45.438,
    distance: 3400,
    heading: 35,
    pitch: -35,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const source = view.addSource({
    type: "geojson",
    url: `${ctx.assetsUrl}venice_canals.geojson`,
  });
  view.addLayer({
    type: "vector",
    source,
    polyline: {
      color: new Color().setStyle("#0091ff"),
      width: 6,
      height: 1,
    },
  });

  view.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
  ]);

  return { view };
}
