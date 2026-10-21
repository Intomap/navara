import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "basemap",
  order: 2,
  title: { en: "Vector tile", ja: "ベクタタイル" },
  description: {
    en: "Display a vector tile basemap.",
    ja: "ベクタータイルベースマップを表示する。",
  },
  docs: "three/source/vector-tile-source",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#dddddd"),
  });

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: 31.220676,
    lat: 30.022815,
    height: 350,
    distance: 1000,
    heading: 10,
    pitch: -20,
    roll: 0,
  });

  const source = await tilejson.addSource({
    type: "vector-tile",
    url: "https://papers.reearth.land/protomaps/tilejson.json",
  });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  view.addLayer({
    type: "vector",
    source,
    sourceLayers: ["earth"],
    polygon: { color: new Color().setStyle("#dddddd"), clampToGround: true },
  });
  view.addLayer({
    type: "vector",
    source,
    sourceLayers: ["landuse"],
    polygon: { color: new Color().setStyle("#c3d1a7"), clampToGround: true },
  });
  view.addLayer({
    type: "vector",
    source,
    sourceLayers: ["water"],
    polygon: { color: new Color().setStyle("#90c1e0"), clampToGround: true },
  });
  view.addLayer({
    type: "vector",
    source,
    sourceLayers: ["buildings"],
    polygon: { color: new Color().setStyle("#dddddd"), clampToGround: true },
  });
  view.addLayer({
    type: "vector",
    source,
    sourceLayers: ["roads"],
    polyline: {
      color: new Color().setStyle("#dddddd"),
      width: 2,
    },
  });

  return { view };
}
