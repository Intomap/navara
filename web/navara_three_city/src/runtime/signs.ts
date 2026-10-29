import type { CitySignData } from "@navaramap/worker";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";

import type { CityUniforms } from "../materials/programs";

const COLORS = [
  ["#c8102e", "#ffffff"],
  ["#f6c400", "#1a1a1a"],
  ["#f4f1ea", "#1a1a1a"],
  ["#151515", "#ffffff"],
  ["#1757a6", "#ffffff"],
  ["#16794c", "#ffffff"],
  ["#e8650a", "#ffffff"],
  ["#d93b7e", "#ffffff"],
  ["#3a2414", "#e9c46a"],
  ["#14213d", "#ffffff"],
  ["#ffffff", "#e8650a"],
  ["#ffffff", "#0a8f4f"],
  ["#0f6fc6", "#ffffff"],
  ["#5a5d61", "#ffffff"],
];
const FONT =
  '"PingFang HK", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const PX = 48;
const ATLAS_W = 2048;
const ATLAS_MAX_H = 4096;
const live = new Set<MeshStandardMaterial>();
const jobs: { cancelled: boolean; step: () => boolean }[] = [];

export function updateSignJobs(night: number): void {
  const until = performance.now() + 2.5;
  while (jobs.length && performance.now() < until) {
    if (jobs[0].cancelled || jobs[0].step()) jobs.shift();
  }
  for (const material of live) material.emissiveIntensity = 0.12 + night * 1.25;
}

function drawSign(
  context: CanvasRenderingContext2D,
  sign: CitySignData,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const [background, foreground] = COLORS[sign.color] ?? COLORS[2];
  context.save();
  context.beginPath();
  context.rect(x, y, w, h);
  context.clip();
  context.fillStyle = background;
  context.fillRect(x, y, w, h);
  context.strokeStyle = "rgba(0,0,0,0.25)";
  context.lineWidth = 3;
  context.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  if (sign.color === 10) {
    context.fillStyle = "#e8650a";
    context.fillRect(x, y, w, 7);
    context.fillStyle = "#0a8f4f";
    context.fillRect(x, y + h - 14, w, 7);
    context.fillStyle = "#c8102e";
    context.fillRect(x, y + h - 7, w, 7);
  }
  if (sign.color === 11) {
    context.fillStyle = "#0a8f4f";
    context.fillRect(x, y + h - 14, w, 8);
    context.fillStyle = "#1757a6";
    context.fillRect(x, y + h - 6, w, 6);
  }
  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const chars = [...sign.text];
  if (
    sign.style === 1 &&
    chars.some((char) => (char.codePointAt(0) ?? 0) > 0x2e7f)
  ) {
    const cellH = (h - 12) / chars.length;
    context.font = `900 ${Math.min(w * 0.72, cellH * 0.94)}px ${FONT}`;
    chars.forEach((char, i) =>
      context.fillText(
        char === "ー" ? "｜" : char,
        x + w / 2,
        y + 6 + cellH * (i + 0.5),
      ),
    );
  } else {
    const turn = sign.style === 1,
      long = turn ? h : w,
      short = turn ? w : h;
    context.translate(x + w / 2, y + h / 2);
    if (turn) context.rotate(Math.PI / 2);
    context.font = `900 ${short * 0.62}px ${FONT}`;
    const measured = context.measureText(sign.text).width;
    if (measured > long - 16) context.scale((long - 16) / measured, 1);
    context.fillText(sign.text, 0, short * 0.03);
  }
  context.restore();
}

type Cell = { x: number; y: number; w: number; h: number; sign: CitySignData };
type Near = {
  job: { cancelled: boolean; step: () => boolean };
  geometry: BufferGeometry;
  mesh?: Mesh;
  material?: MeshStandardMaterial;
  texture?: Texture;
};

export type SignVisual = {
  group: Group;
  setNear: (near: boolean) => void;
  dispose: () => void;
};

