import ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "getting-started",
  order: 4,
  title: { en: "Sources", ja: "Sources" },
  description: {
    en: "One source, one layer: swap the source's data and the layer reloads.",
    ja: "Source と Layer の分離を掴む。ソースを差し替えると表示が更新される。",
  },
  docs: "three/source/about",
};

const DAY_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const NIGHT_URL = "https://papers.reearth.land/blackmarble/{z}/{x}/{y}.webp";

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  await view.init();

  view.setCamera({
    lng: 100,
    lat: 25,
    height: 7_500_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  const imagery = view.addSource({
    type: "raster-tile",
    url: NIGHT_URL,
    maxZoom: 8,
  });
  view.addLayer({ type: "raster", source: imagery });

  view.attribution?.add([
    {
      attribution: "NASA EOSDIS GIBS (Blue Marble)",
      attributionUrl: "https://earthdata.nasa.gov/gibs",
    },
    {
      attribution: "NASA Earth Observatory (Black Marble 2016)",
      attributionUrl:
        "https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps",
    },
    {
      attribution: "Re:Earth Papers",
      attributionUrl: "https://papers.reearth.land",
    },
  ]);

  let night = true;
  const button = ctx.ui.addButton("Switch to day", () => {
    night = !night;
    imagery.update({ type: "raster-tile", url: night ? NIGHT_URL : DAY_URL });
    button.setLabel(night ? "Switch to day" : "Switch to night");
  });

  return { view };
}
