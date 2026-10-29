import {
  queueTask,
  type CityMeshData,
  type CityTileData,
} from "@navaramap/worker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CityStreamer } from "../runtime/CityStreamer";
import type { CityManifest, CityStats, CityTileKey } from "../types";

vi.mock("@navaramap/worker", () => ({ queueTask: vi.fn() }));

const emptyMesh = (): CityMeshData => ({
  position: new Float32Array(),
  local: new Float32Array(),
  normal: new Float32Array(),
  color: new Float32Array(),
  layer: new Float32Array(),
  light: new Float32Array(),
  facade: new Float32Array(),
  building: new Float32Array(),
  photo: new Float32Array(),
  uv: new Float32Array(),
  index: new Uint32Array(),
});
const tileResult = (): CityTileData => ({
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
  propMatrices: new Float32Array(),
  propMetadata: new Float32Array(),
  treeCount: 0,
  signs: [],
});
const manifest: CityManifest = {
  format: 7,
  name: "test",
  origin: { lon: 114.17, lat: 22.28 },
  tileSize: 256,
  terrain: { file: "terrain.bin", x0: 0, z0: 0, step: 5, w: 2, h: 2 },
  tiles: [
    { x: 0, z: 0, file: "t_0_0.bin" },
    { x: 1, z: 0, file: "t_1_0.bin" },
  ],
};

describe("CityStreamer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(8))),
    );
    vi.mocked(queueTask).mockResolvedValue({ result: tileResult() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the nearest tile first", async () => {
    const loaded: CityTileKey[] = [];
    const streamer = new CityStreamer(
      manifest,
      new Uint8Array(16),
      "/city",
      {
        onLoad: (tile) => loaded.push(tile),
        onUnload: () => {},
        onStats: () => {},
      },
      600,
      1,
    );
    streamer.update({ x: 500, z: 128 });
    await vi.waitFor(() => expect(loaded.length).toBeGreaterThan(0));
    expect(loaded[0].key).toBe("1_0");
    streamer.dispose();
  });

  it("unloads beyond the radius plus hysteresis", async () => {
    const unloaded: string[] = [];
    const streamer = new CityStreamer(
      manifest,
      new Uint8Array(16),
      "/city",
      {
        onLoad: () => {},
        onUnload: (key) => unloaded.push(key),
        onStats: () => {},
      },
      300,
      1,
    );
    streamer.update({ x: 128, z: 128 });
    await vi.waitFor(() => expect(vi.mocked(queueTask)).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    streamer.update({ x: 2000, z: 2000 }, 0);
    expect(unloaded).toContain("0_0");
    streamer.dispose();
  });

  it("cancels out-of-radius work and rejects stale worker results", async () => {
    const resolvers: ((value: { result: CityTileData }) => void)[] = [];
    vi.mocked(queueTask).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }) as ReturnType<typeof queueTask>,
    );
    const loaded: CityTileKey[] = [];
    const streamer = new CityStreamer(
      manifest,
      new Uint8Array(16),
      "/city",
      {
        onLoad: (tile) => loaded.push(tile),
        onUnload: () => {},
        onStats: () => {},
      },
      300,
      1,
    );
    streamer.update({ x: 128, z: 128 });
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));
    streamer.update({ x: 2000, z: 2000 }, 0);
    streamer.update({ x: 128, z: 128 });
    resolvers[0]({ result: tileResult() });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    expect(loaded).toHaveLength(0);
    resolvers[1]({ result: tileResult() });
    await vi.waitFor(() => expect(loaded).toHaveLength(1));
    expect(loaded[0].key).toBe("0_0");
    streamer.dispose();
  });

  it("uses deck levels for surface and cover height queries", () => {
    const streamer = new CityStreamer(
      {
        ...manifest,
        decks: [{ pts: [0, 10, 0, 0, 10, 20], half: 20 }],
      },
      new Uint8Array(16),
      "/city",
      {
        onLoad: () => {},
        onUnload: () => {},
        onStats: () => {},
      },
    );
    expect(streamer.surface(0, 10)).toBeCloseTo(10);
    expect(streamer.surface(5.5, 10)).toBeGreaterThan(9);
    expect(streamer.surface(40, 10)).toBeCloseTo(0);
    expect(streamer.cover(0, 10)).toBeCloseTo(10);
    expect(streamer.cover(15, 10)).toBeCloseTo(0);
    streamer.dispose();
  });

  it("drops worker results that arrive after disposal", async () => {
    let resolveTask: ((value: { result: CityTileData }) => void) | undefined;
    vi.mocked(queueTask).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        }) as ReturnType<typeof queueTask>,
    );
    const loaded: CityTileKey[] = [];
    const errors: CityStats[] = [];
    const streamer = new CityStreamer(manifest, new Uint8Array(16), "/city", {
      onLoad: (tile) => loaded.push(tile),
      onUnload: () => {},
      onStats: (stats) => errors.push(stats),
    });
    streamer.update({ x: 128, z: 128 });
    await vi.waitFor(() => expect(vi.mocked(queueTask)).toHaveBeenCalled());
    streamer.dispose();
    resolveTask?.({ result: tileResult() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loaded).toHaveLength(0);
    expect(errors.some((stats) => stats.state === "error")).toBe(false);
  });
});
