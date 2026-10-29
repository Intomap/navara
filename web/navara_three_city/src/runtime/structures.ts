import {
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  ShapeUtils,
  Vector2,
} from "three";

import type { CityStructures } from "../types";

import { RailSoup, railSections, type RailSection } from "./rails";
import type { CityRtcFrame } from "./rtc";

const CONCRETE: [number, number, number] = [0.66, 0.66, 0.64];
const STEEL: [number, number, number] = [0.4, 0.42, 0.44];
const PAVING: [number, number, number] = [0.56, 0.55, 0.52];
const ROOF: [number, number, number] = [0.8, 0.81, 0.82];
const EDGE: [number, number, number] = [0.9, 0.78, 0.2];

type RGB = [number, number, number];
type Profile = [number, number][];

function linear(rgb: RGB): RGB {
  const color = new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
  return [color.r, color.g, color.b];
}

function prism(
  soup: RailSoup,
  ring: [number, number][],
  y0: number,
  y1: number,
  top: RGB,
  side: RGB,
): void {
  const contour = ring.map(([x, z]) => new Vector2(x, z));
  for (const triangle of ShapeUtils.triangulateShape(contour, [])) {
    const [a, b, c] = triangle;
    soup.tri(
      [ring[a][0], y1, ring[a][1]],
      [ring[b][0], y1, ring[b][1]],
      [ring[c][0], y1, ring[c][1]],
      linear(top),
    );
  }
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    soup.quad(
      [ax, y0, az],
      [bx, y0, bz],
      [bx, y1, bz],
      [ax, y1, az],
      linear(side),
    );
  }
}

export function buildStructures(
  structures: CityStructures,
  ground: (x: number, z: number) => number,
  rtc: CityRtcFrame,
): Mesh<BufferGeometry, MeshStandardMaterial> {
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
    profile: Profile,
    color: RGB,
  ) => {
    for (let j = 0; j + 1 < profile.length; j += 1)
      soup.quad(
        at(a, profile[j][0], profile[j][1]),
        at(b, profile[j][0], profile[j][1]),
        at(b, profile[j + 1][0], profile[j + 1][1]),
        at(a, profile[j + 1][0], profile[j + 1][1]),
        linear(color),
      );
  };

  for (const footbridge of structures.footbridges ?? []) {
    const sections = railSections(footbridge.pts, ground);
    const width = footbridge.width / 2;
    for (let i = 0; i + 1 < sections.length; i += 1) {
      const a = sections[i];
      const b = sections[i + 1];
      if (Math.max(a.h, b.h) < 0.4) continue;
      sweep(
        a,
        b,
        [
          [-width, 0],
          [width, 0],
        ],
        PAVING,
      );
      sweep(
        a,
        b,
        [
          [-width, 0],
          [-width, -0.35],
          [width, -0.35],
          [width, 0],
        ],
        CONCRETE,
      );
      for (const side of [-1, 1])
        sweep(
          a,
          b,
          [
            [side * width, 0],
            [side * width, 1.1],
          ],
          STEEL,
        );
    }
    if (!footbridge.steps)
      for (const section of sections) {
        if (section.h > 3 && Math.round(section.s / 3) % 4 === 2)
          soup.box(
            section.p,
            section.t,
            section.n,
            0.3,
            Math.min(0.5, width * 0.4),
            section.p[1] - section.h - 1,
            section.p[1] - 0.35,
            linear(CONCRETE),
          );
      }
  }

  for (const platform of structures.platforms ?? []) {
    const base = Math.min(...platform.ring.map(([x, z]) => ground(x, z))) - 0.5;
    prism(
      soup,
      platform.ring,
      Math.min(base, platform.y - 1.2),
      platform.y,
      PAVING,
      CONCRETE,
    );
    const center = platform.ring.reduce(
      (sum, point) =>
        [sum[0] + point[0], sum[1] + point[1]] as [number, number],
      [0, 0],
    );
    const centerLength = platform.ring.length;
    const inset = (
      index: number,
      distance: number,
    ): [number, number, number] => {
      const [x, z] = platform.ring[index];
      const length =
        Math.hypot(
          center[0] / centerLength - x,
          center[1] / centerLength - z,
        ) || 1;
      return [
        x + ((center[0] / centerLength - x) / length) * distance,
        platform.y + 0.02,
        z + ((center[1] / centerLength - z) / length) * distance,
      ];
    };
    for (let i = 0; i < platform.ring.length; i += 1) {
      const j = (i + 1) % platform.ring.length;
      soup.quad(
        inset(i, 0.6),
        inset(j, 0.6),
        inset(j, 0.95),
        inset(i, 0.95),
        linear(EDGE),
      );
    }
    if (platform.covered) {
      const roof = platform.ring.map((_, index) => {
        const point = inset(index, 0.4);
        return [point[0], point[2]] as [number, number];
      });
      prism(soup, roof, platform.y + 3.5, platform.y + 3.7, ROOF, ROOF);
      for (
        let index = 0;
        index < platform.ring.length;
        index += Math.max(1, Math.round(platform.ring.length / 8))
      ) {
        const point = inset(index, 1.6);
        soup.box(
          [point[0], 0, point[2]],
          [1, 0, 0],
          [0, 0, 1],
          0.08,
          0.08,
          platform.y,
          platform.y + 3.5,
          linear(STEEL),
        );
      }
    }
  }

  for (const canopy of structures.canopies ?? []) {
    prism(soup, canopy.ring, canopy.y - 0.25, canopy.y, ROOF, ROOF);
    for (
      let index = 0;
      index < canopy.ring.length;
      index += Math.max(1, Math.ceil(canopy.ring.length / 6))
    ) {
      const [x, z] = canopy.ring[index];
      soup.box(
        [x, 0, z],
        [1, 0, 0],
        [0, 0, 1],
        0.08,
        0.08,
        ground(x, z),
        canopy.y - 0.25,
        linear(STEEL),
      );
    }
  }

  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.05,
    side: DoubleSide,
  });
  const mesh = soup.mesh(material, rtc);
  mesh.name = "structures";
  return mesh;
}
