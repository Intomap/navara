import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";

import type { CityRailLine } from "../types";

import type { CityDynamicFrame, CityDynamicSystem } from "./dynamics";
import type { CityRtcFrame } from "./rtc";
import { CityTrains } from "./trains";

const STEP = 3;
const VIADUCT_ABOVE = 2;
const PIER_SPACING = 16;
const MAST_SPACING = 40;

type Point = [number, number, number];
export type RailSection = {
  p: Point;
  t: Point;
  n: Point;
  s: number;
  h: number;
  left?: boolean;
  right?: boolean;
  deck?: boolean;
  wire?: [number, number];
};

export class RailSoup {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly uv: number[] = [];

  quad(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    color: Point,
    uvs?: [number, number][],
  ) {
    this.tri(a, b, c, color, uvs && [uvs[0], uvs[1], uvs[2]]);
    this.tri(a, c, d, color, uvs && [uvs[0], uvs[2], uvs[3]]);
  }

  tri(a: Point, b: Point, c: Point, color: Point, uvs?: [number, number][]) {
    this.position.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i += 1) this.color.push(...color);
    if (uvs) for (const uv of uvs) this.uv.push(...uv);
  }

  box(
    c: Point,
    t: Point,
    n: Point,
    ht: number,
    hn: number,
    y0: number,
    y1: number,
    color: Point,
  ) {
    const point = (st: number, sn: number, y: number): Point => [
      c[0] + t[0] * ht * st + n[0] * hn * sn,
      y,
      c[2] + t[2] * ht * st + n[2] * hn * sn,
    ];
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      this.quad(
        point(a[0], a[1], y0),
        point(b[0], b[1], y0),
        point(b[0], b[1], y1),
        point(a[0], a[1], y1),
        color,
      );
    }
    this.quad(
      point(-1, -1, y1),
      point(1, -1, y1),
      point(1, 1, y1),
      point(-1, 1, y1),
      color,
    );
  }

  mesh<T extends Material>(
    material: T,
    rtc: CityRtcFrame,
  ): Mesh<BufferGeometry, T> {
    const geometry = new BufferGeometry();
    const position = new Float32Array(this.position.length);
    const point = new Vector3();
    for (let i = 0; i < this.position.length; i += 3) {
      rtc.position(
        this.position[i],
        this.position[i + 1],
        this.position[i + 2],
        point,
      );
      point.toArray(position, i);
    }
    geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(this.color, 3));
    if (this.uv.length)
      geometry.setAttribute("uv", new Float32BufferAttribute(this.uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
}

function bedTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Rail bed canvas is unavailable");
  const image = context.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i += 1) {
    const noise = 0.75 + 0.5 * Math.random();
    image.data[i * 4] = 104 * noise;
    image.data[i * 4 + 1] = 96 * noise;
    image.data[i * 4 + 2] = 88 * noise;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.fillStyle = "#9d9c97";
  for (const y of [20, 84]) context.fillRect(16, y, 96, 22);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function railSections(
  pts: number[],
  ground: (x: number, z: number) => number,
): RailSection[] {
  const points: Point[] = [];
  for (let i = 0; i < pts.length; i += 3)
    points.push([pts[i], pts[i + 1], pts[i + 2]]);
  const out: RailSection[] = [];
  let distance = 0;
  let next = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < 0.01) continue;
    const t: Point = [(b[0] - a[0]) / length, 0, (b[2] - a[2]) / length];
    while (next <= distance + length + 1e-6) {
      const k = (next - distance) / length;
      const p: Point = [
        a[0] + (b[0] - a[0]) * k,
        a[1] + (b[1] - a[1]) * k,
        a[2] + (b[2] - a[2]) * k,
      ];
      out.push({
        p,
        t,
        n: [-t[2], 0, t[0]],
        s: next,
        h: p[1] - ground(p[0], p[2]),
      });
      next += STEP;
    }
    distance += length;
  }
  const end = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail && Math.hypot(end[0] - tail.p[0], end[2] - tail.p[2]) > 0.05)
    out.push({
      p: [...end],
      t: tail.t,
      n: tail.n,
      s: distance,
      h: end[1] - ground(end[0], end[2]),
    });
  for (let i = 1; i < out.length - 1; i += 1) {
    const tx = out[i + 1].p[0] - out[i - 1].p[0];
    const tz = out[i + 1].p[2] - out[i - 1].p[2];
    const length = Math.hypot(tx, tz) || 1;
    out[i].t = [tx / length, 0, tz / length];
    out[i].n = [-tz / length, 0, tx / length];
  }
  return out;
}

