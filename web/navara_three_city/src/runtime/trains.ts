import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { CityRailLine } from "../types";

import type { CityDynamicFrame, CityDynamicSystem } from "./dynamics";
import type { CityLampLight } from "./lamplight";
import type { CityRtcFrame } from "./rtc";
import { beamTexture } from "./traffic";

type TrainStock = {
  match: string;
  stripe: string;
  body: string;
  cars: number;
  length: number;
};
type TrainPath = {
  name: string;
  pts: [number, number, number][];
  cum: number[];
  length: number;
};
type TrainSet = {
  stock: TrainStock;
  mesh: InstancedMesh;
  beams: InstancedMesh;
  material: MeshStandardMaterial;
  trains: { path: TrainPath; s: number }[];
};

const STOCK: TrainStock[] = [
  { match: "Tuen Ma", stripe: "#9a3b26", body: "#c9ccce", cars: 8, length: 23 },
  { match: "屯馬", stripe: "#9a3b26", body: "#c9ccce", cars: 8, length: 23 },
  {
    match: "East Rail",
    stripe: "#5db7d4",
    body: "#d2d4d6",
    cars: 9,
    length: 24,
  },
  { match: "東鐵", stripe: "#5db7d4", body: "#d2d4d6", cars: 9, length: 24 },
];
const DEFAULT_STOCK: TrainStock = {
  match: "",
  stripe: "#7b8794",
  body: "#c9ccce",
  cars: 8,
  length: 22,
};
const SPEED = 15;
const GAP = 350;
const MIN_PATH = 260;
const TEX_W = 2048;
const TEX_H = 512;
const SIDE_Y0 = 16;
const SIDE_Y1 = 256;

function carTextures(stock: TrainStock): {
  map: CanvasTexture;
  emissiveMap: CanvasTexture;
} {
  const side = document.createElement("canvas");
  const glow = document.createElement("canvas");
  side.width = glow.width = TEX_W;
  side.height = glow.height = TEX_H;
  const g = side.getContext("2d");
  const e = glow.getContext("2d");
  if (!g || !e) throw new Error("Train livery canvas is unavailable");
  e.fillStyle = "#000";
  e.fillRect(0, 0, TEX_W, TEX_H);
  g.fillStyle = stock.body;
  g.fillRect(0, 0, TEX_W, TEX_H);
  g.fillStyle = "#26282b";
  g.fillRect(TEX_W / 2, 0, TEX_W / 2, SIDE_Y0);
  const glass = (x: number, y: number, w: number, h: number, lit = true) => {
    const gradient = g.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, "#2c3a47");
    gradient.addColorStop(0.5, "#151b21");
    gradient.addColorStop(1, "#0c1014");
    g.fillStyle = "#5c6066";
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = gradient;
    g.fillRect(x, y, w, h);
    if (lit) {
      e.fillStyle = "#fff0d0";
      e.fillRect(x, y, w, h);
    }
  };
  const y = SIDE_Y0;
  const height = SIDE_Y1 - SIDE_Y0;
  const shade = g.createLinearGradient(0, y, 0, y + height);
  shade.addColorStop(0, "rgba(255,255,255,0.16)");
  shade.addColorStop(0.55, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.24)");
  g.fillStyle = shade;
  g.fillRect(0, y, TEX_W, height);
  g.fillStyle = "rgba(0,0,0,0.1)";
  for (let x = 0; x < TEX_W; x += 64) g.fillRect(x, y, 1, height);
  g.fillStyle = stock.stripe;
  g.fillRect(0, y + 14, TEX_W, 12);
  g.fillRect(0, y + 132, TEX_W, 18);
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillRect(0, y + 150, TEX_W, 3);
  g.fillStyle = "#3a3d41";
  g.fillRect(0, y + height - 22, TEX_W, 22);
  const doors = 4;
  const pitch = TEX_W / doors;
  for (let door = 0; door < doors; door += 1) {
    const x = pitch * (door + 0.5);
    for (const [wx, ww] of [
      [x - pitch * 0.41, pitch * 0.25],
      [x + pitch * 0.16, pitch * 0.25],
    ])
      glass(wx, y + 46, ww, 74);
    g.fillStyle = stock.stripe;
    g.fillRect(x - 54, y + 30, 108, height - 52);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(x - 56, y + 30, 2, height - 52);
    g.fillRect(x + 54, y + 30, 2, height - 52);
    glass(x - 42, y + 48, 34, 82);
    glass(x + 8, y + 48, 34, 82);
    g.fillStyle = "#2a2c2f";
    g.fillRect(x - 1, y + 30, 3, height - 52);
  }
  g.fillStyle = "#0a0a0a";
  g.fillRect(pitch * 0.5 - 150, y + 30, 70, 12);
  e.fillStyle = "#ffb030";
  for (let k = 0; k < 6; k += 1)
    e.fillRect(pitch * 0.5 - 146 + k * 11, y + 33, 8, 6);
  const endY = SIDE_Y1;
  const endSize = TEX_H - SIDE_Y1;
  g.fillStyle = stock.body;
  g.fillRect(0, endY, endSize, endSize);
  g.fillStyle = stock.stripe;
  g.fillRect(0, endY + endSize * 0.52, endSize, endSize * 0.2);
  g.fillStyle = "#3a3d41";
  g.fillRect(0, endY + endSize * 0.9, endSize, endSize * 0.1);
  glass(
    endSize * 0.1,
    endY + endSize * 0.1,
    endSize * 0.8,
    endSize * 0.36,
    false,
  );
  g.fillStyle = "#0a0a0a";
  g.fillRect(
    endSize * 0.3,
    endY + endSize * 0.03,
    endSize * 0.4,
    endSize * 0.055,
  );
  e.fillStyle = "#ffb030";
  e.fillRect(
    endSize * 0.33,
    endY + endSize * 0.04,
    endSize * 0.34,
    endSize * 0.035,
  );
  for (const sx of [0.16, 0.84]) {
    g.fillStyle = "#f6f2e4";
    g.beginPath();
    g.arc(endSize * sx, endY + endSize * 0.8, endSize * 0.045, 0, Math.PI * 2);
    g.fill();
    e.fillStyle = "#fff6e0";
    e.beginPath();
    e.arc(endSize * sx, endY + endSize * 0.8, endSize * 0.045, 0, Math.PI * 2);
    e.fill();
    g.fillStyle = "#c01818";
    g.beginPath();
    g.arc(
      endSize * (sx < 0.5 ? sx + 0.1 : sx - 0.1),
      endY + endSize * 0.8,
      endSize * 0.03,
      0,
      Math.PI * 2,
    );
    g.fill();
    e.fillStyle = "#ff2a1a";
    e.beginPath();
    e.arc(
      endSize * (sx < 0.5 ? sx + 0.1 : sx - 0.1),
      endY + endSize * 0.8,
      endSize * 0.03,
      0,
      Math.PI * 2,
    );
    e.fill();
  }
  const texture = (canvas: HTMLCanvasElement) => {
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 8;
    return result;
  };
  return { map: texture(side), emissiveMap: texture(glow) };
}

