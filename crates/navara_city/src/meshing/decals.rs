use crate::{
    buffers::MeshBuffers,
    constants::{decal, ground, prop},
    format::Tile,
    meshing::{HeightGrid, decks},
};

const DECAL_COLS: f32 = 4.0;
const DECAL_ROWS: f32 = 3.0;
const LIFT: f32 = 0.17;

fn size(variant: u8) -> (f32, f32) {
    if variant <= decal::THROUGH_RIGHT {
        (1.7, 5.0)
    } else if variant == decal::STOP {
        (1.6, 5.4)
    } else {
        (2.1, 4.6)
    }
}

fn uv(variant: u8, s: f32, t: f32) -> (f32, f32) {
    let u0 = (variant as f32 % DECAL_COLS) / DECAL_COLS;
    let v1 = 1.0 - (variant as f32 / DECAL_COLS).floor() / DECAL_ROWS;
    (
        (u0 + ((s + 1.0) / 2.0) / DECAL_COLS).clamp(0.0, 1.0),
        (v1 - (1.0 - t) / DECAL_ROWS).clamp(0.0, 1.0),
    )
}

fn emit_quad(
    mesh: &mut MeshBuffers,
    a: [f32; 4],
    b: [f32; 4],
    c: [f32; 4],
    d: [f32; 4],
    grid: &HeightGrid<'_>,
    bridge_decks: &[decks::Deck],
) {
    let vertices = [a, b, c, a, c, d];
    for vertex in vertices {
        let (x, z, u, v) = (vertex[0], vertex[1], vertex[2], vertex[3]);
        mesh.vertex(
            [x, decks::surface(grid, bridge_decks, x, z) + LIFT, z],
            [0.0, 1.0, 0.0],
            [1.0, 1.0, 1.0],
            ground::CONCRETE,
        );
        mesh.uv.extend_from_slice(&[u, v]);
    }
}

pub fn build(tile: &Tile, grid: HeightGrid<'_>, bridge_decks: &[decks::Deck]) -> MeshBuffers {
    let mut mesh = MeshBuffers::default();
    for decal_prop in &tile.props {
        if decal_prop.kind != prop::DECAL {
            continue;
        }
        let (width, length) = size(decal_prop.variant);
        let (dx, dz) = decal_prop.rotation.sin_cos();
        let length_steps = ((length / 2.5).ceil() as usize).max(2);
        let width_steps = 2;
        let mut rows: Vec<Vec<[f32; 4]>> = Vec::with_capacity(length_steps + 1);
        for step_z in 0..=length_steps {
            let t = step_z as f32 / length_steps as f32;
            let mut row = Vec::with_capacity(width_steps + 1);
            for step_x in 0..=width_steps {
                let s = step_x as f32 / width_steps as f32 * 2.0 - 1.0;
                let x = decal_prop.x - dz * s * width / 2.0 + dx * (t - 0.5) * length;
                let z = decal_prop.z + dx * s * width / 2.0 + dz * (t - 0.5) * length;
                let (u, v) = uv(decal_prop.variant, s, t);
                row.push([x, z, u, v]);
            }
            rows.push(row);
        }
        for step_z in 0..length_steps {
            for step_x in 0..width_steps {
                emit_quad(
                    &mut mesh,
                    rows[step_z][step_x],
                    rows[step_z][step_x + 1],
                    rows[step_z + 1][step_x + 1],
                    rows[step_z + 1][step_x],
                    &grid,
                    bridge_decks,
                );
            }
        }
    }
    mesh
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::format::Prop;

    fn grid(data: &[f32]) -> HeightGrid<'_> {
        HeightGrid {
            x0: 0.0,
            z0: 0.0,
            step: 8.0,
            width: 4,
            height: 4,
            data,
        }
    }

    #[test]
    fn speed_decals_are_draped_and_have_atlas_uvs() {
        let data = vec![0.0; 16];
        let tile = Tile {
            props: vec![Prop {
                kind: prop::DECAL,
                variant: decal::SPEED_50,
                rotation: 0.0,
                x: 20.0,
                z: 20.0,
                scale: 1.0,
            }],
            ..Tile::default()
        };
        let mesh = build(&tile, grid(&data), &[]);
        assert!(!mesh.position.is_empty());
        assert_eq!(mesh.uv.len() * 3, mesh.position.len() * 2);
        let outside = mesh
            .uv
            .iter()
            .find(|value| !(0.0..=1.0).contains(*value))
            .copied();
        assert!(outside.is_none(), "decal uv outside atlas: {outside:?}");
        assert!(mesh.position.chunks(3).all(|point| point[1] == LIFT));
    }

    #[test]
    fn non_decals_are_not_emitted() {
        let data = vec![0.0; 16];
        let tile = Tile {
            props: vec![Prop {
                kind: prop::BENCH,
                ..Prop::default()
            }],
            ..Tile::default()
        };
        assert!(build(&tile, grid(&data), &[]).position.is_empty());
    }
}
