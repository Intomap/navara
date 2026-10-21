import ThreeView, { Color } from "@navaramap/three";
import type { SmoothLineMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import { CENTER, MID_HEIGHT, loopTrajectory } from "./data";

export const meta: ExampleMeta = {
  section: "3d",
  order: 6,
  title: { en: "Smooth Lines", ja: "スムースライン" },
  description: {
    en: "Draw a smooth interpolated line through a set of points with SmoothLineMesh.",
    ja: "SmoothLineMesh で複数の点から補完された滑らかな線を描く。",
  },
  docs: "three_default_descs/mesh-desc/smooth-line-mesh-desc",
};

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

  // Render every frame so the trail can extend itself over time.
  view.animation = true;

  view.setCamera({
    lng: CENTER.lng,
    lat: CENTER.lat,
    height: MID_HEIGHT,
    distance: 2300,
    heading: 14,
    pitch: -22,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const trail = view.addMesh<SmoothLineMeshDesc>({
    smoothLines: {
      points: loopTrajectory.slice(0, 2),
      tension: 0.5,
      segments: 24,
      lineWidth: 10,
      color: 0x0091ff,
      dashed: false,
      showPoints: false,
    },
  });

  const REVEAL_SPEED = 36; // control points revealed per second

  let revealed = 2;
  let rafId = 0;
  let prevTime: number | undefined;

  const drawUpTo = (count: number) =>
    trail.update({ smoothLines: { points: loopTrajectory.slice(0, count) } });

  const step = (time: number) => {
    const elapsed =
      prevTime === undefined ? 0 : Math.min(time - prevTime, 100) / 1000;
    prevTime = time;
    const shown = Math.floor(revealed);
    revealed = Math.min(revealed + REVEAL_SPEED * elapsed, loopTrajectory.length);
    if (Math.floor(revealed) !== shown) drawUpTo(Math.floor(revealed));
    if (revealed < loopTrajectory.length) rafId = requestAnimationFrame(step);
  };

  const replay = () => {
    cancelAnimationFrame(rafId);
    revealed = 2;
    prevTime = undefined;
    drawUpTo(2);
    rafId = requestAnimationFrame(step);
  };

  ctx.ui.addButton("Replay", replay);
  rafId = requestAnimationFrame(step);

  return {
    view,
    dispose: () => {
      cancelAnimationFrame(rafId);
    },
  };
}
