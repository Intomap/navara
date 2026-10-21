import ThreeView, { Color } from "@navaramap/three";
import type { SelectiveBloomEffectDesc } from "@navaramap/three-default-descs";
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
  order: 30,
  title: { en: "Selective Bloom", ja: "Selective Bloom" },
  description: {
    en: "Make selected objects glow with bloom.",
    ja: "指定したオブジェクトをブルームで発光させる。",
  },
  docs: "three_default_descs/effect-desc/selective-bloom-effect-desc",
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

  view.addLight({ ambient: { intensity: 0.25 } });

  view.setCamera({
    lng: 86.829164,
    lat: 27.980929,
    distance: 48,
    heading: 205,
    pitch: -32,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const bloom = view.addEffect<SelectiveBloomEffectDesc>({
    selectiveBloom: { strength: 0.8, radius: 0.35, threshold: 0 },
  });

  const source = view.addSource({ type: "geojson", data });
  view.addLayer({
    type: "vector",
    source,
    polygon: {
      color: new Color().setStyle("#0091ff"),
      extrudedHeight: 5,
      clampToGround: false,
      effectIds: [bloom.id],
      emissiveColor: new Color().setStyle("#0091ff"),
      emissiveIntensity: 0.4,
    },
  });

  let visible = true;
  const toggle = ctx.ui.addButton("Bloom: On", () => {
    visible = !visible;
    bloom.update({ visible });
    toggle.setLabel(`Bloom: ${visible ? "On" : "Off"}`);
  });

  view.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
  ]);

  return { view };
}
