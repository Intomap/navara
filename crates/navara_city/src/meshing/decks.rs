use serde::Deserialize;

use crate::meshing::HeightGrid;

const FADE: f32 = 8.0;
pub const CORRIDOR_MARGIN: f32 = 16.0;
pub const DECK_FLAG: u16 = 0x8000;

#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
pub struct Deck {
    pub pts: Vec<f32>,
    pub half: f32,
}

pub fn parse_decks(json: &str) -> Result<Vec<Deck>, String> {
    serde_json::from_str(json).map_err(|error| error.to_string())
}

pub fn deck_of(code: u16) -> i32 {
    if code & DECK_FLAG != 0 {
        (code & 0x7fff) as i32
    } else {
        -1
    }
}

#[derive(Debug, Clone, Copy)]
struct Projection {
    dist: f32,
    y: f32,
    inside: bool,
}

fn project(deck: &Deck, x: f32, z: f32) -> Projection {
    let points = &deck.pts;
    let last = points.len() / 3 - 1;
    let mut best = Projection {
        dist: f32::INFINITY,
        y: 0.0,
        inside: false,
    };
    for i in 1..=last {
        let ax = points[i * 3 - 3];
        let ay = points[i * 3 - 2];
        let az = points[i * 3 - 1];
        let dx = points[i * 3] - ax;
        let dz = points[i * 3 + 2] - az;
        let denominator = dx * dx + dz * dz;
        let raw = if denominator == 0.0 {
            0.0
        } else {
            ((x - ax) * dx + (z - az) * dz) / denominator
        };
        let t = raw.clamp(0.0, 1.0);
        let dist = ((x - ax - dx * t).powi(2) + (z - az - dz * t).powi(2)).sqrt();
        if dist < best.dist {
            best = Projection {
                dist,
                y: ay + (points[i * 3 + 1] - ay) * t,
                inside: !(i == 1 && raw <= 0.0) && !(i == last && raw >= 1.0),
            };
        }
    }
    best
}

pub fn surface(grid: &HeightGrid<'_>, decks: &[Deck], x: f32, z: f32) -> f32 {
    let terrain = grid.sample(x, z);
    let mut y = terrain;
    for deck in decks {
        let projection = project(deck, x, z);
        if !projection.inside || projection.y <= terrain {
            continue;
        }
        let width = ((1.0 - (projection.dist - deck.half) / FADE) / 1.0).clamp(0.0, 1.0);
        y = y.max(terrain + (projection.y - terrain) * width);
    }
    y
}

pub fn cover(grid: &HeightGrid<'_>, decks: &[Deck], x: f32, z: f32) -> f32 {
    let mut y = grid.sample(x, z);
    for deck in decks {
        let projection = project(deck, x, z);
        if projection.inside && projection.dist <= deck.half - CORRIDOR_MARGIN + 3.5 {
            y = y.max(projection.y);
        }
    }
    y
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

    fn deck() -> Deck {
        Deck {
            pts: vec![0.0, 10.0, 0.0, 0.0, 10.0, 20.0],
            half: 6.0,
        }
    }

    #[test]
    fn surface_holds_the_corridor_and_blends_to_terrain() {
        let data = vec![0.0; 16];
        let decks = vec![deck()];
        assert!((surface(&grid(&data), &decks, 0.0, 10.0) - 10.0).abs() < 1e-5);
        let edge = surface(&grid(&data), &decks, 5.9, 10.0);
        assert!(edge > 9.0 && edge <= 10.0);
        assert_eq!(surface(&grid(&data), &decks, 40.0, 10.0), 0.0);
    }

    #[test]
    fn cover_only_roofs_the_real_deck_width() {
        let data = vec![0.0; 16];
        let decks = vec![Deck {
            pts: deck().pts,
            half: 20.0,
        }];
        assert!((cover(&grid(&data), &decks, 0.0, 10.0) - 10.0).abs() < 1e-5);
        assert_eq!(cover(&grid(&data), &decks, 15.0, 10.0), 0.0);
    }

    #[test]
    fn parses_manifest_deck_json_and_flags() {
        let decks = parse_decks(r#"[{"pts":[0,10,0,0,10,20],"half":6}]"#).unwrap();
        assert_eq!(decks, vec![deck()]);
        assert_eq!(deck_of(0x8002), 2);
        assert_eq!(deck_of(2), -1);
    }
}
