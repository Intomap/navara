import ThreeView, { Color } from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "3d",
  order: 3,
  title: { en: "glTF Animation", ja: "glTF アニメーション" },
  description: {
    en: "Play and crossfade a glTF model's animation clips with addMesh.",
    ja: "addMesh で glTF モデルのアニメーションクリップを再生・切替する。",
  },
  docs: "three_default_descs/mesh-desc/gltf-model-desc",
};

const FOX = { lng: 137.6479, lat: 36.2517 };
const FOX_HEADING = 280;

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#cccccc"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  // The animation clips only advance while the view keeps rendering.
  view.animation = true;

  view.atmosphere.date = new Date("2026-07-16T02:00:00Z");
  view.addLight({ ambient: { intensity: 0.6 } });
  view.addLight({ sun: { intensity: 1.6 } });

  view.setCamera({
    lng: FOX.lng,
    lat: FOX.lat,
    height: 5,
    distance: 22,
    heading: FOX_HEADING - 45,
    pitch: -18,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const fox = view.addMesh<GLTFModelDesc>({
    gltfModel: {
      url: `${ctx.assetsUrl}glTF/Fox/Fox.glb`,
      animationEnabled: true,
      animationActiveClip: "Walk",
      animationLoop: true,
      animationAutoPlay: true,
      animationCrossfadeDuration: 0.4,
    },
    geodetic: { ...FOX, heading: FOX_HEADING, scale: 0.12 },
  });

  // Crossfade between the three clips the Fox model ships with.
  const clips = ["Survey", "Walk", "Run"] as const;
  let current: (typeof clips)[number] = "Walk";
  const buttons = clips.map((clip) => {
    const handle = ctx.ui.addButton(clip, () => {
      if (clip === current) return;
      fox.ref.crossFadeAnimation(current, clip, 0.4);
      current = clip;
      buttons.forEach((b, i) => b.setDisabled(clips[i] === current));
    });
    handle.setDisabled(clip === current);
    return handle;
  });

  view.attribution?.add([
    {
      attribution:
        "Fox by PixelMannen (CC0), rig & animation by tomkranis (CC BY 4.0) — Khronos glTF Sample Assets",
      attributionUrl:
        "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox",
    },
  ]);

  return { view };
}
