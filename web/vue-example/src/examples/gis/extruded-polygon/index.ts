import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { gorakShepHuts as data } from "./data";

export const meta: ExampleMeta = {
  section: "2.5d",
  order: 1,
  title: { en: "Extruded Polygon", ja: "Extruded Polygon" },
  description: {
    en: "Extrude GeoJSON polygons into fixed-height 3D blocks.",
    ja: "GeoJSON のポリゴンを固定高さで 3D 押し出しする。",
  },
  docs: "three/material/polygon-material",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    shadow: true,
    useNormal: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
  view.addLight({ ambient: { intensity: 0.6 } });
  view.addLight({
    sun: { intensity: 1.8, castShadow: true, shadowFar: 1000, applyColor: true },
  });

  view.setCamera({
    lng: 86.82918,
    lat: 27.9808,
    distance: 52,
    heading: 25,
    pitch: -35,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  view.addLayer({ type: "terrain", ellipsoid: { receiveShadow: true } });

  const source = view.addSource({ type: "geojson", data });
  view.addLayer({
    type: "vector",
    source,
    polygon: {
      color: new Color().setStyle("#0091ff"),
      extrudedHeight: 5,
      clampToGround: false,
      castShadow: true,
      height: 0,
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
