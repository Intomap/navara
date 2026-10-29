import type { CityTileData } from "@navaramap/worker";
import { Group, InstancedMesh, Matrix4 } from "three";
import { describe, expect, it } from "vitest";

import { PROP } from "../constants";
import { createCityUniforms } from "../materials/programs";
import { CityLampLight } from "../runtime/lamplight";
import { PropLibrary } from "../runtime/props";
import { CityRtcFrame } from "../runtime/rtc";

function emptyMesh() {
  return {
    position: new Float32Array(),
    normal: new Float32Array(),
    color: new Float32Array(),
    uv: new Float32Array(),
    layer: new Float32Array(),
    local: new Float32Array(),
    light: new Float32Array(),
    facade: new Float32Array(),
    building: new Float32Array(),
    photo: new Float32Array(),
    index: new Uint32Array(),
  };
}

function tileFor(kind: number, variant = 0, scale = 1): CityTileData {
  return {
    rtc: new Float64Array(3),
    terrain: emptyMesh(),
    ground: emptyMesh(),
    paint: emptyMesh(),
    decals: emptyMesh(),
    buildings: emptyMesh(),
    buildingsLod1: emptyMesh(),
    prefab: emptyMesh(),
    prefabLod1: emptyMesh(),
    photo: emptyMesh(),
    walls: emptyMesh(),
    wires: new Float32Array(),
    propMatrices: new Float32Array(new Matrix4().toArray()),
    propMetadata: new Float32Array([kind, variant, 0, scale]),
    treeCount: kind === PROP.TREE && variant < 4 ? 1 : 0,
    signs: [],
  };
}

function createLibrary() {
  const uniforms = createCityUniforms();
  const lamps = new CityLampLight(new CityRtcFrame(), uniforms);
  const library = new PropLibrary(uniforms, lamps);
  const root = new Group();
  library.attach(root);
  return { library, lamps, root };
}

function meshes(root: Group): InstancedMesh[] {
  const result: InstancedMesh[] = [];
  root.traverse((child) => {
    if (child instanceof InstancedMesh) result.push(child);
  });
  return result;
}

describe("city prop contracts", () => {
  it("maps every prop kind into shared city pools", () => {
    const { library, root } = createLibrary();
    const expected: Record<number, number> = {
      [PROP.TREE]: 3,
      [PROP.POLE]: 2,
      [PROP.LIGHT]: 2,
      [PROP.VENDING]: 2,
      [PROP.SIGNAL]: 4,
      [PROP.DECAL]: 0,
      [PROP.PARKED]: 1,
    };
    for (const kind of Object.values(PROP)) {
      const visual = library.build(tileFor(kind));
      library.update();
      expect(meshes(root), `kind ${kind}`).toHaveLength(expected[kind] ?? 1);
      visual.dispose();
      library.update();
      expect(meshes(root)).toHaveLength(0);
    }
    library.dispose();
  });

  it("uses park lamp strength and signal phase from prop metadata", () => {
    const { library, lamps, root } = createLibrary();
    const park = library.build(tileFor(PROP.LIGHT, 0, 0.8));
    library.update();
    expect(meshes(root)).toHaveLength(2);
    park.dispose();
    library.update();
    const signal = library.build(tileFor(PROP.SIGNAL));
    library.update();
    const lensMeshes = meshes(root).filter((mesh) =>
      mesh.geometry.getAttribute("aLens"),
    );
    expect(lensMeshes).toHaveLength(3);
    for (const mesh of lensMeshes) {
      const attribute = mesh.geometry.getAttribute("aLens");
      expect(attribute.getX(0)).toBeLessThan(3);
      expect(attribute.getY(0)).toBe(0);
    }
    signal.dispose();
    library.dispose();
    lamps.dispose();
  });

  it("batches identical props across tiles and preserves RTC translation", () => {
    const { library, root } = createLibrary();
    const first = tileFor(PROP.LIGHT);
    const second = tileFor(PROP.LIGHT);
    second.rtc[0] = 600;
    const a = library.build(first),
      b = library.build(second);
    library.update();
    const bodies = meshes(root).filter((mesh) => mesh.castShadow);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.count).toBe(2);
    expect(bodies[0]?.instanceMatrix.array[28]).toBe(600);
    a.dispose();
    library.update();
    expect(bodies[0]?.count).toBe(1);
    b.dispose();
    library.dispose();
  });

  it("moves only tree shares when tile LOD changes", () => {
    const { library, root } = createLibrary();
    const visual = library.build(tileFor(PROP.TREE));
    library.update();
    expect(meshes(root).map((mesh) => mesh.count)).toEqual([0, 0, 1]);
    visual.setNear(true);
    library.update();
    expect(meshes(root).map((mesh) => mesh.count)).toEqual([1, 1, 0]);
    visual.dispose();
    library.dispose();
  });
});
