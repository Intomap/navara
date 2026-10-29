import type { MeshConfig, MeshUpdate } from "@navaramap/three";

export type CityManifestTile = {
  x: number;
  z: number;
  file: string;
  mesh?: string;
  walls?: string;
  atlas?: string;
};

export type CityDeck = {
  pts: number[];
  half: number;
};

export type CityManifest = {
  format: number;
  name: string;
  origin: { lon: number; lat: number };
  tileSize: number;
  terrain: {
    file: string;
    x0: number;
    z0: number;
    step: number;
    w: number;
    h: number;
  };
  tiles: CityManifestTile[];
  bounds?: { minX: number; minZ: number; maxX: number; maxZ: number };
  roads?: string;
  rails?: string;
  structures?: string;
  shells?: boolean;
  gauge?: number;
  /** Older city exports write the flag as the string "True". */
  sea?: boolean | string;
  decks?: CityDeck[];
  attribution?: string[];
};

export type CityRoadEdge = {
  a: number;
  b: number;
  pts: number[];
  highway: string;
  lanes: number;
  oneway: number;
  maxspeed: number;
  flyover?: boolean;
  span?: boolean;
  tunnel?: boolean;
};

export type CityRoads = {
  nodes: number[][];
  edges: CityRoadEdge[];
  signals: number[];
};

export type CityFootbridge = {
  pts: number[];
  width: number;
  steps: boolean;
};

export type CityPlatform = {
  ring: [number, number][];
  y: number;
  covered?: boolean;
};

export type CityCanopy = {
  ring: [number, number][];
  y: number;
};

export type CityStructures = {
  footbridges?: CityFootbridge[];
  platforms?: CityPlatform[];
  canopies?: CityCanopy[];
};

export type CityRailLine = {
  name?: string | null;
  railway?: string;
  pts: number[];
  deck?: [number, number][];
  portals?: [number, number, number, number, number, boolean?][];
};

export type CityWaterOptions = {
  amplitude?: number;
  speed?: number;
  distortion?: number;
  reflection?: number;
  roughness?: number;
};

export type CityNightLightOptions = {
  streetLights?: number;
  parkLights?: number;
  headlights?: number;
  windowLight?: number;
  windowSoftness?: number;
  windowSpareRate?: number;
  windowSparePace?: number;
  nightCityGlass?: number;
  blueLights?: number;
};

export type CityOptions = {
  url: string;
  radius?: number;
  concurrency?: number;
  /** Tree season: 0 summer, 1 autumn, 2 spring (cherry blossom). */
  season?: number;
  ortho?: boolean;
  night?: number;
  quality?: "low" | "high";
  traffic?: boolean;
  cars?: number;
  trains?: boolean;
  birds?: number;
  mirror?: boolean;
  water?: CityWaterOptions;
  nightLights?: CityNightLightOptions;
  onStats?: (stats: CityStats) => void;
};

export type CityDescription = {
  city?: CityOptions;
};

export type CityConfig = MeshConfig & CityDescription;
export type CityUpdate = MeshUpdate & CityDescription;

export type CityRenderStats = {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  /** Cumulative draw calls / triangles of the water-mirror re-render pass. */
  mirrorCalls: number;
  mirrorTriangles: number;
  /** Cumulative draw calls / triangles of the night lamp-light map pass. */
  lampCalls: number;
  lampTriangles: number;
};

export type CityStats = {
  loaded: number;
  pending: number;
  total: number;
  bytes: number;
  state: "loading" | "ready" | "error";
  message?: string;
};

export type CityTileKey = {
  tx: number;
  tz: number;
  key: string;
};
