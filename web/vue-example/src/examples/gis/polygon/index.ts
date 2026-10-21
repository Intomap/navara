import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "2d",
  order: 3,
  title: { en: "Polygon", ja: "Polygon" },
  description: {
    en: "Drape GeoJSON polygons onto the globe surface with clampToGround.",
    ja: "GeoJSON のポリゴンを clampToGround で地球表面に貼り付ける。",
  },
  docs: "three/material/polygon-material",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  await view.init();

  view.setCamera({
    lng: 20,
    lat: 5,
    height: 6_500_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  view.addLayer({ type: "terrain", ellipsoid: {} });
  view.globe.color = new Color().setStyle("#0b1420");

  const source = view.addSource({
    type: "geojson",
    url: `${ctx.assetsUrl}globe.geojson`,
  });
  view.addLayer({
    type: "vector",
    source,
    polygon: {
      color: new Color().setStyle("#0091ff"),
      clampToGround: true,
    },
  });

  view.attribution?.add([
    {
      attribution: "Made with Natural Earth",
      attributionUrl: "https://www.naturalearthdata.com/",
    },
  ]);

  return { view };
}
