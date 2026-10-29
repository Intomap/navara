//! Dynamic structure meshing (footbridges, platforms, canopies, flyovers).
//!
//! Port of the TypeScript `buildStructures` / `buildFlyovers` geometry code so
//! the triangulation runs once in the WASM worker instead of blocking the main
//! thread. The output is a city-frame triangle soup that is then projected to
//! ECEF and given smooth vertex normals, matching the previous JS output.

use serde::Deserialize;

use crate::buffers::MeshBuffers;
use crate::meshing::HeightGrid;
use crate::projection::RtcCenter;

#[derive(Debug, Deserialize)]
pub struct Footbridge {
    pub pts: Vec<f64>,
    pub width: f64,
    pub steps: bool,
}

#[derive(Debug, Deserialize)]
pub struct Platform {
    pub ring: Vec<[f64; 2]>,
    pub y: f64,
    pub covered: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct Canopy {
    pub ring: Vec<[f64; 2]>,
    pub y: f64,
}

#[derive(Debug, Deserialize)]
pub struct Structures {
    pub footbridges: Option<Vec<Footbridge>>,
    pub platforms: Option<Vec<Platform>>,
    pub canopies: Option<Vec<Canopy>>,
}

#[derive(Debug, Deserialize)]
pub struct RoadEdge {
    pub pts: Vec<f64>,
    pub highway: String,
    pub lanes: i32,
    pub flyover: Option<bool>,
    pub span: Option<bool>,
    pub tunnel: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct Roads {
    pub edges: Vec<RoadEdge>,
}

type RGB = [f64; 3];
type Point = [f64; 3];
type Profile = [[f64; 2]];

#[derive(Debug, Clone, Copy)]
struct Section {
    p: Point,
    t: Point,
    n: Point,
    s: f64,
    h: f64,
}

/// sRGB → linear RGB, matching three.js `Color.setRGB(rgb, SRGBColorSpace)`.
fn linear(rgb: RGB) -> [f32; 3] {
    let convert = |c: f64| {
        if c < 0.04045 {
            c * 0.077_399_380_8
        } else {
            (c * 0.947_867_298_6 + 0.052_132_701_4).powf(2.4)
        }
    };
    [
        convert(rgb[0]) as f32,
        convert(rgb[1]) as f32,
        convert(rgb[2]) as f32,
    ]
}

struct Soup {
    position: Vec<f64>,
    color: Vec<f32>,
}

impl Soup {
    fn new() -> Self {
        Self {
            position: Vec::new(),
            color: Vec::new(),
        }
    }

    fn tri(&mut self, a: Point, b: Point, c: Point, color: [f32; 3]) {
        self.position.extend_from_slice(&a);
        self.position.extend_from_slice(&b);
        self.position.extend_from_slice(&c);
        for _ in 0..3 {
            self.color.extend_from_slice(&color);
        }
    }

    fn quad(&mut self, a: Point, b: Point, c: Point, d: Point, color: [f32; 3]) {
        self.tri(a, b, c, color);
        self.tri(a, c, d, color);
    }

