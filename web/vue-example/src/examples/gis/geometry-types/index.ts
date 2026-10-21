import ThreeView, { Color } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { features } from "./data";

export const meta: ExampleMeta = {
  section: "2d",
  order: 6,
  title: { en: "Geometry Types", ja: "Geometry Types" },
  description: {
    en: "Draw boundary polylines and vertex points from lines and polygons with geometryTypes.",
    ja: "geometryTypes でライン・ポリゴンから境界ポリラインや頂点ポイントを表示する。",
  },
  docs: "three/layer/vector-layer",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.setCamera({
    lng: 137.6497,
    lat: 36.2415,
    height: 380,
    heading: 0,
    pitch: -48,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const source = view.addSource({ type: "geojson", data: features });

  let boundaries = true;
  let vertices = true;

  const addLayer = () =>
    view.addLayer({
      type: "vector",
      source,
      polygon: {
        color: new Color().setStyle("#0091ff"),
        transparent: true,
        opacity: 0.55,
      },
      polyline: {
        color: new Color().setStyle("#0091ff"),
        width: 12,
        geometryTypes: boundaries ? ["line", "polygon"] : ["line"],
      },
      ...(vertices && {
        point: {
          color: new Color().setStyle("#ff6b2c"),
          size: 22,
          sizeInMeters: false,
          declutter: false,
          depthTest: false,
          geometryTypes: ["point", "line", "polygon"],
        },
      }),
    });

  let layer = addLayer();

  const rebuild = () => {
    layer.delete();
    layer = addLayer();
  };

  ctx.ui.addCheckbox("Polygon boundaries", boundaries, (checked) => {
    boundaries = checked;
    rebuild();
  });
  ctx.ui.addCheckbox("Vertex points", vertices, (checked) => {
    vertices = checked;
    rebuild();
  });

  return { view };
}
