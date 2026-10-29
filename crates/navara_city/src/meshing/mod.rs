mod barriers;
mod buildings;
mod decals;
pub mod decks;
mod ground;
mod lamplight;
mod prefab;
mod terrain;
mod wires;

use serde::Serialize;

use crate::{
    buffers::{CitySign, CityTileBuffers},
    constants::prop,
    format::{Prefab, Result, Tile, decode_prefab, decode_tile},
    projection::{RtcCenter, local_normal_to_ecef},
};

#[derive(Debug, Clone, Copy)]
pub struct HeightGrid<'a> {
    pub x0: f32,
    pub z0: f32,
    pub step: f32,
    pub width: usize,
    pub height: usize,
    pub data: &'a [f32],
}

impl HeightGrid<'_> {
    pub fn sample(&self, x: f32, z: f32) -> f32 {
        let fx = ((x - self.x0) / self.step).clamp(0.0, self.width as f32 - 1.001);
        let fz = ((z - self.z0) / self.step).clamp(0.0, self.height as f32 - 1.001);
        let (i, j) = (fx.floor() as usize, fz.floor() as usize);
        let (tx, tz) = (fx - i as f32, fz - j as f32);
        let at = |col, row| self.data[row * self.width + col];
        (at(i, j) * (1.0 - tx) + at(i + 1, j) * tx) * (1.0 - tz)
            + (at(i, j + 1) * (1.0 - tx) + at(i + 1, j + 1) * tx) * tz
    }

    pub fn normal(&self, x: f32, z: f32) -> [f32; 3] {
        let e = self.step;
        let dx = (self.sample(x + e, z) - self.sample(x - e, z)) / (2.0 * e);
        let dz = (self.sample(x, z + e) - self.sample(x, z - e)) / (2.0 * e);
        let length = (dx * dx + 1.0 + dz * dz).sqrt();
        [-dx / length, 1.0 / length, -dz / length]
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct GridConfig {
    pub x0: f32,
    pub z0: f32,
    pub step: f32,
    pub width: u32,
    pub height: u32,
}

/// Minimum triangle area (m²) kept in the distant LOD; smaller triangles are
/// far below a pixel at the LOD switch distance and are dropped.
const LOD1_MIN_AREA: f32 = 0.5;

pub fn build_tile(
    tile_bytes: &[u8],
    prefab_bytes: Option<&[u8]>,
    grid: HeightGrid<'_>,
    decks: &[decks::Deck],
) -> Result<CityTileBuffers> {
    let tile = decode_tile(tile_bytes)?;
    let prefab = prefab_bytes.map(decode_prefab).transpose()?;
    Ok(build_decoded_tile(&tile, prefab.as_ref(), grid, decks))
}

pub fn build_decoded_tile(
    tile: &Tile,
    prefab: Option<&Prefab>,
    grid: HeightGrid<'_>,
    decks: &[decks::Deck],
) -> CityTileBuffers {
    let center = RtcCenter::for_tile(tile.tx, tile.tz);
    let (ground, paint) = ground::build(&tile.areas, grid, 256.0, decks);
    let buildings = buildings::build(&tile.buildings, tile.tx, tile.tz);
    let photo = buildings::photo_mesh(&buildings);
    let mut output = CityTileBuffers {
        rtc: center.ecef,
        terrain: terrain::build(grid, tile.tx, tile.tz, 256.0),
        ground,
        paint,
        buildings,
        photo,
        prefab: prefab.map(prefab::build).unwrap_or_default(),
        decals: decals::build(tile, grid, decks),
        walls: barriers::build(tile, grid, decks),
        wires: wires::build(tile, grid, decks, &center),
        ..CityTileBuffers::default()
    };
    let lamps = lamplight::LampGrid::build(tile);
    for mesh in [
        &mut output.terrain,
        &mut output.ground,
        &mut output.paint,
        &mut output.decals,
        &mut output.buildings,
        &mut output.photo,
        &mut output.prefab,
        &mut output.walls,
    ] {
        lamps.apply(mesh);
    }
    output.terrain.project(&center);
    output.ground.project(&center);
    output.paint.project(&center);
    output.decals.project(&center);
    output.buildings.project(&center);
    output.photo.project(&center);
    output.prefab.project(&center);
    output.walls.project(&center);
    // Index every mesh by welding shared vertices (lossless), then keep a
    // decimated copy of the two heavy shadow-casting meshes for the far LOD.
    for mesh in [
        &mut output.terrain,
        &mut output.ground,
        &mut output.paint,
        &mut output.decals,
        &mut output.buildings,
        &mut output.photo,
        &mut output.prefab,
        &mut output.walls,
    ] {
        mesh.weld();
    }
    output.buildings_lod1 = output.buildings.thin(LOD1_MIN_AREA);
    output.prefab_lod1 = output.prefab.thin(LOD1_MIN_AREA);
    build_props(tile, grid, decks, &center, &mut output);
    output.tree_count = tile
        .props
        .iter()
        .filter(|prop| prop.kind == prop::TREE && prop.variant % 6 <= 3)
        .count() as u32;
    build_signs(tile, &center, &mut output);
    output
}

fn prop_rand(prop: &crate::format::Prop, copy: u32, channel: u32) -> f64 {
    let h = (prop.x as f64 * 12.9898
        + prop.z as f64 * 78.233
        + copy as f64 * 37.719
        + channel as f64 * 11.13)
        .sin()
        * 43758.5453;
    h.fract()
}

fn build_props(
    tile: &Tile,
    grid: HeightGrid<'_>,
    decks: &[decks::Deck],
    center: &RtcCenter,
    output: &mut CityTileBuffers,
) {
    for prop in &tile.props {
        let copies = if prop.kind == prop::TREE && matches!(prop.variant % 6, 2 | 3) {
            3
        } else {
            1
        };
        for copy in 0..copies {
            let away = if copy > 0 {
                3.0 + 3.5 * prop_rand(prop, copy, 1)
            } else {
                0.0
            };
            let turn = prop_rand(prop, copy, 2) * std::f64::consts::TAU;
            let size = if copy > 0 {
                0.7 + 0.35 * prop_rand(prop, copy, 3)
            } else {
                1.0
            };
            let x = prop.x as f64 + turn.cos() * away;
            let z = prop.z as f64 + turn.sin() * away;
            let point = center.project([
                x,
                decks::surface(&grid, decks, x as f32, z as f32) as f64,
                z,
            ]);
            let g = point.geographic;
            let (slon, clon) = g.longitude.sin_cos();
            let (slat, clat) = g.latitude.sin_cos();
            let east = [-slon, clon, 0.0];
            let north = [-slat * clon, -slat * slon, clat];
            let up = [clat * clon, clat * slon, slat];
            let (sin, cos) = (prop.rotation as f64 + copy as f64 * 2.1).sin_cos();
            let scale = prop.scale as f64 * size;
            let x_axis = [
                east[0] * cos + north[0] * sin,
                east[1] * cos + north[1] * sin,
                east[2] * cos + north[2] * sin,
            ];
            let z_axis = [
                east[0] * sin - north[0] * cos,
                east[1] * sin - north[1] * cos,
                east[2] * sin - north[2] * cos,
            ];
            for axis in [x_axis, up, z_axis] {
                output.prop_matrices.extend_from_slice(&[
                    (axis[0] * scale) as f32,
                    (axis[1] * scale) as f32,
                    (axis[2] * scale) as f32,
                    0.0,
                ]);
            }
            output.prop_matrices.extend_from_slice(&[
                point.position[0],
                point.position[1],
                point.position[2],
                1.0,
            ]);
            output.prop_metadata.extend_from_slice(&[
                prop.kind as f32,
                prop.variant as f32,
                prop.rotation,
                prop.scale,
            ]);
        }
    }
}

fn build_signs(tile: &Tile, center: &RtcCenter, output: &mut CityTileBuffers) {
    for sign in &tile.signs {
        let point = center.project([sign.x as f64, sign.y as f64, sign.z as f64]);
        output.signs.push(CitySign {
            position: point.position,
            normal: local_normal_to_ecef([sign.nx as f64, 0.0, sign.nz as f64], point.geographic),
            width: sign.width,
            height: sign.height,
            style: sign.style,
            color: sign.color,
            text: sign.text.clone(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_sampling_matches_bilinear_reference() {
        let data = (0..16)
            .map(|i| (i % 4 + i / 4) as f32 * 5.0)
            .collect::<Vec<_>>();
        let grid = HeightGrid {
            x0: 0.0,
            z0: 0.0,
            step: 5.0,
            width: 4,
            height: 4,
            data: &data,
        };
        assert_eq!(grid.sample(5.0, 5.0), 10.0);
        let normal = grid.normal(5.0, 5.0);
        let expected = 1.0 / 3.0_f32.sqrt();
        assert!((normal[0] + expected).abs() < 1e-4);
        assert!((normal[1] - expected).abs() < 1e-4);
        assert!((normal[2] + expected).abs() < 1e-4);
    }

    #[test]
    fn park_tree_clumps_are_deterministic_and_shared_by_lod() {
        let tile = Tile {
            props: vec![
                crate::format::Prop {
                    kind: 0,
                    variant: 2,
                    scale: 1.0,
                    ..Default::default()
                },
                crate::format::Prop {
                    kind: 0,
                    variant: 1,
                    x: 20.0,
                    scale: 1.0,
                    ..Default::default()
                },
            ],
            ..Tile::default()
        };
        let data = [0.0; 4];
        let grid = HeightGrid {
            x0: 0.0,
            z0: 0.0,
            step: 5.0,
            width: 2,
            height: 2,
            data: &data,
        };
        let output = build_decoded_tile(&tile, None, grid, &[]);
        let again = build_decoded_tile(&tile, None, grid, &[]);
        assert_eq!(output.prop_metadata.len(), 16);
        assert_eq!(output.prop_matrices.len(), 64);
        assert_eq!(output.tree_count, 2);
        assert_eq!(output.prop_matrices, again.prop_matrices);
        assert_eq!(output.prop_metadata, again.prop_metadata);
    }
}
