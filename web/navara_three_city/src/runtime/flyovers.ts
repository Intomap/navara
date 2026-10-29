import {
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from "three";

import type { CityRoads } from "../types";

import { RailSoup, railSections, type RailSection } from "./rails";
import type { CityRtcFrame } from "./rtc";

const DECK_ABOVE = 2.0;
const RAMP_ABOVE = 0.35;
const PIER_SPACING = 27;
const STEP = 3;

type RGB = [number, number, number];
type Profile = [number, number][];

function linear(rgb: RGB): RGB {
  const color = new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
  return [color.r, color.g, color.b];
}

export function buildFlyovers(
  roads: CityRoads,
  ground: (x: number, z: number) => number,
  rtc: CityRtcFrame,
): Mesh<BufferGeometry, MeshStandardMaterial> {
  const concrete: RGB = [0.6, 0.6, 0.58];
  const asphalt: RGB = [0.3, 0.3, 0.32];
  const paint: RGB = [0.9, 0.9, 0.87];
  const barrier: RGB = [0.7, 0.72, 0.72];
  const soup = new RailSoup();
  const at = (
    section: RailSection,
    lateral: number,
    vertical: number,
  ): [number, number, number] => [
    section.p[0] + section.n[0] * lateral,
    section.p[1] + vertical,
    section.p[2] + section.n[2] * lateral,
  ];
  const sweep = (
    a: RailSection,
    b: RailSection,
    profile: Profile | ((section: RailSection) => Profile),
    color: RGB,
  ) => {
    const left = typeof profile === "function" ? profile(a) : profile;
    const right = typeof profile === "function" ? profile(b) : profile;
    for (let j = 0; j + 1 < left.length; j += 1)
      soup.quad(
        at(a, left[j][0], left[j][1]),
        at(b, right[j][0], right[j][1]),
        at(b, right[j + 1][0], right[j + 1][1]),
        at(a, left[j + 1][0], left[j + 1][1]),
        linear(color),
      );
  };

  for (const edge of roads.edges) {
    if (edge.tunnel) continue;
    const expressway = edge.highway.startsWith("motorway");
    if (!edge.flyover && !edge.span && !expressway) continue;
    const sections = railSections(edge.pts, ground);
    if (
      !sections.some(
        (section) => section.h > (edge.flyover || edge.span ? RAMP_ABOVE : 1.5),
      )
    )
      continue;
    const lanes = Math.max(1, edge.lanes);
    const width = edge.span
      ? lanes * 1.65 + 7
      : (lanes * 3.3 + (expressway ? 2.2 : 1.4)) / 2;
    for (let i = 0; i + 1 < sections.length; i += 1) {
      const a = sections[i];
      const b = sections[i + 1];
      const height = Math.max(a.h, b.h);
      if (height <= RAMP_ABOVE) continue;
      if (edge.span) {
        if (Math.min(a.h, b.h) > DECK_ABOVE)
          sweep(
            a,
            b,
            [
              [-width, -0.3],
              [-width, -1.5],
              [width, -1.5],
              [width, -0.3],
            ],
            concrete,
          );
        continue;
      }
      sweep(
        a,
        b,
        [
          [-width + 0.25, 0],
          [width - 0.25, 0],
        ],
        asphalt,
      );
      const line = (offset: number) =>
        sweep(
          a,
          b,
          [
            [offset - 0.07, 0.015],
            [offset + 0.07, 0.015],
          ],
          paint,
        );
      line(-width + 0.75);
      line(width - 0.75);
      if (Math.floor(a.s / (STEP * 2)) % 2 === 0)
        for (let lane = 1; lane < lanes; lane += 1)
          line(-width + 0.75 + (lane * (2 * width - 1.5)) / lanes);
      const top = expressway ? 1.9 : 1.0;
      for (const side of [-1, 1]) {
        sweep(
          a,
          b,
          [
            [side * (width - 0.25), 0],
            [side * (width - 0.25), 0.9],
            [side * width, 0.9],
          ],
          concrete,
        );
        if (expressway)
          sweep(
            a,
            b,
            [
              [side * (width - 0.1), 0.9],
              [side * (width - 0.1), top],
            ],
            barrier,
          );
      }
      if (Math.min(a.h, b.h) > DECK_ABOVE) {
        sweep(
          a,
          b,
          [
            [-width, 0.9],
            [-width, -0.5],
            [-width * 0.55, -1.5],
            [width * 0.55, -1.5],
            [width, -0.5],
            [width, 0.9],
          ],
          concrete,
        );
      } else {
        sweep(
          a,
          b,
          (section) => [
            [-width, 0.9],
            [-width, -Math.max(section.h, 0) - 0.4],
          ],
          concrete,
        );
        sweep(
          a,
          b,
          (section) => [
            [width, -Math.max(section.h, 0) - 0.4],
            [width, 0.9],
          ],
          concrete,
        );
      }
    }
    for (const section of sections) {
      if (
        !edge.span &&
        section.h > DECK_ABOVE + 1.5 &&
        Math.round(section.s / STEP) % Math.round(PIER_SPACING / STEP) === 1
      )
        soup.box(
          section.p,
          section.t,
          section.n,
          1.1,
          Math.min(1.5, width * 0.4),
          section.p[1] - section.h - 1.5,
          section.p[1] - 1.5,
          linear(concrete),
        );
    }
  }

  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.02,
    side: DoubleSide,
  });
  const mesh = soup.mesh(material, rtc);
  mesh.name = "flyovers";
  return mesh;
}
