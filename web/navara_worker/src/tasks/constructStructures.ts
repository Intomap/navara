import {
  constructStructures as constructStructuresImpl,
  constructFlyovers as constructFlyoversImpl,
  type ReturnedCityMesh,
} from "@navaramap/engine-worker";

import { transfer } from "..";

import {
  takeMesh,
  type CityGridData,
  type CityMeshData,
} from "./constructCityTile";
import { waitWasm } from "./waitWasm";

type StructureBuilder = (
  json: string,
  terrain: Uint8Array,
  x0: number,
  z0: number,
  step: number,
  width: number,
  height: number,
) => ReturnedCityMesh;

async function buildMesh(
  json: string,
  terrainBytes: Uint8Array,
  grid: CityGridData,
  build: StructureBuilder,
): Promise<{ result: CityMeshData }> {
  await waitWasm();
  const mesh = build(
    json,
    terrainBytes,
    grid.x0,
    grid.z0,
    grid.step,
    grid.width,
    grid.height,
  );
  const transfers: ArrayBufferLike[] = [];
  const result = takeMesh(mesh, transfers);
  const ownedBuffers = transfers.map((buffer) => {
    if (!(buffer instanceof ArrayBuffer))
      throw new Error("City WASM results must own ArrayBuffer storage");
    return buffer;
  });
  return transfer({ result }, ownedBuffers);
}

/** Builds the city-wide dynamic structure mesh (footbridges/platforms/canopies). */
export function constructStructuresMesh(
  structuresJson: string,
  terrainBytes: Uint8Array,
  grid: CityGridData,
): Promise<{ result: CityMeshData }> {
  return buildMesh(structuresJson, terrainBytes, grid, constructStructuresImpl);
}

/** Builds the city-wide flyover (elevated road) mesh. */
export function constructFlyoversMesh(
  roadsJson: string,
  terrainBytes: Uint8Array,
  grid: CityGridData,
): Promise<{ result: CityMeshData }> {
  return buildMesh(roadsJson, terrainBytes, grid, constructFlyoversImpl);
}