    fn box_(
        &mut self,
        center: Point,
        t: Point,
        n: Point,
        ht: f64,
        hn: f64,
        y0: f64,
        y1: f64,
        color: [f32; 3],
    ) {
        let point = |st: f64, sn: f64, y: f64| -> Point {
            [
                center[0] + t[0] * ht * st + n[0] * hn * sn,
                y,
                center[2] + t[2] * ht * st + n[2] * hn * sn,
            ]
        };
        let corners: [[f64; 2]; 4] = [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0]];
        for i in 0..4 {
            let a = corners[i];
            let b = corners[(i + 1) % 4];
            self.quad(
                point(a[0], a[1], y0),
                point(b[0], b[1], y0),
                point(b[0], b[1], y1),
                point(a[0], a[1], y1),
                color,
            );
        }
        self.quad(
            point(-1.0, -1.0, y1),
            point(1.0, -1.0, y1),
            point(1.0, 1.0, y1),
            point(-1.0, 1.0, y1),
            color,
        );
    }
}

fn at(section: &Section, lateral: f64, vertical: f64) -> Point {
    [
        section.p[0] + section.n[0] * lateral,
        section.p[1] + vertical,
        section.p[2] + section.n[2] * lateral,
    ]
}

/// Sample cross-sections along a polyline, mirroring `railSections` in JS.
fn rail_sections(pts: &[f64], ground: &dyn Fn(f64, f64) -> f64) -> Vec<Section> {
    const STEP: f64 = 3.0;
    let mut points: Vec<Point> = Vec::with_capacity(pts.len() / 3);
    for i in (0..pts.len()).step_by(3) {
        points.push([pts[i], pts[i + 1], pts[i + 2]]);
    }
    let mut out: Vec<Section> = Vec::new();
    let mut distance = 0.0_f64;
    let mut next = 0.0_f64;
    for i in 1..points.len() {
        let a = points[i - 1];
        let b = points[i];
        let length = ((b[0] - a[0]).powi(2) + (b[2] - a[2]).powi(2)).sqrt();
        if length < 0.01 {
            continue;
        }
        let t = [(b[0] - a[0]) / length, 0.0, (b[2] - a[2]) / length];
        while next <= distance + length + 1e-6 {
            let k = (next - distance) / length;
            let p = [
                a[0] + (b[0] - a[0]) * k,
                a[1] + (b[1] - a[1]) * k,
                a[2] + (b[2] - a[2]) * k,
            ];
            out.push(Section {
                p,
                t,
                n: [-t[2], 0.0, t[0]],
                s: next,
                h: p[1] - ground(p[0], p[2]),
            });
            next += STEP;
        }
        distance += length;
    }
    let end = points[points.len() - 1];
    if let Some(tail) = out.last() {
        if ((end[0] - tail.p[0]).powi(2) + (end[2] - tail.p[2]).powi(2)).sqrt() > 0.05 {
            out.push(Section {
                p: end,
                t: tail.t,
                n: tail.n,
                s: distance,
                h: end[1] - ground(end[0], end[2]),
            });
        }
    }
    for i in 1..out.len().saturating_sub(1) {
        let tx = out[i + 1].p[0] - out[i - 1].p[0];
        let tz = out[i + 1].p[2] - out[i - 1].p[2];
        let length = (tx * tx + tz * tz).sqrt().max(1.0);
        out[i].t = [tx / length, 0.0, tz / length];
        out[i].n = [-tz / length, 0.0, tx / length];
    }
    out
}

/// Sweep a profile between two sections, producing quads.
fn sweep(
    soup: &mut Soup,
    a: &Section,
    b: &Section,
    pa: &Profile,
    pb: &Profile,
    color: RGB,
) {
    let color = linear(color);
    for j in 0..pa.len() - 1 {
        soup.quad(
            at(a, pa[j][0], pa[j][1]),
            at(b, pb[j][0], pb[j][1]),
            at(b, pb[j + 1][0], pb[j + 1][1]),
            at(a, pa[j + 1][0], pa[j + 1][1]),
            color,
        );
    }
}

/// A prism with an earcut-triangulated top and side walls.
fn prism(soup: &mut Soup, ring: &[[f64; 2]], y0: f64, y1: f64, top: RGB, side: RGB) {
    let top = linear(top);
    let side = linear(side);
    let mut contour = Vec::with_capacity(ring.len() * 2);
    for point in ring {
        contour.push(point[0]);
        contour.push(point[1]);
    }
    if let Ok(indices) = earcutr::earcut(&contour, &[], 2) {
        for triangle in indices.chunks(3) {
            let a = triangle[0] as usize;
            let b = triangle[1] as usize;
            let c = triangle[2] as usize;
            soup.tri(
                [ring[a][0], y1, ring[a][1]],
                [ring[b][0], y1, ring[b][1]],
                [ring[c][0], y1, ring[c][1]],
                top,
            );
        }
    }
    for i in 0..ring.len() {
        let [ax, az] = ring[i];
        let [bx, bz] = ring[(i + 1) % ring.len()];
        soup.quad(
            [ax, y0, az],
            [bx, y0, bz],
            [bx, y1, bz],
            [ax, y1, az],
            side,
        );
    }
}

fn build_structures(structures: &Structures, ground: &dyn Fn(f64, f64) -> f64) -> Soup {
    const CONCRETE: RGB = [0.66, 0.66, 0.64];
    const STEEL: RGB = [0.4, 0.42, 0.44];
    const PAVING: RGB = [0.56, 0.55, 0.52];
    const ROOF: RGB = [0.8, 0.81, 0.82];
    const EDGE: RGB = [0.9, 0.78, 0.2];
    let mut soup = Soup::new();

    for footbridge in structures.footbridges.iter().flatten() {
        let sections = rail_sections(&footbridge.pts, ground);
        let width = footbridge.width / 2.0;
        for i in 0..sections.len().saturating_sub(1) {
            let a = &sections[i];
            let b = &sections[i + 1];
            if a.h.max(b.h) < 0.4 {
                continue;
            }
            let paving = [[-width, 0.0], [width, 0.0]];
            sweep(&mut soup, a, b, &paving, &paving, PAVING);
            let concrete = [
                [-width, 0.0],
                [-width, -0.35],
                [width, -0.35],
                [width, 0.0],
            ];
            sweep(&mut soup, a, b, &concrete, &concrete, CONCRETE);
            for side in [-1.0, 1.0] {
                let steel = [[side * width, 0.0], [side * width, 1.1]];
                sweep(&mut soup, a, b, &steel, &steel, STEEL);
            }
        }
        if !footbridge.steps {
            for section in &sections {
                if section.h > 3.0 && (section.s / 3.0).round() as i64 % 4 == 2 {
                    soup.box_(
                        section.p,
                        section.t,
                        section.n,
                        0.3,
                        0.5_f64.min(width * 0.4),
                        section.p[1] - section.h - 1.0,
                        section.p[1] - 0.35,
                        linear(CONCRETE),
                    );
                }
            }
        }
    }

    for platform in structures.platforms.iter().flatten() {
        let base = platform
            .ring
            .iter()
            .map(|point| ground(point[0], point[1]))
            .fold(f64::INFINITY, f64::min)
            - 0.5;
        prism(
            &mut soup,
            &platform.ring,
            base.min(platform.y - 1.2),
            platform.y,
            PAVING,
            CONCRETE,
        );
        let center_length = platform.ring.len();
        let center: [f64; 2] = platform.ring.iter().fold([0.0, 0.0], |sum, point| {
            [sum[0] + point[0], sum[1] + point[1]]
        });
        let inset = |index: usize, distance: f64| -> Point {
            let [x, z] = platform.ring[index];
            let length =
                ((center[0] / center_length as f64 - x).powi(2)
                    + (center[1] / center_length as f64 - z).powi(2))
                .sqrt()
                .max(1.0);
            [
                x + ((center[0] / center_length as f64 - x) / length) * distance,
                platform.y + 0.02,
                z + ((center[1] / center_length as f64 - z) / length) * distance,
            ]
        };
        let edge = linear(EDGE);
        for i in 0..platform.ring.len() {
            let j = (i + 1) % platform.ring.len();
            soup.quad(
                inset(i, 0.6),
                inset(j, 0.6),
                inset(j, 0.95),
                inset(i, 0.95),
                edge,
            );
        }
        if platform.covered.unwrap_or(false) {
            let roof: Vec<[f64; 2]> = (0..platform.ring.len())
                .map(|index| {
                    let point = inset(index, 0.4);
                    [point[0], point[2]]
                })
                .collect();
            prism(
                &mut soup,
                &roof,
                platform.y + 3.5,
                platform.y + 3.7,
                ROOF,
                ROOF,
            );
            let steel = linear(STEEL);
            let mut index = 0;
            let step = 1.max((platform.ring.len() as f64 / 8.0).round() as usize);
            while index < platform.ring.len() {
                let point = inset(index, 1.6);
                soup.box_(
                    [point[0], 0.0, point[2]],
                    [1.0, 0.0, 0.0],
                    [0.0, 0.0, 1.0],
                    0.08,
                    0.08,
                    platform.y,
                    platform.y + 3.5,
                    steel,
                );
                index += step;
            }
        }
    }

    for canopy in structures.canopies.iter().flatten() {
        prism(
            &mut soup,
            &canopy.ring,
            canopy.y - 0.25,
            canopy.y,
            ROOF,
            ROOF,
        );
        let steel = linear(STEEL);
        let mut index = 0;
        let step = 1.max((canopy.ring.len() as f64 / 6.0).ceil() as usize);
        while index < canopy.ring.len() {
            let [x, z] = canopy.ring[index];
            soup.box_(
                [x, 0.0, z],
                [1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0],
                0.08,
                0.08,
                ground(x, z),
                canopy.y - 0.25,
                steel,
            );
            index += step;
        }
    }

    soup
}

fn build_flyovers(roads: &Roads, ground: &dyn Fn(f64, f64) -> f64) -> Soup {
    const DECK_ABOVE: f64 = 2.0;
    const RAMP_ABOVE: f64 = 0.35;
    const PIER_SPACING: f64 = 27.0;
    const STEP: f64 = 3.0;
    const CONCRETE: RGB = [0.6, 0.6, 0.58];
    const ASPHALT: RGB = [0.3, 0.3, 0.32];
    const PAINT: RGB = [0.9, 0.9, 0.87];
    const BARRIER: RGB = [0.7, 0.72, 0.72];
    let mut soup = Soup::new();

    for edge in &roads.edges {
        if edge.tunnel.unwrap_or(false) {
            continue;
        }
        let expressway = edge.highway.starts_with("motorway");
        if !edge.flyover.unwrap_or(false) && !edge.span.unwrap_or(false) && !expressway {
            continue;
        }
        let sections = rail_sections(&edge.pts, ground);
        let threshold = if edge.flyover.unwrap_or(false) || edge.span.unwrap_or(false) {
            RAMP_ABOVE
        } else {
            1.5
        };
        if !sections.iter().any(|section| section.h > threshold) {
            continue;
        }
        let lanes = edge.lanes.max(1);
        let width = if edge.span.unwrap_or(false) {
            lanes as f64 * 1.65 + 7.0
        } else {
            (lanes as f64 * 3.3 + if expressway { 2.2 } else { 1.4 }) / 2.0
        };
        for i in 0..sections.len().saturating_sub(1) {
            let a = &sections[i];
            let b = &sections[i + 1];
            let height = a.h.max(b.h);
            if height <= RAMP_ABOVE {
                continue;
            }
            if edge.span.unwrap_or(false) {
                if a.h.min(b.h) > DECK_ABOVE {
                    let profile = [
                        [-width, -0.3],
                        [-width, -1.5],
                        [width, -1.5],
                        [width, -0.3],
                    ];
                    sweep(&mut soup, a, b, &profile, &profile, CONCRETE);
                }
                continue;
            }
            let asphalt = [[-width + 0.25, 0.0], [width - 0.25, 0.0]];
            sweep(&mut soup, a, b, &asphalt, &asphalt, ASPHALT);
            let mut line = |offset: f64| {
                let profile = [[offset - 0.07, 0.015], [offset + 0.07, 0.015]];
                sweep(&mut soup, a, b, &profile, &profile, PAINT);
            };
            line(-width + 0.75);
            line(width - 0.75);
            if (a.s / (STEP * 2.0)).floor() as i64 % 2 == 0 {
                for lane in 1..lanes {
                    line(-width + 0.75 + (lane as f64 * (2.0 * width - 1.5)) / lanes as f64);
                }
            }
            let top = if expressway { 1.9 } else { 1.0 };
            for side in [-1.0, 1.0] {
                let barrier_base = [
                    [side * (width - 0.25), 0.0],
                    [side * (width - 0.25), 0.9],
                    [side * width, 0.9],
                ];
                sweep(&mut soup, a, b, &barrier_base, &barrier_base, CONCRETE);
                if expressway {
                    let barrier = [[side * (width - 0.1), 0.9], [side * (width - 0.1), top]];
                    sweep(&mut soup, a, b, &barrier, &barrier, BARRIER);
                }
            }
            if a.h.min(b.h) > DECK_ABOVE {
                let deck = [
                    [-width, 0.9],
                    [-width, -0.5],
                    [-width * 0.55, -1.5],
                    [width * 0.55, -1.5],
                    [width, -0.5],
                    [width, 0.9],
                ];
                sweep(&mut soup, a, b, &deck, &deck, CONCRETE);
            } else {
                let pa = [[-width, 0.9], [-width, -a.h.max(0.0) - 0.4]];
                let pb = [[-width, 0.9], [-width, -b.h.max(0.0) - 0.4]];
                sweep(&mut soup, a, b, &pa, &pb, CONCRETE);
                let pa = [[width, -a.h.max(0.0) - 0.4], [width, 0.9]];
                let pb = [[width, -b.h.max(0.0) - 0.4], [width, 0.9]];
                sweep(&mut soup, a, b, &pa, &pb, CONCRETE);
            }
        }
        for section in &sections {
            if !edge.span.unwrap_or(false)
                && section.h > DECK_ABOVE + 1.5
                && (section.s / STEP).round() as i64 % (PIER_SPACING / STEP).round() as i64 == 1
            {
                soup.box_(
                    section.p,
                    section.t,
                    section.n,
                    1.1,
                    1.5_f64.min(width * 0.4),
                    section.p[1] - section.h - 1.5,
                    section.p[1] - 1.5,
                    linear(CONCRETE),
                );
            }
        }
    }

    soup
}

/// Area-weighted smooth vertex normals, matching `computeVertexNormals`.
fn smooth_normals(position: &[f32]) -> Vec<f32> {
    let vertex_count = position.len() / 3;
    let mut normals = vec![0.0_f32; position.len()];
    for triangle in 0..vertex_count / 3 {
        let a = [
            position[triangle * 9] as f64,
            position[triangle * 9 + 1] as f64,
            position[triangle * 9 + 2] as f64,
        ];
        let b = [
            position[triangle * 9 + 3] as f64,
            position[triangle * 9 + 4] as f64,
            position[triangle * 9 + 5] as f64,
        ];
        let c = [
            position[triangle * 9 + 6] as f64,
            position[triangle * 9 + 7] as f64,
            position[triangle * 9 + 8] as f64,
        ];
        let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        let v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let normal = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ];
        for vertex in [triangle * 3, triangle * 3 + 1, triangle * 3 + 2] {
            normals[vertex * 3] += normal[0] as f32;
            normals[vertex * 3 + 1] += normal[1] as f32;
            normals[vertex * 3 + 2] += normal[2] as f32;
        }
    }
    for vertex in 0..vertex_count {
        let (x, y, z) = (
            normals[vertex * 3],
            normals[vertex * 3 + 1],
            normals[vertex * 3 + 2],
        );
        let length = (x * x + y * y + z * z).sqrt();
        if length > 1e-12 {
            normals[vertex * 3] /= length;
            normals[vertex * 3 + 1] /= length;
            normals[vertex * 3 + 2] /= length;
        }
    }
    normals
}

