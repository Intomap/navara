//! TKY1 wire-format enum values shared by decoding and meshing.
//! Keep these numbers identical to `tokyo/src/shared/tileformat.js`; the tile format is
//! little-endian and versioned, and any drift here silently reclassifies city geometry.

pub mod area {
    pub const ROAD: u8 = 0;
    pub const CARRIAGEWAY: u8 = 1;
    pub const SIDEWALK: u8 = 2;
    pub const ISLAND: u8 = 3;
    pub const OTHER: u8 = 4;
    pub const PARK: u8 = 5;
    pub const WOOD: u8 = 6;
    pub const WATER: u8 = 7;
    pub const PITCH: u8 = 8;
    pub const MARK_WHITE: u8 = 9;
    pub const MARK_YELLOW: u8 = 10;
    pub const PATH: u8 = 11;
    pub const STEPS: u8 = 12;
    pub const PARKING: u8 = 13;
    pub const TACTILE: u8 = 14;
    pub const POOL: u8 = 15;
    pub const PLAZA: u8 = 16;
}

pub mod sport {
    pub const OTHER: u16 = 0;
    pub const TENNIS: u16 = 1;
    pub const TURF: u16 = 2;
    pub const DIRT: u16 = 3;
}

pub mod ground {
    pub const ASPHALT: f32 = 0.0;
    pub const PAVERS: f32 = 1.0;
    pub const GRASS: f32 = 2.0;
    pub const CONCRETE: f32 = 3.0;
    pub const WATER: f32 = 4.0;
}

pub mod barrier {
    pub const FENCE: f32 = 2.0;
    pub const WALL: f32 = 3.0;
    pub const RETAINING: f32 = 4.0;
    pub const HEDGE: f32 = 5.0;
    pub const GUARD_RAIL: f32 = 6.0;
}

pub mod prop {
    pub const TREE: u8 = 0;
    pub const POLE: u8 = 1;
    pub const LIGHT: u8 = 2;
    pub const VENDING: u8 = 3;
    pub const SIGNAL: u8 = 4;
    pub const DECAL: u8 = 5;
    pub const BUS_STOP: u8 = 6;
    pub const BENCH: u8 = 7;
    pub const BOLLARD: u8 = 8;
    pub const POST_BOX: u8 = 9;
    pub const PHONE: u8 = 10;
    pub const SUBWAY: u8 = 11;
    pub const STATUE: u8 = 12;
    pub const BIKES: u8 = 13;
    pub const SHRINE: u8 = 14;
    pub const PARKED: u8 = 15;
    pub const HYDRANT: u8 = 16;
    pub const INFO: u8 = 17;
    pub const TABLE: u8 = 18;
    pub const PLAY: u8 = 19;
    pub const TORII: u8 = 20;
    pub const RAIL_CROSSING: u8 = 21;
}

pub mod decal {
    pub const THROUGH: u8 = 0;
    pub const LEFT: u8 = 1;
    pub const RIGHT: u8 = 2;
    pub const THROUGH_LEFT: u8 = 3;
    pub const THROUGH_RIGHT: u8 = 4;
    pub const STOP: u8 = 5;
    pub const SPEED_20: u8 = 6;
    pub const SPEED_30: u8 = 7;
    pub const SPEED_40: u8 = 8;
    pub const SPEED_50: u8 = 9;
    pub const SPEED_60: u8 = 10;
}
