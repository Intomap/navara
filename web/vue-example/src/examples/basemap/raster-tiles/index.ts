import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "basemap",
  order: 1,
  title: { en: "Raster Tiles", ja: "ラスタータイル" },
  description: {
    en: "Display a basemap.",
    ja: "ベースマップを表示する。",
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
    lng: 20,
    lat: 10,
    height: 8_000_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  const raster = view.addSource({
    type: "raster-tile",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    maxZoom: 8,
  });

  view.addLayer({
    type: "raster",
    source: raster,
  });

  view.attribution?.add([
    {
      attributionHtml: `Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble: Next Generation (public domain)`,
    },
  ]);

  return { view };
}
