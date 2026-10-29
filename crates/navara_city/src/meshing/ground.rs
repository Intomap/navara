use crate::{
    buffers::{MeshBuffers, srgb_to_linear},
    constants::{area, ground, sport},
    format::{Area, Point2},
    meshing::{HeightGrid, decks},
};

type GroundStyle = ([f32; 3], f32, f32);

fn style(area: &Area) -> GroundStyle {
    let (rgb, lift, layer) = match (area.kind, area.code) {
        (area::ROAD, _) => ([0.4, 0.4, 0.41], 0.04, ground::ASPHALT),
        (area::CARRIAGEWAY, _) => ([0.36, 0.36, 0.38], 0.06, ground::ASPHALT),
        (area::SIDEWALK, _) => ([0.63, 0.61, 0.58], 0.2, ground::PAVERS),
        (area::ISLAND, _) => ([0.36, 0.47, 0.27], 0.22, ground::GRASS),
        (area::OTHER, _) => ([0.45, 0.45, 0.45], 0.05, ground::CONCRETE),
        (area::PARK, _) => ([0.4, 0.5, 0.28], 0.02, ground::GRASS),
        (area::WOOD, _) => ([0.3, 0.4, 0.23], 0.02, ground::GRASS),
        (area::PITCH, sport::TENNIS) => ([0.22, 0.42, 0.36], 0.03, ground::CONCRETE),
        (area::PITCH, sport::TURF) => ([0.3, 0.5, 0.25], 0.03, ground::GRASS),
        (area::PITCH, sport::DIRT) => ([0.6, 0.48, 0.34], 0.03, ground::CONCRETE),
        (area::PITCH, _) => ([0.63, 0.56, 0.43], 0.025, ground::CONCRETE),
        (area::WATER, _) => ([0.12, 0.27, 0.35], 0.08, ground::WATER),
        (area::MARK_WHITE, _) => ([0.9, 0.9, 0.87], 0.15, ground::CONCRETE),
        (area::MARK_YELLOW, _) => ([0.88, 0.66, 0.12], 0.15, ground::CONCRETE),
        (area::PATH, 1) => ([0.62, 0.55, 0.42], 0.035, ground::CONCRETE),
        (area::PATH, _) => ([0.7, 0.68, 0.63], 0.035, ground::CONCRETE),
        (area::STEPS, _) => ([0.6, 0.6, 0.58], 0.05, ground::PAVERS),
        (area::PARKING, _) => ([0.36, 0.36, 0.37], 0.03, ground::ASPHALT),
        (area::TACTILE, _) => ([0.92, 0.74, 0.1], 0.24, ground::PAVERS),
        (area::POOL, _) => ([0.3, 0.62, 0.74], 0.06, ground::WATER),
        (area::PLAZA, _) => ([0.66, 0.64, 0.6], 0.21, ground::PAVERS),
        _ => ([0.45, 0.45, 0.45], 0.05, ground::CONCRETE),
    };
    (rgb.map(srgb_to_linear), lift, layer)
}

fn is_paint(area: &Area) -> bool {
    area.kind == area::MARK_WHITE || area.kind == area::MARK_YELLOW
}

pub(crate) fn triangulate(rings: &[Vec<Point2>]) -> Vec<[Point2; 3]> {
    let mut flat = Vec::new();
    let mut holes = Vec::new();
    for (index, ring) in rings.iter().enumerate() {
        if index > 0 {
            holes.push(flat.len() / 2);
        }
        for point in ring {
            flat.extend_from_slice(&[point.x, point.z]);
        }
    }
    let Ok(indices) = earcutr::earcut(&flat, &holes, 2) else {
        return Vec::new();
    };
    indices
        .as_chunks::<3>()
        .0
        .iter()
        .filter_map(|ids| {
            let point = |id: usize| Point2 {
                x: flat[id * 2],
                z: flat[id * 2 + 1],
            };
            let (a, b, c) = (point(ids[0]), point(ids[1]), point(ids[2]));
            let cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
            (cross.abs() > 1e-8).then_some(if cross < 0.0 { [a, b, c] } else { [a, c, b] })
        })
        .collect()
}

