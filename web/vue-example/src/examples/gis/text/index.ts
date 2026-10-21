import ThreeView, { Color, fetchFontFamilyFromCss } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "2d",
  order: 5,
  title: { en: "Text", ja: "Text" },
  description: {
    en: "Stand a text label at a GeoJSON point with a Google Font.",
    ja: "GeoJSON のポイントに Google Font のテキストを立てる。",
  },
  docs: "three/material/text-material",
};

const EVEREST = { lng: 86.925, lat: 27.9881 };

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.addFontFamily(
    await fetchFontFamilyFromCss(
      "Arsenal",
      "https://fonts.googleapis.com/css2?family=Arsenal:wght@700",
    ),
  );

  view.setCamera({
    lng: EVEREST.lng,
    lat: EVEREST.lat,
    distance: 300,
    heading: 0,
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
    text: {
      text: "Mount Everest",
      font: "Arsenal",
      color: new Color().setStyle("#ffffff"),
      size: 110,
      sizeInMeters: false,
      clampToGround: true,
      center: { x: 0.5, y: 0 },
      outlineColor: new Color().setStyle("#000000"),
      outlineWidth: 4,
    },
  });

  return { view };
}
