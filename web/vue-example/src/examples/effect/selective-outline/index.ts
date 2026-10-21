import ThreeView, { Color } from "@navaramap/three";
import type { SelectiveOutlineEffectDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { data } from "./data";

export const meta: ExampleMeta = {
  section: "lighting-effect",
  order: 31,
  title: { en: "Selective Outline", ja: "Selective Outline" },
  description: {
    en: "Draw outlines around selected objects.",
    ja: "指定したオブジェクトに輪郭線を付ける。",
  },
  docs: "three_default_descs/effect-desc/selective-outline-effect-desc",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({ shadow: true });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
  view.addLight({ ambient: { intensity: 0.6 } });
  view.addLight({ sun: { intensity: 1.8, castShadow: true, shadowFar: 1000 } });

  view.setCamera({
    lng: 86.829149,
    lat: 27.98073,
    distance: 50,
    heading: 340,
    pitch: -35,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  view.addLayer({ type: "terrain", ellipsoid: { receiveShadow: true } });

  const outline = view.addEffect<SelectiveOutlineEffectDesc>({
    selectiveOutline: {
      color: new Color().setStyle("#0091ff"),
      thickness: 2,
      edgeStrength: 1,
    },
  });

  const source = view.addSource({ type: "geojson", data });
  view.addLayer({
    type: "vector",
    source,
    polygon: {
      color: new Color().setStyle("#f4f2ee"),
      extrudedHeight: 5,
      clampToGround: false,
      castShadow: true,
      effectIds: [outline.id],
    },
  });

  let visible = true;
  const toggle = ctx.ui.addButton("Outline: On", () => {
    visible = !visible;
    outline.update({ visible });
    toggle.setLabel(`Outline: ${visible ? "On" : "Off"}`);
  });

  view.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
  ]);

  return { view };
}
