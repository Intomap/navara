import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { PersonViewPlugin, TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

const START = {
  lng: 137.64724,
  lat: 36.25439,
  height: 1600,
  heading: 64.8,
  cameraDistance: 20,
  cameraPitch: 14.4,
};

export const meta: ExampleMeta = {
  section: "interaction",
  order: 6,
  title: { en: "Person view control", ja: "一人称操作" },
  description: {
    en: "Walk a character up the mountain in first- or third-person view, following the terrain surface.",
    ja: "キャラクターを操作し、一人称/三人称で地形に沿って山を登る。",
  },
  docs: "three_plugins/person-view-plugin",
};

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    shadow: true,
    backgroundColor: new Color().setStyle("#cccccc"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  const personView = new PersonViewPlugin({
    character: {
      modelUrl: `${ctx.assetsUrl}glTF/Fox/Fox.glb`,
      animation: {
        idleClip: "Survey",
        walkClip: "Walk",
        dashClip: "Run",
        dashSpeed: 2,
        crossfadeDuration: 0.3,
      },
      modelRotationOffset: { x: Math.PI / 2, y: Math.PI, z: 0 },
      modelScale: 0.06,
      castShadow: true,
      receiveShadow: true,
    },
    collision: {
      mode: "ground",
    },
    moveSpeed: 10,
    dashSpeedMultiplier: 4,
    cameraDistance: START.cameraDistance,
    cameraPitch: START.cameraPitch,
    fpvHeightOffset: 1.2,
    fpvPitch: 2.9,
    initialView: "tpv",
    startLng: START.lng,
    startLat: START.lat,
    startHeading: START.heading,
  });
  view.addPlugin(personView);

  await view.init();

  // Preload terrain
  view.setCamera({
    lng: START.lng,
    lat: START.lat,
    height: START.height,
    distance: START.cameraDistance,
    heading: START.heading,
    pitch: START.cameraPitch,
    roll: 0,
  });

  view.atmosphere.date = new Date("2026-08-03T00:30:00Z");
  view.addLight({ ambient: { intensity: 1 } });
  view.addLight({
    sun: {
      intensity: 2,
      castShadow: true,
      applyColor: true,
      shadowFar: 1000,
      shadowLambda: 1,
    },
  });

  const terrain = view.addSource({
    type: "quantized-mesh",
    url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
    maxZoom: 18,
    minZoom: 2,
    requestVertexNormals: true,
  });
  view.addLayer({
    type: "terrain",
    source: terrain,
    terrain: { castShadow: true, receiveShadow: true },
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  // The character walks on the terrain (collision mode "ground"), so the
  // ascend / descend keys are left out — they do nothing in that mode.
  const WALKING_BINDINGS: [string, string][] = [
    ["Move", "W / S"],
    ["Turn", "A / D"],
    ["Dash", "Shift"],
    ["First ⇄ third person", "V"],
    ["Free orbit", "Alt + drag"],
    ["Release the camera", "Esc"],
  ];
  // While the plugin is stopped none of the above does anything, so the card
  // shows what is actually being driven instead: the map camera.
  const RELEASED_BINDINGS: [string, string][] = [
    ["Orbit", "Drag"],
    ["Zoom", "Scroll"],
    ["Back to the character", "Esc"],
  ];

  const help = ctx.ui.addHelpCard("Controls", WALKING_BINDINGS);
  personView.onAction(() => {
    help.collapsed = true;
  });

  view.attribution?.add([
    {
      attribution: "Re:Earth Terrain",
      attributionUrl: "https://terrain.reearth.land/",
    },
    {
      attribution:
        "Fox by PixelMannen (CC0), rig & animation by tomkranis (CC BY 4.0) — Khronos glTF Sample Assets",
      attributionUrl:
        "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox",
    },
  ]);

  await personView.resolveStartHeight(terrain);

  personView.start();

  let walking = true;
  const onWindowKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    walking = !walking;
    if (walking) {
      personView.start();
    } else {
      personView.stop();
    }
    if (walking) {
      help.title = "Controls";
      help.bindings = WALKING_BINDINGS;
      help.collapsed = false;
    } else {
      help.title = "Camera";
      help.bindings = RELEASED_BINDINGS;
      help.collapsed = false;
    }
  };
  window.addEventListener("keydown", onWindowKeyDown);

  return {
    view,
    dispose: () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      personView.stop();
    },
  };
}