export class CityRailways implements CityDynamicSystem {
  readonly group = new Group();
  private trains: CityTrains;
  private ownedMaterials = new Set<Material>();

  constructor(
    lines: CityRailLine[],
    ground: (x: number, z: number) => number,
    cover: (x: number, z: number) => number,
    gauge: number,
    rtc: CityRtcFrame,
    lampLight: ConstructorParameters<typeof CityTrains>[2],
    applyShadow: (material: Material) => void,
  ) {
    this.group.name = "railways";
    const concrete: Point = [0.64, 0.64, 0.62];
    const steel: Point = [0.33, 0.31, 0.3];
    const white: Point = [1, 1, 1];
    const bed = new RailSoup();
    const structure = new RailSoup();
    const wires: number[] = [];
    const at = (
      section: RailSection,
      lateral: number,
      vertical: number,
    ): Point => [
      section.p[0] + section.n[0] * lateral,
      section.p[1] + vertical,
      section.p[2] + section.n[2] * lateral,
    ];
    const sweep = (
      soup: RailSoup,
      a: RailSection,
      b: RailSection,
      profile:
        [number, number][] | ((section: RailSection) => [number, number][]),
      color: Point,
    ) => {
      const pa = typeof profile === "function" ? profile(a) : profile;
      const pb = typeof profile === "function" ? profile(b) : profile;
      for (let i = 0; i + 1 < pa.length; i += 1)
        soup.quad(
          at(a, ...pa[i]),
          at(b, ...pb[i]),
          at(b, ...pb[i + 1]),
          at(a, ...pa[i + 1]),
          color,
        );
    };
    const tracks = lines.map((line) => railSections(line.pts, ground));
    const cellSize = 6;
    const near = new Map<string, [RailSection, number][]>();
    tracks.forEach((sections, lineIndex) =>
      sections.forEach((section) => {
        const key = `${Math.floor(section.p[0] / cellSize)},${Math.floor(section.p[2] / cellSize)}`;
        const list = near.get(key) ?? [];
        list.push([section, lineIndex]);
        near.set(key, list);
      }),
    );
    const beside = (section: RailSection, lineIndex: number, side: number) => {
      for (const distance of [3.2, 4.6]) {
        const x = section.p[0] + section.n[0] * side * distance;
        const z = section.p[2] + section.n[2] * side * distance;
        const ci = Math.floor(x / cellSize);
        const cj = Math.floor(z / cellSize);
        for (let i = ci - 1; i <= ci + 1; i += 1) {
          for (let j = cj - 1; j <= cj + 1; j += 1) {
            for (const [other, otherIndex] of near.get(`${i},${j}`) ?? []) {
              if (
                otherIndex !== lineIndex &&
                Math.abs(other.p[1] - section.p[1]) < 1.2 &&
                Math.hypot(other.p[0] - x, other.p[2] - z) < 2.3
              )
                return true;
            }
          }
        }
      }
      return false;
    };
    tracks.forEach((sections, lineIndex) =>
      sections.forEach((section) => {
        section.left = beside(section, lineIndex, -1);
        section.right = beside(section, lineIndex, 1);
        section.deck = (lines[lineIndex].deck ?? []).some(
          ([from, to]) => section.s >= from - 0.5 && section.s <= to + 0.5,
        );
      }),
    );
    lines.forEach((line, lineIndex) => {
      const sections = tracks[lineIndex];
      for (let i = 0; i + 1 < sections.length; i += 1) {
        const a = sections[i];
        const b = sections[i + 1];
        const height = Math.min(a.h, b.h);
        bed.quad(
          at(a, -1.4, 0),
          at(b, -1.4, 0),
          at(b, 1.4, 0),
          at(a, 1.4, 0),
          white,
          [
            [0, a.s / 1.3],
            [0, b.s / 1.3],
            [1, b.s / 1.3],
            [1, a.s / 1.3],
          ],
        );
        for (const offset of [-gauge / 2, gauge / 2])
          sweep(
            structure,
            a,
            b,
            [
              [offset - 0.035, 0],
              [offset - 0.035, 0.16],
              [offset + 0.035, 0.16],
              [offset + 0.035, 0],
            ],
            steel,
          );
        const open = { "-1": a.left && b.left, "1": a.right && b.right };
        if (a.deck && b.deck) continue;
        if (height > VIADUCT_ABOVE) {
          sweep(
            structure,
            a,
            b,
            [
              [-(open[-1] ? 2.6 : 2.2), -0.9],
              [open[1] ? 2.6 : 2.2, -0.9],
            ],
            concrete,
          );
          for (const side of [-1, 1]) {
            if (open[side as -1 | 1])
              sweep(
                structure,
                a,
                b,
                [
                  [side * 1.4, -0.03],
                  [side * 2.6, -0.03],
                ],
                concrete,
              );
            else
              sweep(
                structure,
                a,
                b,
                [
                  [side * 1.4, -0.03],
                  [side * 2.05, -0.03],
                  [side * 2.05, 1],
                  [side * 2.2, 1],
                  [side * 2.2, -0.9],
                ],
                concrete,
              );
          }
        } else if (Math.max(a.h, b.h) > 0.6) {
          for (const side of [-1, 1]) {
            if (open[side as -1 | 1])
              sweep(
                structure,
                a,
                b,
                [
                  [side * 1.4, 0],
                  [side * 2.6, -0.03],
                ],
                concrete,
              );
            else
              sweep(
                structure,
                a,
                b,
                (section) => [
                  [side * 1.4, 0],
                  [side * 1.95, -0.03],
                  [side * 1.95, -Math.max(section.h, 0) - 0.3],
                ],
                concrete,
              );
          }
        }
      }
      const headroom = (section: RailSection) => {
        const top = cover(section.p[0], section.p[2]) - section.p[1];
        return top > 2.5 ? top - 1.6 : Infinity;
      };
      const wire = (from: RailSection | null, section: RailSection) => {
        const lo = Math.min(5.2, headroom(section) - 0.6);
        const hi = Math.min(5.9, headroom(section));
        section.wire = [lo, hi];
        if (from?.wire) {
          wires.push(...at(from, 0, from.wire[0]), ...at(section, 0, lo));
          const sag = Math.min(
            0.45,
            (from.wire[1] - from.wire[0] + hi - lo) / 4,
          );
          const mid: Point = [
            (from.p[0] + section.p[0]) / 2,
            (from.p[1] + section.p[1]) / 2 + (from.wire[1] + hi) / 2 - sag,
            (from.p[2] + section.p[2]) / 2,
          ];
          wires.push(
            ...at(from, 0, from.wire[1]),
            ...mid,
            ...mid,
            ...at(section, 0, hi),
          );
        }
        return section;
      };
      const electrified = line.railway !== "subway";
      let mastPrevious: RailSection | null = null;
      sections.forEach((section, index) => {
        if (
          !section.deck &&
          section.h > VIADUCT_ABOVE + 0.5 &&
          Math.round(section.s / STEP) % Math.round(PIER_SPACING / STEP) === 0
        )
          structure.box(
            section.p,
            section.t,
            section.n,
            0.7,
            1.3,
            section.p[1] - section.h - 1.5,
            section.p[1] - 0.9,
            concrete,
          );
        if (electrified && headroom(section) < 7) {
          mastPrevious = wire(mastPrevious, section);
          return;
        }
        if (
          electrified &&
          (Math.round(section.s / STEP) % Math.round(MAST_SPACING / STEP) ===
            0 ||
            index === sections.length - 1)
        ) {
          const side = section.right && !section.left ? -2.45 : 2.45;
          const foot = at(section, side, 0);
          if (section.left && section.right) {
            mastPrevious = wire(mastPrevious, section);
            return;
          }
          structure.box(
            foot,
            section.t,
            section.n,
            0.09,
            0.09,
            section.p[1] -
              (section.h > VIADUCT_ABOVE ? 0 : Math.max(section.h, 0)),
            section.p[1] + 6.4,
            steel,
          );
          structure.box(
            at(section, side / 2 - Math.sign(side) * 0.2, 0),
            section.t,
            section.n,
            0.05,
            Math.abs(side) / 2 + 0.2,
            section.p[1] + 5.95,
            section.p[1] + 6.05,
            steel,
          );
          mastPrevious = wire(mastPrevious, section);
        }
      });
    });
    const mouths = new RailSoup();
    for (const line of lines) {
      for (const [x, y, z, dx, dz, tunnel] of line.portals ?? []) {
        const center: Point = [x - dx * 0.35, y, z - dz * 0.35];
        const tangent: Point = [dx, 0, dz];
        const normal: Point = [-dz, 0, dx];
        const top = cover(x + dx * 3, z + dz * 3) - y;
        if (top > 2.5 && top < 7.5) {
          mouths.box(
            center,
            tangent,
            normal,
            0.4,
            2.25,
            y - 0.3,
            y + Math.min(5.4, top - 0.4),
            [0.012, 0.012, 0.015],
          );
          continue;
        }
        mouths.box(
          center,
          tangent,
          normal,
          0.4,
          2.25,
          y - 0.3,
          y + 5.4,
          [0.012, 0.012, 0.015],
        );
        structure.box(
          [x - dx * 0.5, y, z - dz * 0.5],
          tangent,
          normal,
          0.3,
          2.6,
          y + 5.4,
          y + 6,
          concrete,
        );
        if (tunnel)
          structure.box(
            [x + dx * 6, y, z + dz * 6],
            tangent,
            normal,
            6,
            2.9,
            Math.min(y - 1.5, ground(x + dx * 6, z + dz * 6) - 1),
            y + 6,
            concrete,
          );
      }
    }
    if (mouths.position.length) {
      const material = new MeshBasicMaterial({ vertexColors: true });
      this.ownedMaterials.add(material);
      const mesh = mouths.mesh(material, rtc);
      mesh.castShadow = false;
      this.group.add(mesh);
    }
    for (const soup of [bed, structure]) {
      for (let i = 0; i < soup.color.length; i += 3) {
        const color = new Color().setRGB(
          soup.color[i],
          soup.color[i + 1],
          soup.color[i + 2],
          SRGBColorSpace,
        );
        soup.color[i] = color.r;
        soup.color[i + 1] = color.g;
        soup.color[i + 2] = color.b;
      }
    }
    const bedMaterial = new MeshStandardMaterial({
      map: bedTexture(),
      roughness: 0.95,
    });
    const structureMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.05,
      side: DoubleSide,
    });
    this.ownedMaterials.add(bedMaterial);
    this.ownedMaterials.add(structureMaterial);
    applyShadow(bedMaterial);
    applyShadow(structureMaterial);
    this.group.add(bed.mesh(bedMaterial, rtc));
    this.group.add(structure.mesh(structureMaterial, rtc));
    const wireGeometry = new BufferGeometry();
    const wirePositions = new Float32Array(wires.length);
    const point = new Vector3();
    for (let i = 0; i < wires.length; i += 3) {
      rtc.position(wires[i], wires[i + 1], wires[i + 2], point);
      point.toArray(wirePositions, i);
    }
    wireGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(wirePositions, 3),
    );
    const wireMaterial = new LineBasicMaterial({ color: 0x14161a });
    this.ownedMaterials.add(wireMaterial);
    this.group.add(new LineSegments(wireGeometry, wireMaterial));
    this.trains = new CityTrains(lines, rtc, lampLight, applyShadow);
    this.group.add(this.trains.group);
  }

  setEnabled(enabled: boolean): void {
    this.group.visible = enabled;
    this.trains.lamps.visible = enabled;
  }

  update(frame: CityDynamicFrame): void {
    if (this.group.visible) this.trains.update(frame);
  }

  dispose(): void {
    this.trains.dispose();
    const geometries = new Set<BufferGeometry>();
    this.group.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments)
        geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => {
      if (material instanceof MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    });
    this.ownedMaterials.clear();
    this.group.clear();
  }
}
