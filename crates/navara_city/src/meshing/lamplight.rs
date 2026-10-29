use crate::{buffers::MeshBuffers, constants::prop, format::Tile};

const CELL: f32 = 2.0;
const SIZE: usize = 129;
const REACH: f32 = 2.6;

pub struct LampGrid {
    origin_x: f32,
    origin_z: f32,
    values: Vec<f32>,
}

impl LampGrid {
    pub fn build(tile: &Tile) -> Self {
        let origin_x = tile.tx as f32 * 256.0;
        let origin_z = tile.tz as f32 * 256.0;
        let mut values = vec![0.0; SIZE * SIZE];
        let edge = (1.0 + REACH * REACH).powf(-1.5);
        for lamp in &tile.props {
            if !matches!(lamp.kind, prop::POLE | prop::LIGHT) {
                continue;
            }
            // Park lamps (a half-size street light, scale < 1) light the ground
            // through the prop pool system with their own `uParkLights` strength,
            // so they must not also add to this street-light field (which is
            // driven by `uStreetLights`). Keeping them out mirrors the Tokyo
            // split between street and park pools.
            if lamp.kind == prop::LIGHT && lamp.scale < 1.0 {
                continue;
            }
            let height = if lamp.kind == prop::POLE { 5.6 } else { 8.5 };
            let strength = if lamp.kind == prop::POLE { 0.3 } else { 1.0 };
            let reach = REACH * height;
            let min_x = ((lamp.x - reach - origin_x) / CELL).floor().max(0.0) as i32;
            let max_x = ((lamp.x + reach - origin_x) / CELL)
                .ceil()
                .min((SIZE - 1) as f32) as i32;
            let min_z = ((lamp.z - reach - origin_z) / CELL).floor().max(0.0) as i32;
            let max_z = ((lamp.z + reach - origin_z) / CELL)
                .ceil()
                .min((SIZE - 1) as f32) as i32;
            for iz in min_z..=max_z {
                for ix in min_x..=max_x {
                    let x = origin_x + ix as f32 * CELL;
                    let z = origin_z + iz as f32 * CELL;
                    let r2 = (x - lamp.x).powi(2) + (z - lamp.z).powi(2);
                    let intensity = (1.0 + r2 / (height * height)).powf(-1.5);
                    values[iz as usize * SIZE + ix as usize] +=
                        strength * ((intensity - edge) / (1.0 - edge)).max(0.0);
                }
            }
        }
        Self {
            origin_x,
            origin_z,
            values,
        }
    }

    fn sample(&self, x: f32, z: f32) -> f32 {
        let gx = ((x - self.origin_x) / CELL).clamp(0.0, (SIZE - 2) as f32);
        let gz = ((z - self.origin_z) / CELL).clamp(0.0, (SIZE - 2) as f32);
        let (ix, iz) = (gx.floor() as usize, gz.floor() as usize);
        let (fx, fz) = (gx.fract(), gz.fract());
        let at = |x, z| self.values[z * SIZE + x];
        let a = at(ix, iz) * (1.0 - fx) + at(ix + 1, iz) * fx;
        let b = at(ix, iz + 1) * (1.0 - fx) + at(ix + 1, iz + 1) * fx;
        a * (1.0 - fz) + b * fz
    }

    pub fn apply(&self, mesh: &mut MeshBuffers) {
        mesh.light.clear();
        mesh.light.reserve(mesh.position.len() / 3);
        for p in mesh.position.as_chunks::<3>().0.iter() {
            let ground = self.sample(p[0], p[2]);
            let height_falloff = 1.0 / (1.0 + p[1].max(0.0) / 40.0);
            mesh.light.push(ground * height_falloff);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{constants::prop, format::Prop};

    #[test]
    fn lamp_grid_has_local_falloff() {
        let tile = Tile {
            props: vec![Prop {
                kind: prop::LIGHT,
                x: 128.0,
                z: 128.0,
                scale: 1.0,
                ..Prop::default()
            }],
            ..Tile::default()
        };
        let grid = LampGrid::build(&tile);
        let center = grid.sample(128.0, 128.0);
        let direct = grid.values[64 * SIZE + 64];
        let maximum = grid.values.iter().copied().fold(0.0_f32, f32::max);
        assert!(
            center > 0.9,
            "lamp center intensity was {center}, direct={direct}, max={maximum}"
        );
        assert!(grid.sample(128.0, 128.0) > grid.sample(138.0, 128.0));
        assert_eq!(grid.sample(200.0, 200.0), 0.0);

        let pole = Tile {
            props: vec![Prop {
                kind: prop::POLE,
                x: 128.0,
                z: 128.0,
                ..Prop::default()
            }],
            ..Tile::default()
        };
        let grid = LampGrid::build(&pole);
        assert!((grid.sample(128.0, 128.0) - 0.3).abs() < 1e-4);
    }

    #[test]
    fn park_lamp_is_excluded_from_street_light_field() {
        let tile = Tile {
            props: vec![Prop {
                kind: prop::LIGHT,
                x: 128.0,
                z: 128.0,
                scale: 0.5,
                ..Prop::default()
            }],
            ..Tile::default()
        };
        let grid = LampGrid::build(&tile);
        assert_eq!(
            grid.sample(128.0, 128.0),
            0.0,
            "park lamps light the ground through their own park pool, not the street field"
        );
    }
}