fn soup_to_mesh(soup: Soup, center: &RtcCenter) -> MeshBuffers {
    let vertex_count = soup.position.len() / 3;
    let mut mesh = MeshBuffers::default();
    mesh.position = soup
        .position
        .iter()
        .map(|value| *value as f32)
        .collect();
    mesh.normal = smooth_normals(&mesh.position);
    mesh.color = soup.color;
    mesh.layer = vec![0.0; vertex_count];
    mesh.project(center);
    mesh
}

pub fn build_structures_mesh(
    structures_json: &str,
    grid: HeightGrid<'_>,
    center: &RtcCenter,
) -> Result<MeshBuffers, String> {
    let structures: Structures =
        serde_json::from_str(structures_json).map_err(|error| error.to_string())?;
    let ground = |x: f64, z: f64| grid.sample(x as f32, z as f32) as f64;
    Ok(soup_to_mesh(build_structures(&structures, &ground), center))
}

pub fn build_flyovers_mesh(
    roads_json: &str,
    grid: HeightGrid<'_>,
    center: &RtcCenter,
) -> Result<MeshBuffers, String> {
    let roads: Roads = serde_json::from_str(roads_json).map_err(|error| error.to_string())?;
    let ground = |x: f64, z: f64| grid.sample(x as f32, z as f32) as f64;
    Ok(soup_to_mesh(build_flyovers(&roads, &ground), center))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid() -> HeightGrid<'static> {
        let data: Vec<f32> = vec![0.0; 4];
        let data = Box::leak(data.into_boxed_slice());
        HeightGrid {
            x0: 0.0,
            z0: 0.0,
            step: 10.0,
            width: 2,
            height: 2,
            data,
        }
    }

    #[test]
    fn rail_sections_sample_ground_height() {
        let grid = grid();
        let ground = |x: f64, z: f64| grid.sample(x as f32, z as f32) as f64;
        // A straight 30 m footbridge along +x at y=10.
        let pts = [0.0, 10.0, 0.0, 30.0, 10.0, 0.0];
        let sections = rail_sections(&pts, &ground);
        assert!(sections.len() >= 2, "sections sampled along the span");
        for section in &sections {
            assert!((section.h - 10.0).abs() < 1e-3, "ground is flat at y=0");
        }
    }

    #[test]
    fn footbridge_emits_geometry() {
        let grid = grid();
        let ground = |x: f64, z: f64| grid.sample(x as f32, z as f32) as f64;
        let structures: Structures = serde_json::from_str(
            r#"{"footbridges":[{"pts":[0,10,0,30,10,0],"width":3,"steps":false}]}"#,
        )
        .unwrap();
        let soup = build_structures(&structures, &ground);
        assert!(soup.position.len() > 0, "footbridge produces triangles");
        assert_eq!(soup.position.len() / 3, soup.color.len() / 3, "color per vertex");
    }

    #[test]
    fn flyovers_skip_ground_level_roads() {
        let grid = grid();
        let ground = |x: f64, z: f64| grid.sample(x as f32, z as f32) as f64;
        let roads: Roads = serde_json::from_str(
            r#"{"edges":[{"pts":[0,0,0,30,0,0],"highway":"residential","lanes":2}]}"#,
        )
        .unwrap();
        let soup = build_flyovers(&roads, &ground);
        assert!(soup.position.is_empty(), "non-flyover road emits no geometry");
    }
}
