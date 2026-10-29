/** TKY1 wire-format enum values shared by the Rust and TypeScript city runtimes.
 * Keep these numbers identical to `tokyo/src/shared/tileformat.js` and
 * `crates/navara_city/src/constants.rs`. */

export const AREA = {
  ROAD: 0,
  CARRIAGEWAY: 1,
  SIDEWALK: 2,
  ISLAND: 3,
  OTHER: 4,
  PARK: 5,
  WOOD: 6,
  WATER: 7,
  PITCH: 8,
  MARK_WHITE: 9,
  MARK_YELLOW: 10,
  PATH: 11,
  STEPS: 12,
  PARKING: 13,
  TACTILE: 14,
  POOL: 15,
  PLAZA: 16,
} as const;

export const SPORT = {
  OTHER: 0,
  TENNIS: 1,
  TURF: 2,
  DIRT: 3,
} as const;

export const GROUND = {
  ASPHALT: 0,
  PAVERS: 1,
  GRASS: 2,
  CONCRETE: 3,
  WATER: 4,
} as const;

export const BARRIER = {
  FENCE: 2,
  WALL: 3,
  RETAINING: 4,
  HEDGE: 5,
  GUARD_RAIL: 6,
} as const;

export const PROP = {
  TREE: 0,
  POLE: 1,
  LIGHT: 2,
  VENDING: 3,
  SIGNAL: 4,
  DECAL: 5,
  BUS_STOP: 6,
  BENCH: 7,
  BOLLARD: 8,
  POST_BOX: 9,
  PHONE: 10,
  SUBWAY: 11,
  STATUE: 12,
  BIKES: 13,
  SHRINE: 14,
  PARKED: 15,
  HYDRANT: 16,
  INFO: 17,
  TABLE: 18,
  PLAY: 19,
  TORII: 20,
  RAIL_CROSSING: 21,
} as const;

export const DECAL = {
  THROUGH: 0,
  LEFT: 1,
  RIGHT: 2,
  THROUGH_LEFT: 3,
  THROUGH_RIGHT: 4,
  STOP: 5,
  SPEED_20: 6,
  SPEED_30: 7,
  SPEED_40: 8,
  SPEED_50: 9,
  SPEED_60: 10,
} as const;
