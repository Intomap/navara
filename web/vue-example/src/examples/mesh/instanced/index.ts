import ThreeView, { Color } from "@navaramap/three";
import type {
  InstancedGltfModelMeshDesc,
  ModelChildConfig,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "3d",
  order: 4,
  title: { en: "Instanced Meshes", ja: "インスタンス描画" },
  description: {
    en: "Draw one glTF model thousands of times in a single draw call.",
    ja: "1 つの glTF モデルを 1 draw call で数千個描画する GPU インスタンシング。",
  },
  docs: "three_default_descs/mesh-desc/instanced-gltf-model-mesh-desc",
};

const CITY = { lng: 139.7671, lat: 35.6812 };
const FIELD_RADIUS = 1000; // meters
const LANTERN_SCALE = 0.6;
const DENSITIES = [3_000, 5_000, 10_000];

export async function run(
  ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#0f1118"),
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.addLight({ ambient: { intensity: 0.45 } });

  view.setCamera({
    lng: 139.7625,
    lat: 35.6772,
    height: 60,
    heading: 34,
    pitch: -14,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/black/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const generateLanterns = (count: number): ModelChildConfig[] => {
    const out: ModelChildConfig[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = FIELD_RADIUS * Math.sqrt(Math.random());
      out.push({
        position: { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r },
        rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
        scale: { x: LANTERN_SCALE, y: LANTERN_SCALE, z: LANTERN_SCALE },
      });
    }
    return out;
  };

  let density = DENSITIES[0];

  const lanterns = view.addMesh<InstancedGltfModelMeshDesc>({
    gltfModels: {
      url: `${ctx.assetsUrl}glTF/Lantern/Lantern.glb`,
      emissiveColor: new Color().setStyle("#ffcc66"),
      emissiveIntensity: 3,
      children: generateLanterns(density),
    },
    geodetic: CITY,
  });

  const buttons = DENSITIES.map((n) => {
    const label = `${n / 1000}k`;
    const handle = ctx.ui.addButton(label, () => {
      density = n;
      lanterns.ref.replaceAll(generateLanterns(density));
      buttons.forEach((b, i) => b.setDisabled(DENSITIES[i] === density));
    });
    handle.setDisabled(n === density);
    return handle;
  });

  view.attribution?.add([
    {
      attribution:
        "Lantern by Microsoft & Frank Galligan (CC0) — Khronos glTF Sample Assets",
      attributionUrl:
        "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern",
    },
  ]);

  return { view };
}
