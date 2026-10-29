import {
  constructCityTile as constructCityTileImpl,
  type ReturnedCityMesh,
} from "@navaramap/engine-worker";

import { transfer } from "..";

import { waitWasm } from "./waitWasm";

export type CityMeshData = {
  position: Float32Array;
  local: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  layer: Float32Array;
  light: Float32Array;
  facade: Float32Array;
  building: Float32Array;
  photo: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
};

export type CitySignData = {
  position: [number, number, number];
  normal: [number, number, number];
  width: number;
  height: number;
  style: number;
  color: number;
  text: string;
};

export type CityGridData = {
  x0: number;
  z0: number;
  step: number;
  width: number;
  height: number;
};

export type CityTileData = {
  rtc: Float64Array;
  terrain: CityMeshData;
  ground: CityMeshData;
  paint: CityMeshData;
  decals: CityMeshData;
  buildings: CityMeshData;
  buildingsLod1: CityMeshData;
  prefab: CityMeshData;
  prefabLod1: CityMeshData;
  photo: CityMeshData;
  walls: CityMeshData;
  wires: Float32Array;
  propMatrices: Float32Array;
  propMetadata: Float32Array;
  treeCount: number;
  signs: CitySignData[];
};

export function takeMesh(
  mesh: ReturnedCityMesh,
  transfers: ArrayBufferLike[],
): CityMeshData {
  const result: CityMeshData = {
    position: mesh.removePosition(),
    local: mesh.removeLocal(),
    normal: mesh.removeNormal(),
    color: mesh.removeColor(),
    layer: mesh.removeLayer(),
    light: mesh.removeLight(),
    facade: mesh.removeFacade(),
    building: mesh.removeBuilding(),
    photo: mesh.removePhoto(),
    uv: mesh.removeUv(),
    index: mesh.removeIndex(),
  };
  mesh.free();
  for (const value of Object.values(result)) {
    if (value.byteLength > 0) transfers.push(value.buffer);
  }
  return result;
}

export async function constructCityTile(
  tileBytes: Uint8Array,
  prefabBytes: Uint8Array | undefined,
  terrainBytes: Uint8Array,
  grid: CityGridData,
  decksJson = "[]",
): Promise<{ result: CityTileData }> {
  await waitWasm();
  const city = constructCityTileImpl(
    tileBytes,
    prefabBytes,
    terrainBytes,
    grid.x0,
    grid.z0,
    grid.step,
    grid.width,
    grid.height,
    decksJson,
  );
  const transfers: ArrayBufferLike[] = [];
  const rtc = city.removeRtc();
  const propMatrices = city.removePropMatrices();
  const propMetadata = city.removePropMetadata();
  const wires = city.removeWires();
  const result: CityTileData = {
    rtc,
    terrain: takeMesh(city.removeTerrain(), transfers),
    ground: takeMesh(city.removeGround(), transfers),
    paint: takeMesh(city.removePaint(), transfers),
    decals: takeMesh(city.removeDecals(), transfers),
    buildings: takeMesh(city.removeBuildings(), transfers),
    buildingsLod1: takeMesh(city.removeBuildingsLod1(), transfers),
    prefab: takeMesh(city.removePrefab(), transfers),
    prefabLod1: takeMesh(city.removePrefabLod1(), transfers),
    photo: takeMesh(city.removePhoto(), transfers),
    walls: takeMesh(city.removeWalls(), transfers),
    wires,
    propMatrices,
    propMetadata,
    treeCount: city.removeTreeCount(),
    signs: JSON.parse(city.signsJson()) as CitySignData[],
  };
  transfers.push(
    rtc.buffer,
    propMatrices.buffer,
    propMetadata.buffer,
    wires.buffer,
  );
  city.free();
  const ownedBuffers = transfers.map((buffer) => {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error("City WASM results must own ArrayBuffer storage");
    }
    return buffer;
  });
  return transfer({ result }, ownedBuffers);
}
