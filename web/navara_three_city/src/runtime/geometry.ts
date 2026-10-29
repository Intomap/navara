import type { CityMeshData, CityTileData } from "@navaramap/worker";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Mesh,
  Uint32BufferAttribute,
  Box3,
  Sphere,
  Vector3,
  type Material,
} from "three";

import { GROUND } from "../constants";
import type { CityMaterials } from "../materials";

import { buildAds } from "./ads";
import { updateDetailState } from "./lod";
import type { PropLibrary } from "./props";
import { buildSigns } from "./signs";

/**
 * Distance (m) beyond which a tile swaps its heavy shadow-casting meshes
 * (buildings/prefab) for their thinned LOD1 copies and stops casting shadows.
 * The dropped triangles are far below a pixel at this distance, so the picture
 * is unchanged; this is the distance that pairs with `LOD1_MIN_AREA` in Rust.
 */
const LOD_DISTANCE = 700;

/**
 * Builds a minimal vertex-color geometry for worker-produced dynamic meshes
 * (structures/flyovers). Unlike `createGeometry`, it omits the city tile
 * attributes (`aLocal`, `aLayer`, …) the plain `MeshStandardMaterial` never
 * reads, keeping the upload to position + normal + color.
 */
export function createStructureGeometry(data: CityMeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(data.position, 3),
  );
  geometry.setAttribute("normal", new Float32BufferAttribute(data.normal, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(data.color, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createGeometry(data: CityMeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  const attributes = {
    position: [data.position, 3],
    aLocal: [data.local, 3],
    normal: [data.normal, 3],
    color: [data.color, 3],
    aLayer: [data.layer, 1],
    aLight: [data.light, 1],
    aFacade: [data.facade, 4],
    aBldg: [data.building, 4],
    aPhoto: [data.photo, 2],
    uv: [data.uv, 2],
  } as const;
  for (const [name, [array, size]] of Object.entries(attributes)) {
    if (array.length > 0)
      geometry.setAttribute(name, new Float32BufferAttribute(array, size));
  }
  if (data.index.length > 0)
    geometry.setIndex(new Uint32BufferAttribute(data.index, 1));
  if (data.position.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return geometry;
}

export type CityWaterRegion = {
  y: number;
  box: Box3;
  sphere: Sphere;
};

export type CityMirrorTile = {
  group: Group;
  sphere?: Sphere;
  water?: {
    sphere: Sphere;
    up: Vector3;
  };
};

export type CityTileVisual = {
  group: Group;
  water?: CityWaterRegion;
  roosts: number[];
  treeCount: number;
  setDistance: (distance: number, detailDistance: number) => void;
  dispose: () => void;
};

function findWater(data: CityTileData): CityWaterRegion | undefined {
  const box = new Box3();
  const point = new Vector3();
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < data.ground.layer.length; i += 1) {
    if (data.ground.layer[i] <= GROUND.WATER - 0.5) continue;
    point.fromArray(data.ground.local, i * 3);
    box.expandByPoint(point);
    sumY += point.y;
    count += 1;
  }
  if (count === 0) return undefined;
  const center = box.getCenter(new Vector3());
  const y = sumY / count;
  center.y = y;
  return {
    y,
    box,
    sphere: new Sphere(center, box.getSize(point).length() / 2),
  };
}

export function createTileVisual(
  data: CityTileData,
  materials: CityMaterials,
  props: PropLibrary,
): CityTileVisual {
  const group = new Group();
  group.position.fromArray(data.rtc);
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  const meshes: [CityMeshData, Material, string][] = [
    [data.terrain, materials.terrain, "terrain"],
    [data.ground, materials.ground, "ground"],
    [data.paint, materials.paint, "paint"],
    [data.buildings, materials.buildings, "buildings"],
    [data.prefab, materials.prefab, "prefab"],
    [data.photo, materials.photo, "photo"],
    [data.walls, materials.ground, "walls"],
    [data.decals, materials.decals, "decals"],
  ];
  const owned: Mesh[] = [];
  const shadowCasters: Mesh[] = [];
  for (const [source, material, name] of meshes) {
    if (source.position.length === 0) continue;
    const mesh = new Mesh(createGeometry(source), material);
    mesh.name = name;
    mesh.castShadow =
      name === "buildings" || name === "prefab" || name === "photo";
    mesh.receiveShadow = true;
    if (name === "decals") mesh.renderOrder = 1;
    group.add(mesh);
    owned.push(mesh);
    if (mesh.castShadow) shadowCasters.push(mesh);
  }
  // Distant LOD: thinned copies of the two heavy shadow-casting meshes swap in
  // beyond LOD_DISTANCE, where the dropped triangles are far below a pixel.
  const lodPairs: {
    mesh: Mesh;
    near: BufferGeometry;
    far?: BufferGeometry;
  }[] = [];
  for (const name of ["buildings", "prefab"] as const) {
    const mesh = owned.find((candidate) => candidate.name === name);
    if (!mesh) continue;
    const farData = name === "buildings" ? data.buildingsLod1 : data.prefabLod1;
    const far =
      farData.position.length > 0 ? createGeometry(farData) : undefined;
    lodPairs.push({ mesh, near: mesh.geometry, far });
  }
  let wire: LineSegments | undefined;
  if (data.wires.length > 0) {
    const wireGeometry = new BufferGeometry();
    wireGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(data.wires, 3),
    );
    wireGeometry.computeBoundingSphere();
    wire = new LineSegments(wireGeometry, materials.wire);
    wire.name = "wires";
    wire.visible = false;
    group.add(wire);
  }
  const propVisual = props.build(data);
  group.add(propVisual.group);
  const cityUp = new Vector3().fromArray(data.rtc).normalize();
  const signs = data.signs.some((sign) => sign.style < 3)
    ? buildSigns(data.signs, cityUp, materials.uniforms)
    : undefined;
  const ads = data.signs.some((sign) => sign.style >= 3)
    ? buildAds(data.signs, cityUp, materials.uniforms)
    : undefined;
  if (signs) group.add(signs.group);
  if (ads) group.add(ads.group);
  let propsNear = false;
  let signsNear = false;
  let lodFar = false;
  return {
    group,
    water: findWater(data),
    roosts: propVisual.roosts,
    treeCount: propVisual.treeCount,
    setDistance: (distance, detailDistance) => {
      propsNear = updateDetailState(propsNear, distance, detailDistance, 1.25);
      signsNear = updateDetailState(signsNear, distance, 230, 1.3);
      propVisual.setNear(propsNear);
      if (wire) wire.visible = propsNear;
      signs?.setNear(signsNear);
      const far = distance > LOD_DISTANCE;
      if (far !== lodFar) {
        lodFar = far;
        for (const pair of lodPairs) {
          pair.mesh.geometry = far && pair.far ? pair.far : pair.near;
        }
        for (const caster of shadowCasters) caster.castShadow = !far;
      }
    },
    dispose: () => {
      // Dispose each geometry exactly once: LOD pairs own their near + far
      // geometries, other meshes own the geometry currently attached.
      const lodMeshes = new Set(lodPairs.map((pair) => pair.mesh));
      for (const pair of lodPairs) pair.near.dispose();
      for (const pair of lodPairs) pair.far?.dispose();
      for (const mesh of owned) {
        if (!lodMeshes.has(mesh)) mesh.geometry.dispose();
      }
      wire?.geometry.dispose();
      propVisual.dispose();
      signs?.dispose();
      ads?.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
