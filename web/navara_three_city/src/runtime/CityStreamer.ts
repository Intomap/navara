import { queueTask, type CityTileData } from "@navaramap/worker";

import type {
  CityManifest,
  CityManifestTile,
  CityStats,
  CityTileKey,
} from "../types";

import { CityDecks } from "./decks";

type CityStreamerEvents = {
  onLoad: (tile: CityTileKey, data: CityTileData) => void;
  onUnload: (key: string) => void;
  onStats: (stats: CityStats) => void;
};

type TileState = {
  tile: CityManifestTile;
  key: string;
  status: "queued" | "loading" | "loaded" | "error";
  generation: number;
  controller?: AbortController;
  bytes: number;
};

export type CityFocus = {
  x: number;
  z: number;
};

const keyOf = (tile: CityManifestTile) => `${tile.x}_${tile.z}`;
const bufferBytes = (data: CityTileData): number => {
  const meshes = [
    data.terrain,
    data.ground,
    data.paint,
    data.decals,
    data.buildings,
    data.prefab,
    data.photo,
    data.walls,
  ];
  return (
    [data.rtc, data.propMatrices, data.propMetadata, data.wires].reduce(
      (sum, array) => sum + array.byteLength,
      0,
    ) +
    meshes.reduce(
      (total, mesh) =>
        total +
        Object.values(mesh).reduce((sum, array) => sum + array.byteLength, 0),
      0,
    )
  );
};

export class CityStreamer {
  private states = new Map<string, TileState>();
  private terrain: Uint8Array;
  private heights: Float32Array;
  private generation = 0;
  private active = 0;
  private focus: CityFocus = { x: 0, z: 0 };
  private radius: number;
  private decks: CityDecks;
  private decksJson: string;
  private disposed = false;

  constructor(
    private manifest: CityManifest,
    terrain: Uint8Array,
    private baseUrl: string,
    private events: CityStreamerEvents,
    radius = 1100,
    private concurrency = 4,
  ) {
    this.terrain = terrain;
    this.decks = new CityDecks(manifest.decks ?? []);
    this.decksJson = JSON.stringify(manifest.decks ?? []);
    this.heights = new Float32Array(
      terrain.buffer.slice(
        terrain.byteOffset,
        terrain.byteOffset + terrain.byteLength,
      ),
    );
    this.radius = radius;
  }

  ground(x: number, z: number): number {
    const grid = this.manifest.terrain;
    const fx = Math.min(grid.w - 1.001, Math.max(0, (x - grid.x0) / grid.step));
    const fz = Math.min(grid.h - 1.001, Math.max(0, (z - grid.z0) / grid.step));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const at = (column: number, row: number) =>
      this.heights[row * grid.w + column];
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return top * (1 - tz) + bottom * tz;
  }

  surface(x: number, z: number): number {
    return this.decks.surface(this.ground(x, z), x, z);
  }

  cover(x: number, z: number): number {
    return this.decks.cover(this.ground(x, z), x, z);
  }

  update(
    focus: CityFocus,
    radius = this.radius,
    concurrency = this.concurrency,
  ): void {
    if (this.disposed) return;
    this.focus = focus;
    this.radius = radius;
    this.concurrency = Math.max(1, Math.round(concurrency));
    const hysteresis = 180 + this.manifest.tileSize * Math.SQRT1_2;
    for (const state of this.states.values()) {
      if (this.distance(state.tile) > radius + hysteresis)
        this.unload(state.key);
    }
    this.pump();
  }

  private distance(tile: CityManifestTile): number {
    const size = this.manifest.tileSize;
    return Math.hypot(
      (tile.x + 0.5) * size - this.focus.x,
      (tile.z + 0.5) * size - this.focus.z,
    );
  }

  private pump(): void {
    if (this.disposed) return;
    const limit = this.radius + this.manifest.tileSize * Math.SQRT1_2;
    for (const tile of this.manifest.tiles) {
      const key = keyOf(tile);
      if (!this.states.has(key) && this.distance(tile) <= limit) {
        this.states.set(key, {
          tile,
          key,
          status: "queued",
          generation: this.generation,
          bytes: 0,
        });
      }
    }
    const queued = [...this.states.values()]
      .filter((state) => state.status === "queued")
      .sort((a, b) => this.distance(a.tile) - this.distance(b.tile));
    while (this.active < this.concurrency && queued.length > 0) {
      const state = queued.shift();
      if (state) void this.load(state);
    }
    this.emitStats("ready");
  }

  private async load(state: TileState): Promise<void> {
    state.status = "loading";
    state.controller = new AbortController();
    this.active += 1;
    this.emitStats("loading");
    let failure: string | undefined;
    try {
      const { tile, generation, controller } = state;
      const [tileBytes, prefabBytes] = await Promise.all([
        this.fetchBytes(`${this.baseUrl}/${tile.file}`, controller?.signal),
        tile.mesh
          ? this.fetchBytes(`${this.baseUrl}/${tile.mesh}`, controller?.signal)
          : Promise.resolve(undefined),
      ]);
      if (!this.isCurrent(state, generation)) return;
      const response = await queueTask("constructCityTile", [
        tileBytes,
        prefabBytes,
        this.terrain,
        {
          x0: this.manifest.terrain.x0,
          z0: this.manifest.terrain.z0,
          step: this.manifest.terrain.step,
          width: this.manifest.terrain.w,
          height: this.manifest.terrain.h,
        },
        this.decksJson,
      ]);
      if (!this.isCurrent(state, generation)) return;
      state.bytes = bufferBytes(response.result);
      state.status = "loaded";
      this.events.onLoad(
        { tx: tile.x, tz: tile.z, key: state.key },
        response.result,
      );
    } catch (error) {
      if (!this.disposed && !state.controller?.signal.aborted) {
        state.status = "error";
        failure = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.active -= 1;
      state.controller = undefined;
      if (!this.disposed) this.pump();
      if (failure) {
        this.events.onStats({
          ...this.snapshot(),
          state: "error",
          message: failure,
        });
      }
    }
  }

  private async fetchBytes(
    url: string,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const response = await fetch(url, { signal });
    if (!response.ok)
      throw new Error(`City request failed (${response.status}): ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private isCurrent(state: TileState, generation: number): boolean {
    return (
      !this.disposed &&
      this.states.get(state.key) === state &&
      generation === this.generation
    );
  }

  private unload(key: string): void {
    const state = this.states.get(key);
    if (!state) return;
    state.controller?.abort();
    this.states.delete(key);
    if (state.status === "loaded") this.events.onUnload(key);
  }

  private snapshot(): CityStats {
    const states = [...this.states.values()];
    return {
      loaded: states.filter((state) => state.status === "loaded").length,
      pending: states.filter((state) => state.status !== "loaded").length,
      total: this.manifest.tiles.length,
      bytes: states.reduce((sum, state) => sum + state.bytes, 0),
      state: "ready",
    };
  }

  private emitStats(state: CityStats["state"]): void {
    this.events.onStats({ ...this.snapshot(), state });
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    for (const key of [...this.states.keys()]) this.unload(key);
    this.states.clear();
  }
}
