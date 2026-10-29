import {
  DataArrayTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector4,
} from "three";

import type { CityManifest } from "../types";

export type Orthophoto = {
  texture: Texture;
  rect: Vector4;
};

export async function loadOrthophoto(
  baseUrl: string,
  manifest: CityManifest,
): Promise<Orthophoto | undefined> {
  const response = await fetch(`${baseUrl}/ortho/index.json`);
  if (!response.ok) return undefined;
  const index = (await response.json()) as { file?: string };
  if (!index.file || !manifest.bounds) return undefined;
  const texture = await new TextureLoader().loadAsync(
    `${baseUrl}/ortho/${index.file}`,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const { minX, minZ, maxX, maxZ } = manifest.bounds;
  return {
    texture,
    rect: new Vector4(minX, minZ, maxX - minX, maxZ - minZ),
  };
}

const SIZE = 1024;
const WALL_LAYERS = [
  ["wall_tile", 1.3, 0.8],
  ["wall_concrete", 3.2, 0.75],
  ["wall_plaster", 2.6, 0.3],
  ["wall_brick", 0.85, 0.8],
  ["wall_siding", 1.6, 0.6],
  ["roof", 5, 0.6],
] as const;
const GROUND_LAYERS = [
  ["asphalt", 5, 1],
  ["pavers", 2.2, 1],
  ["grass", 3, 1],
  ["ground", 4, 1],
] as const;

export type CityTextureSet = {
  albedo: DataArrayTexture;
  normal: DataArrayTexture;
  scales: number[];
  details: number[];
  dispose: () => void;
};

export type CityTextures = {
  wall: CityTextureSet;
  ground: CityTextureSet;
  dispose: () => void;
};

const linear = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

async function pixels(
  baseUrl: string,
  key: string,
  file: string,
): Promise<Uint8ClampedArray> {
  const response = await fetch(`${baseUrl}/textures/${key}/${file}`);
  if (!response.ok)
    throw new Error(`City texture ${key}/${file} failed (${response.status})`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("City texture canvas is unavailable");
  context.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  return context.getImageData(0, 0, SIZE, SIZE).data;
}

function detail(pixels: Uint8ClampedArray): Uint8Array {
  const mean = [0, 0, 0];
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    for (let c = 0; c < 3; c += 1) mean[c] += linear[pixels[i + c]];
  }
  const output = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      output[i + c] = Math.min(
        255,
        Math.round((linear[pixels[i + c]] / (mean[c] / count)) * 127.5),
      );
    }
    output[i + 3] = 255;
  }
  return output;
}

function arrayTexture(layers: readonly Uint8Array[]): DataArrayTexture {
  const data = new Uint8Array(SIZE * SIZE * 4 * layers.length);
  layers.forEach((layer, i) => data.set(layer, i * SIZE * SIZE * 4));
  const texture = new DataArrayTexture(data, SIZE, SIZE, layers.length);
  texture.format = RGBAFormat;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

async function loadSet(
  baseUrl: string,
  definitions: readonly (readonly [string, number, number])[],
): Promise<CityTextureSet> {
  const [diffuse, normals] = await Promise.all([
    Promise.all(
      definitions.map(async ([key]) =>
        detail(await pixels(baseUrl, key, "diff.jpg")),
      ),
    ),
    Promise.all(
      definitions.map(
        async ([key]) => new Uint8Array(await pixels(baseUrl, key, "nor.jpg")),
      ),
    ),
  ]);
  const albedo = arrayTexture(diffuse);
  const normal = arrayTexture(normals);
  return {
    albedo,
    normal,
    scales: definitions.map(([, scale]) => scale),
    details: definitions.map(([, , value]) => value),
    dispose: () => {
      albedo.dispose();
      normal.dispose();
    },
  };
}

export async function loadCityTextures(baseUrl: string): Promise<CityTextures> {
  const [wall, ground] = await Promise.all([
    loadSet(baseUrl, WALL_LAYERS),
    loadSet(baseUrl, GROUND_LAYERS),
  ]);
  return {
    wall,
    ground,
    dispose: () => {
      wall.dispose();
      ground.dispose();
    },
  };
}
