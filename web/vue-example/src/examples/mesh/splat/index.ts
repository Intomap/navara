import ThreeView from "@navaramap/three";
import type { SplatMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "3d",
  order: 8,
  title: { en: "Gaussian Splat", ja: "ガウシアンスプラット" },
  description: {
    en: "Place a 3D Gaussian Splat model on the globe with SplatMesh.",
    ja: "SplatMesh で 3D ガウシアンスプラットモデルを地球上に配置する。",
  },
  docs: "three_default_descs/mesh-desc/splat-mesh-desc",
};

const SPLAT_URL =
  "https://assets.cms.reearth.io/assets/e2/e8e117-8059-4450-adde-7fa7a3c5908a/Sunny Meadow/Sunny Meadow.sog";

const CENTER = { lng: 11.6, lat: 46.543, height: 2 };

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();

  view.atmosphere.date = new Date("2024-06-21T09:00:00Z");

  view.setCamera({
    lng: CENTER.lng,
    lat: CENTER.lat,
    height: 4,
    distance: 15,
    heading: 12,
    pitch: -8,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/s2cloudless_2016/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  view.addMesh<SplatMeshDesc>({
    geodetic: { ...CENTER, pitch: 180 },
    splat: { url: SPLAT_URL, lod: false },
  });

  view.attribution?.add([
    {
      attribution: "Sunny Meadow by Jeremias Kieferle - CC BY 4.0",
      attributionUrl:
        "https://assets.cms.reearth.io/assets/e2/e8e117-8059-4450-adde-7fa7a3c5908a/Sunny Meadow/LICENSE",
    },
    {
      attributionHtml:
        '<a href="https://s2maps.eu">Sentinel-2 cloudless 2016</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2016)',
    },
  ]);

  return { view };
}