function carGeometry(length: number): BufferGeometry {
  const swatch = 1 - SIDE_Y0 / 2 / TEX_H;
  const plain = (geometry: BufferGeometry, u: number) => {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u, swatch);
    return geometry;
  };
  const body = new BoxGeometry(2.9, 2.75, length - 0.6).translate(0, 2.375, 0);
  const uv = body.attributes.uv;
  const v0 = 1 - SIDE_Y1 / TEX_H;
  const v1 = 1 - SIDE_Y0 / TEX_H;
  const end = (TEX_H - SIDE_Y1) / TEX_W;
  for (let i = 0; i < uv.count; i += 1) {
    if (i < 8) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
    else if (i >= 16) uv.setXY(i, uv.getX(i) * end, uv.getY(i) * v0);
    else uv.setXY(i, 0.25, swatch);
  }
  const parts = [
    body,
    plain(
      new BoxGeometry(2.5, 0.85, length - 2.5).translate(0, 0.575, 0),
      0.75,
    ),
  ];
  for (const z of [-0.36, 0.36])
    parts.push(
      plain(
        new BoxGeometry(2.3, 0.5, 3.2).translate(0, 0.25, z * length),
        0.75,
      ),
    );
  for (const z of [-0.2, 0.2])
    parts.push(
      plain(
        new BoxGeometry(1.9, 0.32, 3.6).translate(0, 3.91, z * length),
        0.75,
      ),
    );
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error("Train geometry is empty");
  return geometry;
}

