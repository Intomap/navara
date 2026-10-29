use crate::{
    buffers::{MeshBuffers, srgb_to_linear},
    constants::{area, barrier, ground},
    format::Tile,
    meshing::{HeightGrid, decks},
};

type Rgb = [f32; 3];
type BarrierStyle = (f32, f32, Rgb, f32);

const DRAPE_EDGE: f32 = 6.0;
const KERB_FOOT: f32 = 0.03;
const KERB_COLOR: Rgb = [0.68, 0.68, 0.66];

fn barrier_style(kind: f32) -> BarrierStyle {
    let (height, width, rgb, layer) = match kind {
        barrier::FENCE => (1.3, 0.0, [0.5, 0.52, 0.53], ground::CONCRETE),
        barrier::WALL => (1.8, 0.2, [0.72, 0.71, 0.68], ground::CONCRETE),
        barrier::RETAINING => (2.2, 0.3, [0.6, 0.6, 0.58], ground::CONCRETE),
        barrier::HEDGE => (1.3, 0.8, [0.22, 0.36, 0.17], ground::GRASS),
        barrier::GUARD_RAIL => (0.8, 0.0, [0.86, 0.86, 0.84], ground::CONCRETE),
        _ => (1.3, 0.0, [0.5, 0.52, 0.53], ground::CONCRETE),
    };
    (height, width, rgb.map(srgb_to_linear), layer)
}

fn barrier(
    mesh: &mut MeshBuffers,
    grid: &HeightGrid<'_>,
    bridge_decks: &[decks::Deck],
    [x0, z0, x1, z1]: [f32; 4],
    kind: f32,
) {
    let length = ((x1 - x0).powi(2) + (z1 - z0).powi(2)).sqrt();
    if length > DRAPE_EDGE {
        let (mx, mz) = ((x0 + x1) / 2.0, (z0 + z1) / 2.0);
        barrier(mesh, grid, bridge_decks, [x0, z0, mx, mz], kind);
        barrier(mesh, grid, bridge_decks, [mx, mz, x1, z1], kind);
        return;
    }
    let (height, width, color, layer) = barrier_style(kind);
    let length = length.max(1e-8);
    let (nx, nz) = (-(z1 - z0) / length, (x1 - x0) / length);
    let face = |mesh: &mut MeshBuffers, offset: f32, sign: f32| {
        let (ax, az) = (x0 + nx * offset, z0 + nz * offset);
        let (bx, bz) = (x1 + nx * offset, z1 + nz * offset);
        let (ya, yb) = (
            decks::surface(grid, bridge_decks, x0, z0),
            decks::surface(grid, bridge_decks, x1, z1),
        );
        let a = [ax, ya - 0.2, az];
        let b = [bx, yb - 0.2, bz];
        let c = [bx, yb + height, bz];
        let d = [ax, ya + height, az];
        let quad = if sign > 0.0 {
            [a, b, c, a, c, d]
        } else {
            [b, a, d, b, d, c]
        };
        for point in quad {
            mesh.vertex(point, [nx * sign, 0.0, nz * sign], color, layer);
        }
        (d, c)
    };
    let (d1, c1) = face(mesh, width / 2.0, 1.0);
    let (d2, c2) = face(mesh, -width / 2.0, -1.0);
    if width > 0.0 {
        for point in [d2, c2, c1, d2, c1, d1] {
            mesh.vertex(point, [0.0, 1.0, 0.0], color, layer);
        }
    }
}

fn kerb(
    mesh: &mut MeshBuffers,
    grid: &HeightGrid<'_>,
    bridge_decks: &[decks::Deck],
    [x0, z0, x1, z1]: [f32; 4],
    lift: f32,
) {
    let length = ((x1 - x0).powi(2) + (z1 - z0).powi(2)).sqrt();
    if length < 1e-8 {
        return;
    }
    let (nx, nz) = (-(z1 - z0) / length, (x1 - x0) / length);
    let (ya, yb) = (
        decks::surface(grid, bridge_decks, x0, z0),
        decks::surface(grid, bridge_decks, x1, z1),
    );
    let quad = [
        [x0, ya + KERB_FOOT, z0],
        [x1, yb + KERB_FOOT, z1],
        [x1, yb + lift, z1],
        [x0, ya + KERB_FOOT, z0],
        [x1, yb + lift, z1],
        [x0, ya + lift, z0],
    ];
    for point in quad {
        mesh.vertex(
            point,
            [nx, 0.0, nz],
            KERB_COLOR.map(srgb_to_linear),
            ground::CONCRETE,
        );
    }
}

fn area_lift(kind: u8) -> Option<f32> {
    match kind {
        area::SIDEWALK => Some(0.2),
        area::ISLAND => Some(0.22),
        _ => None,
    }
}

pub fn build(tile: &Tile, grid: HeightGrid<'_>, bridge_decks: &[decks::Deck]) -> MeshBuffers {
    let mut mesh = MeshBuffers::default();
    for wall in &tile.walls {
        barrier(
            &mut mesh,
            &grid,
            bridge_decks,
            [wall[0], wall[1], wall[2], wall[3]],
            wall[4],
        );
    }
    for area in &tile.areas {
        let Some(lift) = area_lift(area.kind) else {
            continue;
        };
        for polygon in &area.polygons {
            for ring in polygon {
                for (index, point) in ring.iter().enumerate() {
                    let next = &ring[(index + 1) % ring.len()];
                    kerb(
                        &mut mesh,
                        &grid,
                        bridge_decks,
                        [point.x, point.z, next.x, next.z],
                        lift,
                    );
                }
            }
        }
    }
    mesh
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::format::Point2;

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
    fn walls_and_kerbs_are_not_empty() {
        let data = vec![0.0; 16];
        let tile = Tile {
            walls: vec![[10.0, 10.0, 14.0, 10.0, barrier::HEDGE]],
            areas: vec![crate::format::Area {
                kind: area::SIDEWALK,
                code: 0,
                polygons: vec![vec![vec![
                    Point2 { x: 20.0, z: 20.0 },
                    Point2 { x: 26.0, z: 20.0 },
                    Point2 { x: 26.0, z: 26.0 },
                ]]],
            }],
            ..Tile::default()
        };
        let mesh = build(&tile, grid(&data), &[]);
        assert!(mesh.position.len() >= 36);
        assert!(mesh.layer.contains(&ground::GRASS));
        assert!(mesh.layer.contains(&ground::CONCRETE));
    }
}
