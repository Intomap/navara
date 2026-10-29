import { DoubleSide, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { buildFlyovers } from "../runtime/flyovers";
import { CityRtcFrame } from "../runtime/rtc";
import { buildStructures } from "../runtime/structures";
import type { CityRoads, CityStructures } from "../types";

const ground = () => 0;
const rtc = new CityRtcFrame();

describe("city bridge structures", () => {
  it("builds footbridges, platforms and canopies", () => {
    const structures: CityStructures = {
      footbridges: [{ pts: [0, 10, 0, 30, 10, 0], width: 2.2, steps: false }],
      platforms: [
        {
          ring: [
            [0, 0],
            [10, 0],
            [10, 4],
            [0, 4],
          ],
          y: 6,
          covered: true,
        },
      ],
      canopies: [
        {
          ring: [
            [20, 0],
            [26, 0],
            [26, 4],
            [20, 4],
          ],
          y: 5,
        },
      ],
    };
    const mesh = buildStructures(structures, ground, rtc);
    expect(mesh.name).toBe("structures");
    expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect(mesh.material.side).toBe(DoubleSide);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it("builds elevated road decks, barriers and piers", () => {
    const roads: CityRoads = {
      nodes: [
        [0, 10, 0],
        [60, 10, 0],
      ],
      edges: [
        {
          a: 0,
          b: 1,
          pts: [0, 10, 0, 30, 10, 0, 60, 10, 0],
          highway: "motorway",
          lanes: 2,
          oneway: 1,
          maxspeed: 60,
          flyover: true,
        },
      ],
      signals: [],
    };
    const mesh = buildFlyovers(roads, ground, rtc);
    expect(mesh.name).toBe("flyovers");
    expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect(mesh.material.side).toBe(DoubleSide);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