export function chainRailLines(lines: CityRailLine[]): TrainPath[] {
  const key = (x: number, z: number) => `${x.toFixed(1)},${z.toFixed(1)}`;
  const items = lines.map((line) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < line.pts.length; i += 3)
      pts.push([line.pts[i], line.pts[i + 1], line.pts[i + 2]]);
    return {
      name: line.name ?? "",
      pts,
      start: key(pts[0][0], pts[0][2]),
      end: key(pts[pts.length - 1][0], pts[pts.length - 1][2]),
      used: false,
    };
  });
  const byStart = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.name}|${item.start}`;
    const list = byStart.get(key) ?? [];
    list.push(item);
    byStart.set(key, list);
  }
  const ends = new Set(items.map((item) => `${item.name}|${item.end}`));
  const paths: TrainPath[] = [];
  for (const item of [
    ...items.filter(
      (candidate) => !ends.has(`${candidate.name}|${candidate.start}`),
    ),
    ...items,
  ]) {
    if (item.used) continue;
    const pts: [number, number, number][] = [];
    for (
      let current: (typeof items)[number] | undefined = item;
      current && !current.used;
    ) {
      current.used = true;
      pts.push(...(pts.length ? current.pts.slice(1) : current.pts));
      current = byStart
        .get(`${current.name}|${current.end}`)
        ?.find((candidate) => !candidate.used);
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i += 1)
      cum.push(
        cum[i - 1] +
          Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]),
      );
    const length = cum[cum.length - 1];
    if (length >= MIN_PATH) paths.push({ name: item.name, pts, cum, length });
  }
  return paths;
}

function pointAt(path: TrainPath, distance: number, out: Vector3): Vector3 {
  const { pts, cum } = path;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const t = (distance - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const a = pts[lo];
  const b = pts[hi];
  return out.set(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

export class CityTrains implements CityDynamicSystem {
  readonly group = new Group();
  readonly lamps = new Group();
  private sets: TrainSet[] = [];
  private dummy = new Object3D();
  private a = new Vector3();
  private b = new Vector3();
  private visibleScale = new Vector3(1, 1, 1);
  private matrix = new Matrix4();
  private beam;
  private texture;

  constructor(
    lines: CityRailLine[],
    private rtc: CityRtcFrame,
    lampLight: CityLampLight,
    applyShadow: (material: Material) => void,
  ) {
    this.group.name = "trains";
    this.lamps.name = "train-headlights";
    this.texture = beamTexture();
    this.beam = lampLight.createMaterial(this.texture);
    lampLight.add(this.lamps);
    const stocks = new Map<TrainStock, TrainPath[]>();
    for (const path of chainRailLines(lines)) {
      const stock =
        STOCK.find((candidate) => path.name.includes(candidate.match)) ??
        DEFAULT_STOCK;
      const list = stocks.get(stock) ?? [];
      list.push(path);
      stocks.set(stock, list);
    }
    for (const [stock, list] of stocks) {
      const textures = carTextures(stock);
      const material = new MeshStandardMaterial({
        ...textures,
        roughness: 0.32,
        metalness: 0.55,
        emissive: new Color(0xffffff),
        emissiveIntensity: 0,
      });
      applyShadow(material);
      const mesh = new InstancedMesh(
        carGeometry(stock.length),
        material,
        list.length * stock.cars,
      );
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const pool = new BufferGeometry();
      const z0 = stock.length / 2 - 0.5;
      const z1 = stock.length / 2 + 55;
      pool.setAttribute(
        "position",
        new Float32BufferAttribute(
          [
            -4.5,
            0.12,
            z0,
            4.5,
            0.12,
            z0,
            4.5,
            0.12,
            z1,
            -4.5,
            0.12,
            z0,
            4.5,
            0.12,
            z1,
            -4.5,
            0.12,
            z1,
          ],
          3,
        ),
      );
      pool.setAttribute(
        "uv",
        new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2),
      );
      const beams = new InstancedMesh(pool, this.beam, list.length);
      beams.frustumCulled = false;
      this.lamps.add(beams);
      this.sets.push({
        stock,
        mesh,
        beams,
        material,
        trains: list.map((path, index) => ({
          path,
          s: (index * 613) % (path.length + GAP),
        })),
      });
    }
  }

  update(frame: CityDynamicFrame): void {
    this.beam.color.setRGB(
      2.2 * frame.night,
      2.1 * frame.night,
      1.8 * frame.night,
    );
    this.beam.visible = frame.night > 0.02;
    for (const { stock, mesh, beams, material, trains } of this.sets) {
      material.emissiveIntensity = 0.2 + frame.night * 2.2;
      let index = 0;
      trains.forEach((train, trainIndex) => {
        const span = train.path.length + stock.cars * stock.length + GAP;
        train.s = (train.s + SPEED * frame.dt) % span;
        for (let car = 0; car < stock.cars; car += 1, index += 1) {
          const centre = train.s - (car + 0.5) * stock.length;
          const half = stock.length * 0.36;
          if (centre - half < 0 || centre + half > train.path.length) {
            this.matrix.makeScale(0, 0, 0);
            mesh.setMatrixAt(index, this.matrix);
            if (car === 0) beams.setMatrixAt(trainIndex, this.matrix);
            continue;
          }
          pointAt(train.path, centre + half, this.a);
          pointAt(train.path, centre - half, this.b);
          this.dummy.position.copy(this.a).add(this.b).multiplyScalar(0.5);
          this.dummy.position.y += 0.16;
          this.dummy.lookAt(this.a.x, this.a.y + 0.16, this.a.z);
          this.rtc.matrix(
            this.dummy.position,
            this.dummy.quaternion,
            this.visibleScale,
            this.matrix,
          );
          mesh.setMatrixAt(index, this.matrix);
          if (car === 0) beams.setMatrixAt(trainIndex, this.matrix);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      beams.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const set of this.sets) {
      set.mesh.geometry.dispose();
      set.beams.geometry.dispose();
      set.material.map?.dispose();
      set.material.emissiveMap?.dispose();
      set.material.dispose();
    }
    this.sets = [];
    this.texture.dispose();
    this.lamps.removeFromParent();
    this.group.clear();
  }
}
