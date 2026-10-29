import { Group, InstancedMesh, Mesh, ShaderMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { createCityUniforms } from "../materials/programs";
import { CityBirds } from "../runtime/birds";
import { CityDynamics, type CityDynamicFrame } from "../runtime/dynamics";
import { CityLampLight } from "../runtime/lamplight";
import { CityRtcFrame } from "../runtime/rtc";
import { CityTraffic } from "../runtime/traffic";
import { chainRailLines } from "../runtime/trains";
import type { CityRoads } from "../types";

const FRAME: CityDynamicFrame = {
  dt: 1 / 60,
  time: 10,
  focus: { x: 0, z: -200 },
  viewDistance: 400,
  night: 1,
  quality: "high",
};

describe("city dynamic contracts", () => {
  it("updates active vehicles from road input and clears disabled fleets", () => {
    const roads: CityRoads = {
      nodes: [
        [0, 0],
        [0, -400],
      ],
      edges: [
        {
          a: 0,
          b: 1,
          pts: [0, 0, 0, 0, 0, -400],
          highway: "primary",
          lanes: 2,
          oneway: 1,
          maxspeed: 50,
        },
      ],
      signals: [1],
    };
    const rtc = new CityRtcFrame();
    const uniforms = createCityUniforms();
    const lamps = new CityLampLight(rtc, uniforms);
    const shadow = vi.fn();
    const traffic = new CityTraffic(
      roads,
      () => 0,
      rtc,
      uniforms,
      lamps,
      shadow,
      8,
    );
    traffic.update(FRAME);
    const fleets = traffic.group.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    );
    expect(fleets.reduce((count, mesh) => count + mesh.count, 0)).toBe(8);
    expect(fleets.every((mesh) => mesh.castShadow && mesh.receiveShadow)).toBe(
      true,
    );
    expect(shadow).toHaveBeenCalledOnce();
    traffic.setEnabled(false);
    traffic.update(FRAME);
    expect(fleets.every((mesh) => mesh.count === 0)).toBe(true);
    traffic.dispose();
    lamps.dispose();
  });

  it("keeps bird flight and depth shaders aligned and consumes changing roosts", () => {
    const roostTiles: number[][] = [[0, 12, -60]];
    const birds = new CityBirds(
      createCityUniforms(),
      () => 0,
      () => roostTiles,
      12,
    );
    const mesh = birds.group.children[0];
    expect(mesh).toBeInstanceOf(Mesh);
    if (!(mesh instanceof Mesh)) throw new Error("Bird mesh missing");
    expect(mesh.geometry).toHaveProperty("instanceCount", 12);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.customDepthMaterial).toBeInstanceOf(ShaderMaterial);
    const material = mesh.material as ShaderMaterial;
    const depth = mesh.customDepthMaterial as ShaderMaterial;
    expect(depth.vertexShader).toBe(material.vertexShader);
    expect(depth.uniforms.uFlocks.value).toBe(material.uniforms.uFlocks.value);
    birds.update(FRAME);
    const data = material.uniforms.uFlocks.value.image.data as Float32Array;
    expect(data[3]).toBeGreaterThanOrEqual(0);
    expect(data[3]).toBeLessThanOrEqual(1);
    roostTiles.length = 0;
    expect(() => birds.update({ ...FRAME, dt: 0.1, time: 11 })).not.toThrow();
    birds.setCount(0);
    expect(birds.group.visible).toBe(false);
    birds.setCount(150);
    expect(birds.group.visible).toBe(true);
    expect(mesh.geometry).toHaveProperty("instanceCount", 150);
    expect(() => birds.update({ ...FRAME, dt: 0.1, time: 12 })).not.toThrow();
    birds.setCount(0);
    birds.setCount(200);
    expect(birds.group.visible).toBe(true);
    expect(mesh.geometry).toHaveProperty("instanceCount", 200);
    birds.dispose();
  });

  it("links same-line rail fragments into continuous train paths", () => {
    const paths = chainRailLines([
      { name: "Tuen Ma line", pts: [0, 0, 0, 0, 0, -200] },
      { name: "Tuen Ma line", pts: [0, 0, -200, 0, 0, -400] },
      { name: "Other line", pts: [50, 0, 0, 50, 0, -300] },
    ]);
    expect(paths).toHaveLength(2);
    expect(paths[0].name).toBe("Tuen Ma line");
    expect(paths[0].length).toBe(400);
    expect(paths[0].pts).toHaveLength(3);
  });

  it("owns dynamic groups and disposes every registered system once", () => {
    const dynamics = new CityDynamics(new CityRtcFrame());
    const group = new Group();
    const update = vi.fn();
    const dispose = vi.fn();
    dynamics.add({ group, update, dispose });
    expect(dynamics.root.children).toContain(group);
    dynamics.update(1000, FRAME.focus, 400, 1, "high");
    dynamics.update(1016, FRAME.focus, 400, 1, "high");
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1][0].dt).toBeCloseTo(0.016);
    dynamics.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(dynamics.root.children).toHaveLength(0);
  });
});
