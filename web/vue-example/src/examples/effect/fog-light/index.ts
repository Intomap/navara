import ThreeView, { Color, geodeticToVector3 } from "@navaramap/three";
import type {
  FogLightDefinition,
  FogLightEffectDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { streetLamps } from "./data";

export const meta: ExampleMeta = {
  section: "lighting-effect",
  order: 34,
  title: { en: "Fog Light", ja: "Fog Light" },
  description: {
    en: "Render volumetric light with FogLightEffect.",
    ja: "FogLightEffectでボリューメトリックな光を出す。",
  },
  docs: "three_default_descs/effect-desc/fog-light-effect-desc",
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

  defaultPlugin.addDefaultPhotorealScene();
  view.toneMappingExposure = 10;
  view.addLight({
    ambient: { color: new Color().setStyle("#ffffff"), intensity: 0.1 },
  });
  view.atmosphere.date = new Date("2026-07-24T13:00:00Z");

  view.setCamera({
    lng: 139.5405,
    lat: 36.7302,
    height: 1470,
    heading: 292,
    pitch: -15,
    roll: 0,
  });

  const terrain = view.addSource({
    type: "quantized-mesh",
    url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
    maxZoom: 18,
    requestVertexNormals: true,
  });
  view.addLayer({ type: "terrain", source: terrain });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const LAMP_HEIGHT = 1;
  const lampPosition = (lng: number, lat: number, elevation: number) => {
    const { x, y, z } = geodeticToVector3({
      lat,
      lng,
      height: elevation + LAMP_HEIGHT,
    });
    return { x, y, z };
  };
  const lamps: FogLightDefinition[] = streetLamps.map(
    ([lng, lat, elevation]) => ({
      position: lampPosition(lng, lat, elevation),
      color: 0xffb45c,
      intensity: 1.0,
      radius: 1000,
    }),
  );

  let fogDensity = 2;
  const fogLight = view.addEffect<FogLightEffectDesc>({
    fogLight: {
      lights: lamps,
      fogDensity,
      useSurfaceLighting: true,
      maxFar: view.camera.raw.far,
    },
  });

  let lampsUpdateQueued = false;
  // Terrain-height observers return their own cleanup; collect them so a
  // switch away from this example stops the callbacks before the view dies.
  const stopObservers = streetLamps.map(([lng, lat], index) =>
    view.observeTerrainHeightAt({ lat, lng }, (height) => {
      lamps[index] = {
        ...lamps[index],
        position: lampPosition(lng, lat, height),
      };
      if (lampsUpdateQueued) return;
      lampsUpdateQueued = true;
      requestAnimationFrame(() => {
        lampsUpdateQueued = false;
        fogLight.update({ fogLight: { lights: lamps } });
      });
    }),
  );

  ctx.ui.addSlider(
    "Density",
    { min: 0.5, max: 10, value: fogDensity, step: 0.5 },
    (value) => {
      fogDensity = value;
      fogLight.update({ fogLight: { fogDensity } });
    },
  );

  view.attribution?.add([
    {
      attribution: "© Re:Earth Terrain",
      attributionUrl: "https://terrain.reearth.land/",
    },
  ]);

  return {
    view,
    dispose: () => {
      for (const stop of stopObservers) stop();
    },
  };
}