export function buildSigns(
  all: CitySignData[],
  cityUp: Vector3,
  uniforms: CityUniforms,
): SignVisual {
  const signs = all.filter((sign) => sign.style < 3);
  const group = new Group();
  group.name = "signs";
  const positions: number[] = [],
    colors: number[] = [];
  const quads: [CitySignData, number][] = [];
  const quad = (sign: CitySignData, corners: Vector3[]) => {
    quads.push([sign, positions.length / 3]);
    for (const id of [0, 1, 2, 0, 2, 3])
      positions.push(...corners[id].toArray());
    const color = new Color((COLORS[sign.color] ?? COLORS[2])[0]);
    for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b);
  };
  for (const sign of signs) {
    const center = new Vector3().fromArray(sign.position);
    const normal = new Vector3().fromArray(sign.normal).normalize();
    const right = new Vector3().crossVectors(cityUp, normal).normalize();
    const point = (side: number, up: number) =>
      center
        .clone()
        .addScaledVector(right, (side * sign.width) / 2)
        .addScaledVector(cityUp, (up - 0.5) * sign.height);
    if (sign.style === 1) {
      const blade = (out: number, up: number) =>
        center
          .clone()
          .addScaledVector(normal, 0.15 + out * sign.width)
          .addScaledVector(cityUp, (up - 0.5) * sign.height);
      quad(sign, [blade(0, 0), blade(1, 0), blade(1, 1), blade(0, 1)]);
      quad(sign, [blade(1, 0), blade(0, 0), blade(0, 1), blade(1, 1)]);
    } else quad(sign, [point(-1, 0), point(1, 0), point(1, 1), point(-1, 1)]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const panel = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    side: DoubleSide,
  });
  panel.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uNight * 1.3;",
      );
  };
  panel.customProgramCacheKey = () => "navara-city-sign-panel-v2";
  group.add(new Mesh(geometry, panel));
  let near: Near | undefined;
  let disposed = false;

  const dropNear = () => {
    if (!near) return;
    near.job.cancelled = true;
    if (near.mesh) group.remove(near.mesh);
    if (near.material) live.delete(near.material);
    near.texture?.dispose();
    near.material?.dispose();
    near.geometry.dispose();
    near = undefined;
  };
  const makeNear = () => {
    const cells = new Map<string, Cell>();
    let cx = 0,
      cy = 0,
      rowH = 0;
    for (const sign of signs) {
      const key = `${sign.style}|${sign.color}|${sign.text}|${sign.width}|${sign.height}`;
      if (cells.has(key)) continue;
      const vertical = sign.style === 1;
      const long = Math.min(
        384,
        Math.round(
          PX * Math.max(sign.width / sign.height, sign.height / sign.width),
        ),
      );
      const w = vertical ? PX : long,
        h = vertical ? long : PX;
      if (cx + w > ATLAS_W) {
        cx = 0;
        cy += rowH + 2;
        rowH = 0;
      }
      if (cy + h > ATLAS_MAX_H) break;
      cells.set(key, { x: cx, y: cy, w, h, sign });
      cx += w + 2;
      rowH = Math.max(rowH, h);
    }
    const height = Math.min(
      ATLAS_MAX_H,
      2 ** Math.ceil(Math.log2(Math.max(64, cy + rowH))),
    );
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_W;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const todo = [...cells.values()],
      nearPositions: number[] = [],
      uv: number[] = [];
    for (const [sign, first] of quads) {
      const cell = cells.get(
        `${sign.style}|${sign.color}|${sign.text}|${sign.width}|${sign.height}`,
      );
      if (!cell) continue;
      for (let i = first * 3; i < (first + 6) * 3; i++)
        nearPositions.push(positions[i]);
      const u0 = cell.x / ATLAS_W,
        u1 = (cell.x + cell.w) / ATLAS_W;
      const v1 = 1 - cell.y / height,
        v0 = 1 - (cell.y + cell.h) / height;
      uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const nearGeometry = new BufferGeometry();
    nearGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(nearPositions, 3),
    );
    nearGeometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    nearGeometry.computeVertexNormals();
    nearGeometry.computeBoundingSphere();
    const made = {} as Near;
    made.geometry = nearGeometry;
    made.job = {
      cancelled: false,
      step: () => {
        for (let n = 0; n < 6 && todo.length; n++) {
          const cell = todo.pop();
          if (cell)
            drawSign(context, cell.sign, cell.x, cell.y, cell.w, cell.h);
        }
        if (todo.length) return false;
        void createImageBitmap(canvas, {
          imageOrientation: "flipY",
          premultiplyAlpha: "none",
        }).then((bitmap) => {
          if (made.job.cancelled || disposed) {
            bitmap.close();
            return;
          }
          const texture = new Texture(bitmap);
          texture.flipY = false;
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
          texture.addEventListener("dispose", () => bitmap.close());
          const material = new MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.12 + uniforms.uNight.value * 1.25,
            roughness: 0.55,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          });
          made.texture = texture;
          made.material = material;
          made.mesh = new Mesh(nearGeometry, material);
          live.add(material);
          group.add(made.mesh);
        });
        return true;
      },
    };
    near = made;
    jobs.push(made.job);
  };
  return {
    group,
    setNear: (value) => {
      if (disposed) return;
      if (value && !near) makeNear();
      else if (!value) dropNear();
    },
    dispose: () => {
      disposed = true;
      dropNear();
      geometry.dispose();
      panel.dispose();
      group.clear();
    },
  };
}