fn clip(poly: &[[f32; 2]], axis: usize, bound: f32, keep_greater: bool) -> Vec<[f32; 2]> {
    let mut output = Vec::new();
    if poly.is_empty() {
        return output;
    }
    let distance = |p: &[f32; 2]| {
        if keep_greater {
            p[axis] - bound
        } else {
            bound - p[axis]
        }
    };
    let mut a = poly[poly.len() - 1];
    let mut da = distance(&a);
    for &b in poly {
        let db = distance(&b);
        if (da >= 0.0) != (db >= 0.0) {
            let t = da / (da - db);
            output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        if db >= 0.0 {
            output.push(b);
        }
        a = b;
        da = db;
    }
    output
}

fn emit_triangle(
    triangle: [Point2; 3],
    grid: HeightGrid<'_>,
    bridge_decks: &[decks::Deck],
    step: f32,
    style: ([f32; 3], f32, f32),
    mesh: &mut MeshBuffers,
) {
    let points = triangle.map(|p| [p.x, p.z]);
    let min_x = points.iter().map(|p| p[0]).fold(f32::INFINITY, f32::min);
    let max_x = points
        .iter()
        .map(|p| p[0])
        .fold(f32::NEG_INFINITY, f32::max);
    let min_z = points.iter().map(|p| p[1]).fold(f32::INFINITY, f32::min);
    let max_z = points
        .iter()
        .map(|p| p[1])
        .fold(f32::NEG_INFINITY, f32::max);
    for j in (min_z / step).floor() as i32..=(max_z / step).floor() as i32 {
        let row = clip(
            &clip(&points, 1, j as f32 * step, true),
            1,
            (j + 1) as f32 * step,
            false,
        );
        if row.len() < 3 {
            continue;
        }
        for i in (min_x / step).floor() as i32..=(max_x / step).floor() as i32 {
            let cell = clip(
                &clip(&row, 0, i as f32 * step, true),
                0,
                (i + 1) as f32 * step,
                false,
            );
            if cell.len() < 3 {
                continue;
            }
            for sign in [1.0, -1.0] {
                let mut diagonal = Vec::new();
                for poly in [&cell] {
                    let mut shifted = poly.to_vec();
                    let distance = |p: &[f32; 2]| {
                        sign * (step - (p[0] - i as f32 * step) - (p[1] - j as f32 * step))
                    };
                    let mut a = shifted[shifted.len() - 1];
                    let mut da = distance(&a);
                    for b in shifted.drain(..) {
                        let db = distance(&b);
                        if (da >= 0.0) != (db >= 0.0) {
                            let t = da / (da - db);
                            diagonal.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
                        }
                        if db >= 0.0 {
                            diagonal.push(b);
                        }
                        a = b;
                        da = db;
                    }
                }
                for k in 1..diagonal.len().saturating_sub(1) {
                    for p in [diagonal[0], diagonal[k], diagonal[k + 1]] {
                        let y = decks::surface(&grid, bridge_decks, p[0], p[1]) + style.1;
                        mesh.vertex([p[0], y, p[1]], grid.normal(p[0], p[1]), style.0, style.2);
                    }
                }
            }
        }
    }
}

pub fn build(
    areas: &[Area],
    grid: HeightGrid<'_>,
    tile_size: f32,
    bridge_decks: &[decks::Deck],
) -> (MeshBuffers, MeshBuffers) {
    let mut ground = MeshBuffers::default();
    let mut paint = MeshBuffers::default();
    let step = tile_size / (tile_size / grid.step).ceil();
    for area in areas {
        let mesh = if is_paint(area) {
            &mut paint
        } else {
            &mut ground
        };
        for polygon in &area.polygons {
            for triangle in triangulate(polygon) {
                emit_triangle(triangle, grid, bridge_decks, step, style(area), mesh);
            }
        }
    }
    (ground, paint)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn area(kind: u8, code: u16) -> Area {
        Area {
            kind,
            code,
            polygons: vec![vec![vec![
                Point2 { x: 0.0, z: 0.0 },
                Point2 { x: 10.0, z: 0.0 },
                Point2 { x: 0.0, z: 10.0 },
            ]]],
        }
    }

    fn grid(data: &[f32]) -> HeightGrid<'_> {
        HeightGrid {
            x0: 0.0,
            z0: 0.0,
            step: 5.0,
            width: 4,
            height: 4,
            data,
        }
    }

    #[test]
    fn water_and_paint_use_the_tokyo_ground_layers() {
        let data = vec![0.0; 16];
        let grid = grid(&data);
        let water = area(area::WATER, 0);
        let white = area(area::MARK_WHITE, 0);
        let yellow = area(area::MARK_YELLOW, 0);
        assert_eq!(style(&water).2, ground::WATER);
        assert_eq!(style(&white).2, ground::CONCRETE);
        assert_eq!(style(&yellow).2, ground::CONCRETE);
        let (ground_mesh, paint_mesh) = build(&[water, white], grid, 10.0, &[]);
        assert!(
            ground_mesh
                .layer
                .iter()
                .all(|layer| *layer == ground::WATER)
        );
        assert!(
            paint_mesh
                .layer
                .iter()
                .all(|layer| *layer == ground::CONCRETE)
        );
        assert!(!paint_mesh.layer.is_empty());
    }

    #[test]
    fn unknown_ground_is_not_water() {
        let data = vec![0.0; 16];
        let grid = grid(&data);
        let unknown = area(255, 0);
        assert_eq!(style(&unknown).2, ground::CONCRETE);
        let (ground_mesh, _) = build(&[unknown], grid, 10.0, &[]);
        assert!(
            ground_mesh
                .layer
                .iter()
                .all(|layer| *layer != ground::WATER)
        );
    }
}
