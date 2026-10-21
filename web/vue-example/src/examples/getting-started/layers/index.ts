import ThreeView, { Color } from "@navaramap/three";
import type { Layer } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { features } from "./data";

export const meta: ExampleMeta = {
  section: "getting-started",
  order: 2,
  title: { en: "Layers", ja: "Layers" },
  description: {
    en: "Add, restyle and remove one GeoJSON layer holding points, lines and polygons.",
    ja: "点・線・面・押し出しを持つ 1 つの GeoJSON レイヤーを追加・更新・削除する。",
  },
  docs: "three/layer/about",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>();

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
  view.addLight({ ambient: { intensity: 0.6 } });
  view.addLight({ sun: { intensity: 1.8 } });

  view.setCamera({
    lng: 137.6503,
    lat: 36.2382,
    height: 400,
    heading: 0,
    pitch: -26,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  // One GeoJSON = one source, rendered by the single vector layer below.
  const source = view.addSource({ type: "geojson", data: features });

  const addLayer = (color: string): Layer => {
    const layer = view.addLayer({
      type: "vector",
      source,
      point: {
        color: new Color().setStyle(color),
        size: 30,
        clampToGround: true,
      },
      polyline: {
        color: new Color().setStyle(color),
        width: 4,
        height: 1,
      },
      polygon: { color: new Color().setStyle(color), clampToGround: false },
    });
    // Extrude each polygon by its `extrudedHeight` feature property.
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => ({
          extrudedHeight: (properties?.["extrudedHeight"] as number) ?? 0,
        }),
        { filters: ["extrudedHeight"] },
      );
    });
    return layer;
  };

  let color = "#0091ff";
  let layer: Layer | undefined = addLayer(color);

  const toggleButton = ctx.ui.addButton("Remove layer", () => {
    if (layer) {
      layer.delete();
      layer = undefined;
    } else {
      layer = addLayer(color);
    }
    toggleButton.setLabel(layer ? "Remove layer" : "Add layer");
    styleButton.setDisabled(!layer);
  });
  const styleButton = ctx.ui.addButton(
    "Switch color",
    () => {
      color = color === "#0091ff" ? "#ff6b2c" : "#0091ff";
      layer?.update({
        point: { color: new Color().setStyle(color) },
        polyline: { color: new Color().setStyle(color) },
        polygon: { color: new Color().setStyle(color) },
      });
    },
  );

  return { view };
}
