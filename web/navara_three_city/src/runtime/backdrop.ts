import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Sphere,
  Vector3,
} from "three";

import type { CityMaterials } from "../materials";
import { createGroundMaterial } from "../materials/ground";

import type { CityMirrorTile } from "./geometry";
import { localBasisEcef, localToEcef } from "./projection";
import type { CityRtcFrame } from "./rtc";
import type { CityTextureSet } from "./textures";

/** Sea level in the city's height datum (HKPD metres), as the Tokyo reference. */
const SEA_LEVEL = -0.5;
const SEA_COLOR = 0x2c4a5e;
const SEGMENTS = 72;
/** Rings grow geometrically so the ellipsoid sea stays cheap and static. */
const RINGS = [120, 300, 600, 1200, 2500, 5000, 10000, 20000, 40000];
const MIRROR_RADIUS = 2000;

export type CityBackdrop = {
  group: Group;
  water: NonNullable<CityMirrorTile["water"]>;
  update: (focus: { x: number; z: number }) => void;
  dispose: () => void;
};

/**
 * The harbour sea: a static ellipsoid-following disc at sea level with the
 * shared ground/water material (waves, fresnel, mirror). Land terrain occludes
 * it, so only genuinely low areas show water — the same trick as Tokyo's plain.
 */
export function createCityBackdrop(
  rtc: CityRtcFrame,
  materials: CityMaterials,
  textures: CityTextureSet,
  sea: boolean,
): CityBackdrop | undefined {
  if (!sea) return undefined;
  const group = rtc.createRoot("city-sea");

  const positions: number[] = [];
  const normals: number[] = [];
  const locals: number[] = [];
  const layers: number[] = [];
  const lights: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();

  const pushVertex = (x: number, z: number): void => {
    const projected = localToEcef(x, SEA_LEVEL, z);
    point.fromArray(projected.ecef).sub(rtc.origin);
    const basis = localBasisEcef(projected.geographic);
    positions.push(point.x, point.y, point.z);
    normals.push(basis.up[0], basis.up[1], basis.up[2]);
    locals.push(x, SEA_LEVEL, z);
    layers.push(4);
    lights.push(0);
    colors.push(1, 1, 1);
  };

  pushVertex(0, 0);
  for (const radius of RINGS) {
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      pushVertex(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % SEGMENTS));
  }
  for (let ring = 0; ring < RINGS.length - 1; ring++) {
    const inner = 1 + ring * SEGMENTS;
    const outer = inner + SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const next = (i + 1) % SEGMENTS;
      indices.push(inner + i, outer + i, outer + next);
      indices.push(inner + i, outer + next, inner + next);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute(
    "aLocal",
    new BufferAttribute(new Float32Array(locals), 3),
  );
  geometry.setAttribute(
    "aLayer",
    new BufferAttribute(new Float32Array(layers), 1),
  );
  geometry.setAttribute(
    "aLight",
    new BufferAttribute(new Float32Array(lights), 1),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.setIndex(indices);

  const material = createGroundMaterial(materials.uniforms, textures, 4, true, {
    color: SEA_COLOR,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "city-sea-surface";
  mesh.frustumCulled = false;
  group.add(mesh);

  const water: NonNullable<CityMirrorTile["water"]> = {
    sphere: new Sphere(new Vector3(), MIRROR_RADIUS),
    up: new Vector3(0, 1, 0),
  };
  const update = (focus: { x: number; z: number }): void => {
    const projected = localToEcef(focus.x, SEA_LEVEL, focus.z);
    water.sphere.center.fromArray(projected.ecef);
    const basis = localBasisEcef(projected.geographic);
    water.up.fromArray(basis.up);
  };
  update({ x: 0, z: 0 });

  return {
    group,
    water,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
