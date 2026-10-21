import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";

import { TURBO_COLOR_MAP } from "../../../lib/helpers/colors";
import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "terrain",
  order: 3,
  title: { en: "Elevation Heatmap", ja: "標高ヒートマップ" },
  description: {
    en: "Color-code elevation with a colormap.",
    ja: "標高をカラーマップで色分けする。",
  },
  docs: "three/material/elevation-heatmap-material",
};

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  await view.init();

  view.setCamera({
    lng: 7.66,
    lat: 45.98,
    height: 800_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  const dem = view.addSource({
    type: "raster-dem",
    url: "https://terrain.reearth.land/terrarium/elevation/{z}/{x}/{y}.png",
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
    maxZoom: 15,
  });
  view.addLayer({
    type: "raster",
    source: dem,
    elevationHeatmap: {
      maxHeight: 3200,
      minHeight: 0,
      logarithmic: true,
      logBoundary: 1000,
    },
  });

  // The heatmap colors come from the globe-wide elevation colormap.
  view.globe.elevationColormap = TURBO_COLOR_MAP;

  view.attribution?.add([
    {
      attribution: "Re:Earth Terrain",
      attributionUrl: "https://terrain.reearth.land/",
    },
    {
      attribution: "© Mapterhorn",
      attributionUrl: "https://mapterhorn.com/attribution",
    },
  ]);

  return { view };
}
