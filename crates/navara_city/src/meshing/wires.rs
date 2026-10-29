use crate::{
    format::Tile,
    meshing::{HeightGrid, decks},
    projection::RtcCenter,
};

const SEGMENTS: usize = 6;
const WIRE_HEIGHTS: [(f32, f32); 6] = [
    (-0.85, 9.8),
    (0.0, 9.8),
    (0.85, 9.8),
    (-0.65, 9.05),
    (0.65, 9.05),
    (0.45, 7.15),
];

pub fn build(
    tile: &Tile,
    grid: HeightGrid<'_>,
    bridge_decks: &[decks::Deck],
    center: &RtcCenter,
) -> Vec<f32> {
    let mut positions = Vec::new();
    for wire in &tile.wires {
        let (x1, z1, x2, z2) = (wire[0], wire[1], wire[2], wire[3]);
        let length = ((x2 - x1).powi(2) + (z2 - z1).powi(2)).sqrt().max(1e-8);
        let (nx, nz) = (-(z2 - z1) / length, (x2 - x1) / length);
        let (y1, y2) = (
            decks::surface(&grid, bridge_decks, x1, z1),
            decks::surface(&grid, bridge_decks, x2, z2),
        );
        let sag = length * 0.022;
        for (offset, height) in WIRE_HEIGHTS {
            for segment in 0..SEGMENTS {
                for step in [segment, segment + 1] {
                    let t = step as f32 / SEGMENTS as f32;
                    let x = x1 + (x2 - x1) * t + nx * offset;
                    let z = z1 + (z2 - z1) * t + nz * offset;
                    let y = y1 + (y2 - y1) * t + height - sag * 4.0 * t * (1.0 - t);
                    let projected = center.project([x as f64, y as f64, z as f64]);
                    positions.extend_from_slice(&projected.position);
                }
            }
        }
    }
    positions
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn wires_are_catenary_line_segments() {
        let data = vec![0.0; 16];
        let tile = Tile {
            wires: vec![[10.0, 10.0, 20.0, 10.0]],
            ..Tile::default()
        };
        let positions = build(&tile, grid(&data), &[], &RtcCenter::for_tile(0, 0));
        assert_eq!(positions.len(), 6 * SEGMENTS * 2 * 3);
        assert_eq!(positions.len() % 6, 0);
    }
}
