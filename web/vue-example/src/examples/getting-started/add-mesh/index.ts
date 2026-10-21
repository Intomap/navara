import ThreeView, { Color } from "@navaramap/three";
import type {
  BoxMeshDesc,
  CylinderMeshDesc,
  SphereMeshDesc,
  TubeMeshDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

export const meta: ExampleMeta = {
  section: "getting-started",
  order: 3,
  title: { en: "Meshes", ja: "Meshes" },
  description: {
    en: "Add, restyle and remove 3D meshes: box, sphere, cylinder and tube.",
    ja: "箱・球・円柱・チューブの 3D メッシュを追加・更新・削除する。",
  },
  docs: "three_default_descs/mesh-desc/box-mesh-desc",
};

const STAGE = { lng: 137.6495, lat: 36.2445 };

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
    lng: 137.6495,
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

  const SPACING = 240;
  const rowX = (index: number) => (1.5 - index) * SPACING;

  const addMeshes = (color: string) => {
    const accent = () => new Color().setStyle(color);
    const box = view.addMesh<BoxMeshDesc>({
      box: { width: 100, height: 150, depth: 100, color: accent() },
      geodetic: STAGE,
      position: { x: rowX(0), y: 75, z: 0 },
    });
    const sphere = view.addMesh<SphereMeshDesc>({
      sphere: { radius: 65, color: accent() },
      geodetic: STAGE,
      position: { x: rowX(1), y: 65, z: 0 },
    });
    const cylinder = view.addMesh<CylinderMeshDesc>({
      cylinder: { radiusTop: 50, radiusBottom: 50, height: 150, color: accent() },
      geodetic: STAGE,
      position: { x: rowX(2), y: 75, z: 0 },
    });
    const tube = view.addMesh<TubeMeshDesc>({
      tube: {
        points: [
          { x: -60, y: -60, z: 0 },
          { x: -30, y: 60, z: 30 },
          { x: 30, y: -30, z: -30 },
          { x: 60, y: 60, z: 0 },
        ],
        radius: 15,
        tubularSegments: 64,
        radialSegments: 12,
        color: accent(),
      },
      geodetic: STAGE,
      position: { x: rowX(3), y: 75, z: 0 },
    });
    return { box, sphere, cylinder, tube };
  };

  let color = "#0091ff";
  let meshes: ReturnType<typeof addMeshes> | undefined = addMeshes(color);

  const toggleButton = ctx.ui.addButton("Remove meshes", () => {
    if (meshes) {
      Object.values(meshes).forEach((mesh) => mesh.delete());
      meshes = undefined;
    } else {
      meshes = addMeshes(color);
    }
    toggleButton.setLabel(meshes ? "Remove meshes" : "Add meshes");
    styleButton.setDisabled(!meshes);
  });
  const styleButton = ctx.ui.addButton("Switch color", () => {
    if (!meshes) return;
    color = color === "#0091ff" ? "#ff6b2c" : "#0091ff";
    const accent = new Color().setStyle(color);
    meshes.box.update({ box: { color: accent } });
    meshes.sphere.update({ sphere: { color: accent } });
    meshes.cylinder.update({ cylinder: { color: accent } });
    meshes.tube.update({ tube: { color: accent } });
  });

  return { view };
}
