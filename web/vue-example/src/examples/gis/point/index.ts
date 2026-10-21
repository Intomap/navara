import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { peaks } from "./data";

export const meta: ExampleMeta = {
  section: "2d",
  order: 1,
  title: { en: "Point", ja: "Point" },
  description: {
    en: "Draw GeoJSON points as fixed-style symbols with color and size.",
    ja: "GeoJSON のポイントを色・サイズ固定の点シンボルで描画する。",
  },
  docs: "three/material/point-material",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: 170.16,
    lat: -43.57,
    distance: 17_000,
    heading: 0,
    pitch: -60,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const source = view.addSource({ type: "geojson", data: peaks });
  view.addLayer({
    type: "vector",
    source,
    point: {
      color: new Color().setStyle("#0091ff"),
      size: 48,
      sizeInMeters: false,
      clampToGround: true,
    },
  });

  return { view };
}
