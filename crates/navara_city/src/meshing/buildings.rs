use crate::{
    buffers::{MeshBuffers, srgb_to_linear},
    format::{Building, Point2},
};

use super::ground::triangulate;

const SINK: f32 = 4.0;
const KIND_WALL: f32 = 0.0;
const KIND_FLAT_ROOF: f32 = 1.0;
const KIND_SOLID: f32 = 2.0;
const KIND_PITCHED_ROOF: f32 = 3.0;
const WALL_TILE: f32 = 0.0;
const WALL_CONCRETE: f32 = 1.0;
const WALL_PLASTER: f32 = 2.0;
const WALL_BRICK: f32 = 3.0;
const WALL_SIDING: f32 = 4.0;
const WALL_ROOF: f32 = 5.0;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Category {
    House = 0,
    Apartment = 1,
    Mixed = 2,
    Commercial = 3,
    Public = 4,
    Glass = 5,
}

impl Category {
    fn bay(self) -> f32 {
        match self {
            Self::House | Self::Public => 3.4,
            Self::Apartment => 3.3,
            Self::Mixed => 3.2,
            Self::Commercial => 3.0,
            Self::Glass => 1.5,
        }
    }
}

// [r, g, b, texture layer], selected with the per-building random stream.
const HOUSE_PALETTE: [[f32; 4]; 8] = [
    [0.86, 0.83, 0.75, WALL_PLASTER],
    [0.9, 0.9, 0.87, WALL_PLASTER],
    [0.5, 0.4, 0.33, WALL_BRICK],
    [0.66, 0.66, 0.65, WALL_SIDING],
    [0.3, 0.33, 0.37, WALL_SIDING],
    [0.78, 0.72, 0.62, WALL_PLASTER],
    [0.82, 0.8, 0.74, WALL_SIDING],
    [0.42, 0.36, 0.32, WALL_SIDING],
];
const APARTMENT_PALETTE: [[f32; 4]; 6] = [
    [0.9, 0.89, 0.85, WALL_TILE],
    [0.82, 0.77, 0.68, WALL_TILE],
    [0.55, 0.4, 0.31, WALL_BRICK],
    [0.72, 0.72, 0.7, WALL_PLASTER],
    [0.76, 0.66, 0.55, WALL_TILE],
    [0.62, 0.48, 0.38, WALL_BRICK],
];
const MIXED_PALETTE: [[f32; 4]; 4] = [
    [0.84, 0.82, 0.78, WALL_TILE],
    [0.6, 0.45, 0.36, WALL_BRICK],
    [0.72, 0.72, 0.71, WALL_CONCRETE],
    [0.88, 0.84, 0.74, WALL_TILE],
];
const COMMERCIAL_PALETTE: [[f32; 4]; 6] = [
    [0.68, 0.69, 0.7, WALL_CONCRETE],
    [0.86, 0.86, 0.84, WALL_TILE],
    [0.76, 0.71, 0.63, WALL_TILE],
    [0.34, 0.35, 0.37, WALL_CONCRETE],
    [0.56, 0.57, 0.59, WALL_CONCRETE],
    [0.8, 0.8, 0.79, WALL_PLASTER],
];
const PUBLIC_PALETTE: [[f32; 4]; 3] = [
    [0.78, 0.76, 0.72, WALL_TILE],
    [0.64, 0.64, 0.62, WALL_CONCRETE],
    [0.7, 0.62, 0.54, WALL_BRICK],
];
const GLASS_PALETTE: [[f32; 4]; 3] = [
    [0.5, 0.53, 0.56, WALL_CONCRETE],
    [0.62, 0.63, 0.64, WALL_CONCRETE],
    [0.32, 0.35, 0.38, WALL_CONCRETE],
];
const PITCHED_ROOFS: [[f32; 3]; 6] = [
    [0.2, 0.21, 0.23],
    [0.22, 0.28, 0.36],
    [0.3, 0.22, 0.18],
    [0.42, 0.25, 0.2],
    [0.2, 0.28, 0.25],
    [0.34, 0.34, 0.35],
];

fn hash(a: i32, b: i32, c: i32) -> f32 {
    let mut h = a.wrapping_mul(0x27d4eb2d)
        ^ b.wrapping_mul(0x165667b1)
        ^ c.wrapping_mul(0x9e3779b1u32 as i32);
    h = (h ^ ((h as u32 >> 15) as i32)).wrapping_mul(0x85ebca6bu32 as i32);
    h = (h ^ ((h as u32 >> 13) as i32)).wrapping_mul(0xc2b2ae35u32 as i32);
    ((h ^ ((h as u32 >> 16) as i32)) as u32) as f32 / 4_294_967_296.0
}

struct Random {
    index: i32,
    tx: i32,
    tz: i32,
    next: i32,
}

impl Random {
    fn new(index: usize, tx: i32, tz: i32) -> Self {
        Self {
            index: index as i32,
            tx,
            tz,
            next: 0,
        }
    }

    fn next(&mut self) -> f32 {
        let k = self.next;
        self.next = self.next.wrapping_add(1);
        hash(
            self.index.wrapping_mul(31).wrapping_add(k),
            self.tx.wrapping_mul(13).wrapping_add(5),
            self.tz.wrapping_mul(17).wrapping_add(3),
        )
    }
}

fn category(usage: u16, height: f32, seed: f32) -> Category {
    match usage {
        411 | 415 => Category::House,
        412 => Category::Apartment,
        413 | 414 => Category::Mixed,
        401..=404 => {
            if height > 45.0 || (height > 24.0 && seed < 0.25) {
                Category::Glass
            } else {
                Category::Commercial
            }
        }
        421..=454 => Category::Public,
        _ => {
            if height < 9.0 {
                Category::House
            } else if seed < 0.5 {
                Category::Apartment
            } else {
                Category::Commercial
            }
        }
    }
}

fn palette(category: Category) -> &'static [[f32; 4]] {
    match category {
        Category::House => &HOUSE_PALETTE,
        Category::Apartment => &APARTMENT_PALETTE,
        Category::Mixed => &MIXED_PALETTE,
        Category::Commercial => &COMMERCIAL_PALETTE,
        Category::Public => &PUBLIC_PALETTE,
        Category::Glass => &GLASS_PALETTE,
    }
}

fn linear(color: [f32; 3]) -> [f32; 3] {
    color.map(srgb_to_linear)
}

fn aerial(color: [f32; 3]) -> [f32; 3] {
    let luminance = 0.3 * color[0] + 0.59 * color[1] + 0.11 * color[2];
    let target = 0.41 + 0.24 * ((luminance - 0.3) / 0.6).clamp(0.0, 1.0);
    let scale = target / luminance.max(0.05);
    let grey = [target * 0.93, target * 1.02, target * 1.08];
    let blend = |value: f32, grey: f32| {
        let scaled = value * scale;
        scaled + (grey - scaled) * 0.72
    };
    [
        blend(color[0], grey[0]),
        blend(color[1], grey[1]),
        blend(color[2], grey[2]),
    ]
}

fn paint(color: [f32; 3]) -> [f32; 3] {
    let top = color.into_iter().fold(f32::NEG_INFINITY, f32::max);
    let low = color.into_iter().fold(f32::INFINITY, f32::min);
    let saturation = if top != 0.0 { (top - low) / top } else { 0.0 };
    let keep = if saturation > 0.55 {
        0.55 / saturation
    } else {
        1.0
    };
    let target = top.min(0.72);
    color.map(|value| {
        if top != 0.0 {
            (top - (top - value) * keep) * (target / top)
        } else {
            value
        }
    })
}

fn hinted_layer(material: u32) -> Option<f32> {
    match material {
        1 => Some(WALL_TILE),
        2 => Some(WALL_CONCRETE),
        3 => Some(WALL_PLASTER),
        4 => Some(WALL_BRICK),
        5 => Some(WALL_SIDING),
        _ => None,
    }
}

struct Finish {
    category: Category,
    color: [f32; 3],
    layer: f32,
    glass_tower: bool,
}

fn finish(building: &Building, random: &mut Random, seed: f32) -> Finish {
    let material = (building.hint >> 24) & 15;
    let painted = building.hint & 0x8000_0000 != 0;
    let shell_top = building
        .surfaces
        .iter()
        .filter_map(|surface| surface.rings.first())
        .flatten()
        .map(|point| point[1])
        .fold(f32::NEG_INFINITY, f32::max);
    let glass_tower = !building.surfaces.is_empty()
        && !building.surfaces.iter().any(|surface| surface.uv.is_some())
        && building.height.max(shell_top - building.base) > 90.0;
    let category = if material == 6 || glass_tower {
        Category::Glass
    } else {
        category(building.usage, building.height, seed)
    };
    let palette = palette(category);
    let pick = palette[(random.next() * palette.len() as f32) as usize];
    let tone = 0.92 + 0.16 * random.next();
    let picked_color = [pick[0], pick[1], pick[2]];
    let hinted_color = [
        ((building.hint >> 16) & 255) as f32 / 255.0,
        ((building.hint >> 8) & 255) as f32 / 255.0,
        (building.hint & 255) as f32 / 255.0,
    ];
    let color = if glass_tower {
        linear([0.3 * tone, 0.35 * tone, 0.41 * tone])
    } else if painted {
        let has_photos = building.surfaces.iter().any(|surface| surface.uv.is_some());
        linear(if has_photos {
            hinted_color
        } else {
            paint(hinted_color)
        })
    } else {
        linear(aerial(picked_color).map(|value| (value * tone).min(1.0)))
    };
    Finish {
        category,
        color,
        layer: hinted_layer(material).unwrap_or(pick[3]),
        glass_tower,
    }
}

fn vertex(
    mesh: &mut MeshBuffers,
    p: [f32; 3],
    n: [f32; 3],
    c: [f32; 3],
    facade: [f32; 4],
    building: [f32; 4],
    photo: [f32; 2],
) {
    mesh.vertex(p, n, c, building[1]);
    mesh.facade.extend_from_slice(&facade);
    mesh.building.extend_from_slice(&building);
    mesh.photo.extend_from_slice(&photo);
}

struct BuildingMesh<'a> {
    mesh: &'a mut MeshBuffers,
    base: f32,
    floor_height: f32,
    seed: f32,
    wall_height: f32,
    category: Category,
}

#[allow(clippy::too_many_arguments)]
impl BuildingMesh<'_> {
    fn vertex(
        &mut self,
        p: [f32; 3],
        n: [f32; 3],
        color: [f32; 3],
        u: f32,
        v: f32,
        kind: f32,
        bay: f32,
        layer: f32,
    ) {
        self.photo_vertex(p, n, color, u, v, kind, bay, layer, [-1.0, -1.0]);
    }

    fn photo_vertex(
        &mut self,
        p: [f32; 3],
        n: [f32; 3],
        color: [f32; 3],
        u: f32,
        v: f32,
        kind: f32,
        bay: f32,
        layer: f32,
        photo: [f32; 2],
    ) {
        vertex(
            self.mesh,
            p,
            n,
            color,
            [u, v, self.floor_height, self.seed],
            [
                self.wall_height,
                self.category as u8 as f32 + 8.0 * layer,
                kind,
                bay,
            ],
            photo,
        );
    }

    fn triangle(
        &mut self,
        p: [f32; 3],
        mut q: [f32; 3],
        mut r: [f32; 3],
        reference: [f32; 3],
        color: [f32; 3],
        kind: f32,
        layer: f32,
    ) {
        let u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        let v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
        let mut n = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ];
        let length = n.iter().map(|value| value * value).sum::<f32>().sqrt();
        let length = if length == 0.0 { 1.0 } else { length };
        n.iter_mut().for_each(|value| *value /= length);
        if n.iter().zip(reference).map(|(a, b)| a * b).sum::<f32>() < 0.0 {
            std::mem::swap(&mut q, &mut r);
            n.iter_mut().for_each(|value| *value = -*value);
        }
        for point in [p, q, r] {
            self.vertex(point, n, color, 0.0, point[1] - self.base, kind, 0.0, layer);
        }
    }

    fn quad(
        &mut self,
        p: [f32; 3],
        q: [f32; 3],
        r: [f32; 3],
        s: [f32; 3],
        reference: [f32; 3],
        color: [f32; 3],
        kind: f32,
        layer: f32,
    ) {
        self.triangle(p, q, r, reference, color, kind, layer);
        self.triangle(p, r, s, reference, color, kind, layer);
    }

    #[allow(clippy::too_many_arguments)]
    fn equipment_box(
        &mut self,
        cx: f32,
        cz: f32,
        y0: f32,
        y1: f32,
        hx: f32,
        hz: f32,
        dx: f32,
        dz: f32,
        color: [f32; 3],
        layer: f32,
    ) {
        let point = |sx: f32, sz: f32, y: f32| {
            [
                cx + dx * hx * sx - dz * hz * sz,
                y,
                cz + dz * hx * sx + dx * hz * sz,
            ]
        };
        self.quad(
            point(-1.0, -1.0, y1),
            point(1.0, -1.0, y1),
            point(1.0, 1.0, y1),
            point(-1.0, 1.0, y1),
            [0.0, 1.0, 0.0],
            color,
            KIND_SOLID,
            layer,
        );
        self.quad(
            point(-1.0, -1.0, y0),
            point(1.0, -1.0, y0),
            point(1.0, -1.0, y1),
            point(-1.0, -1.0, y1),
            [dz, 0.0, -dx],
            color,
            KIND_SOLID,
            layer,
        );
        self.quad(
            point(-1.0, 1.0, y0),
            point(1.0, 1.0, y0),
            point(1.0, 1.0, y1),
            point(-1.0, 1.0, y1),
            [-dz, 0.0, dx],
            color,
            KIND_SOLID,
            layer,
        );
        self.quad(
            point(1.0, -1.0, y0),
            point(1.0, 1.0, y0),
            point(1.0, 1.0, y1),
            point(1.0, -1.0, y1),
            [dx, 0.0, dz],
            color,
            KIND_SOLID,
            layer,
        );
        self.quad(
            point(-1.0, -1.0, y0),
            point(-1.0, 1.0, y0),
            point(-1.0, 1.0, y1),
            point(-1.0, -1.0, y1),
            [-dx, 0.0, -dz],
            color,
            KIND_SOLID,
            layer,
        );
    }
}

fn ring_area(ring: &[Point2]) -> f32 {
    let mut sum = 0.0;
    for (index, point) in ring.iter().enumerate() {
        let next = ring[(index + 1) % ring.len()];
        sum += next.x * point.z - point.x * next.z;
    }
    sum / 2.0
}

fn inside_rings(x: f32, z: f32, rings: &[Vec<Point2>]) -> bool {
    let mut inside = false;
    for ring in rings {
        let mut previous = ring.len() - 1;
        for index in 0..ring.len() {
            let a = ring[index];
            let b = ring[previous];
            if (a.z > z) != (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x {
                inside = !inside;
            }
            previous = index;
        }
    }
    inside
}

fn edge_distance(x: f32, z: f32, rings: &[Vec<Point2>]) -> f32 {
    let mut best = f32::INFINITY;
    for ring in rings {
        for (index, a) in ring.iter().enumerate() {
            let b = ring[(index + 1) % ring.len()];
            let (dx, dz) = (b.x - a.x, b.z - a.z);
            let denominator = dx * dx + dz * dz;
            let t = (((x - a.x) * dx + (z - a.z) * dz)
                / if denominator == 0.0 { 1.0 } else { denominator })
            .clamp(0.0, 1.0);
            best = best.min((x - a.x - dx * t).hypot(z - a.z - dz * t));
        }
    }
    best
}

#[derive(Clone, Copy)]
struct Rectangle {
    cx: f32,
    cz: f32,
    ax: f32,
    az: f32,
    a: f32,
    b: f32,
    area: f32,
}

fn min_area_rect(ring: &[Point2]) -> Option<Rectangle> {
    let mut best: Option<Rectangle> = None;
    for (index, point) in ring.iter().enumerate() {
        let next = ring[(index + 1) % ring.len()];
        let (mut dx, mut dz) = (next.x - point.x, next.z - point.z);
        let length = dx.hypot(dz);
        if length < 0.5 {
            continue;
        }
        dx /= length;
        dz /= length;
        let (mut u0, mut u1) = (f32::INFINITY, f32::NEG_INFINITY);
        let (mut v0, mut v1) = (f32::INFINITY, f32::NEG_INFINITY);
        for point in ring {
            let u = point.x * dx + point.z * dz;
            let v = -point.x * dz + point.z * dx;
            u0 = u0.min(u);
            u1 = u1.max(u);
            v0 = v0.min(v);
            v1 = v1.max(v);
        }
        let area = (u1 - u0) * (v1 - v0);
        if best.is_none_or(|rect| area < rect.area) {
            let (uc, vc) = ((u0 + u1) / 2.0, (v0 + v1) / 2.0);
            let (hu, hv) = ((u1 - u0) / 2.0, (v1 - v0) / 2.0);
            best = Some(if hu >= hv {
                Rectangle {
                    cx: uc * dx - vc * dz,
                    cz: uc * dz + vc * dx,
                    ax: dx,
                    az: dz,
                    a: hu,
                    b: hv,
                    area,
                }
            } else {
                Rectangle {
                    cx: uc * dx - vc * dz,
                    cz: uc * dz + vc * dx,
                    ax: -dz,
                    az: dx,
                    a: hv,
                    b: hu,
                    area,
                }
            });
        }
    }
    best
}

fn lod2_surfaces(
    building: &Building,
    mesh: &mut MeshBuffers,
    random: &mut Random,
    seed: f32,
    finish: &Finish,
) {
    let roof_color = linear(if finish.category == Category::House {
        PITCHED_ROOFS[(random.next() * PITCHED_ROOFS.len() as f32) as usize]
    } else {
        [0.5, 0.5, 0.49]
    });
    let flat_color = linear(if finish.glass_tower {
        [0.36, 0.37, 0.39]
    } else {
        let grey = 0.5 + 0.2 * random.next();
        [grey, grey, grey * 0.97]
    });
    let wall_height = building.height;
    let floors = if building.storeys > 0 {
        building.storeys as f32
    } else {
        (wall_height / 3.2).round().max(1.0)
    };
    let mut output = BuildingMesh {
        mesh,
        base: building.base,
        floor_height: (wall_height / floors).clamp(2.5, 6.0),
        seed,
        wall_height,
        category: finish.category,
    };
    for surface in &building.surfaces {
        let Some(outline) = surface.rings.first() else {
            continue;
        };
        let mut n = [0.0; 3];
        for (index, p) in outline.iter().enumerate() {
            let q = outline[(index + 1) % outline.len()];
            n[0] += (p[1] - q[1]) * (p[2] + q[2]);
            n[1] += (p[2] - q[2]) * (p[0] + q[0]);
            n[2] += (p[0] - q[0]) * (p[1] + q[1]);
        }
        let length = n.iter().map(|value| value * value).sum::<f32>().sqrt();
        if length < 1e-6 {
            continue;
        }
        n.iter_mut().for_each(|value| *value /= length);
        let steep = n[1].abs() < 0.5;
        let horizontal = n[0].hypot(n[2]);
        let horizontal = if horizontal == 0.0 { 1.0 } else { horizontal };
        let tangent = [n[2] / horizontal, -n[0] / horizontal];
        let mut flat = Vec::new();
        let mut holes = Vec::new();
        let mut vertices = Vec::new();
        let (mut s0, mut s1) = (f32::INFINITY, f32::NEG_INFINITY);
        let (mut y0, mut y1) = (f32::INFINITY, f32::NEG_INFINITY);
        for (ring_index, ring) in surface.rings.iter().enumerate() {
            if ring_index > 0 {
                holes.push(flat.len() / 2);
            }
            for (point_index, p) in ring.iter().enumerate() {
                let s = p[0] * tangent[0] + p[2] * tangent[1];
                flat.extend_from_slice(&if steep { [s, p[1]] } else { [p[0], p[2]] });
                let uv = surface
                    .uv
                    .as_ref()
                    .map(|uv| uv[ring_index][point_index])
                    .unwrap_or([0.0, 0.0]);
                vertices.push((*p, uv, s));
                s0 = s0.min(s);
                s1 = s1.max(s);
                y0 = y0.min(p[1]);
                y1 = y1.max(p[1]);
            }
        }
        let wall = !surface.roof && steep;
        let len = s1 - s0;
        let mut bays = if wall && len >= 1.8 {
            (len / finish.category.bay()).round().max(1.0)
        } else {
            0.0
        };
        let mut bay = if bays != 0.0 { len / bays } else { 0.0 };
        let strip = wall && len < 3.0 && y1 - y0 > 2.4 && building.surfaces.len() > 150;
        if strip {
            bay = finish.category.bay();
            bays = len / bay;
            s0 = 0.0;
        }
        let kind = if wall {
            KIND_WALL
        } else if n[1] > 0.985 {
            KIND_FLAT_ROOF
        } else if steep {
            KIND_SOLID
        } else {
            KIND_PITCHED_ROOF
        };
        let color = if wall || kind == KIND_SOLID {
            finish.color
        } else if kind == KIND_FLAT_ROOF {
            flat_color
        } else {
            roof_color
        };
        let layer = if wall || kind == KIND_SOLID {
            finish.layer
        } else if kind == KIND_FLAT_ROOF {
            WALL_ROOF
        } else {
            WALL_SIDING
        };
        output.wall_height = y1 - building.base;
        let Ok(indices) = earcutr::earcut(&flat, &holes, 2) else {
            continue;
        };
        for ids in indices.as_chunks::<3>().0 {
            let mut ordered = [ids[0], ids[1], ids[2]];
            let p = vertices[ordered[0]].0;
            let q = vertices[ordered[1]].0;
            let r = vertices[ordered[2]].0;
            let u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
            let v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
            let cross = [
                u[1] * v[2] - u[2] * v[1],
                u[2] * v[0] - u[0] * v[2],
                u[0] * v[1] - u[1] * v[0],
            ];
            if cross.iter().zip(n).map(|(a, b)| a * b).sum::<f32>() < 0.0 {
                ordered.swap(1, 2);
            }
            for id in ordered {
                let (p, uv, s) = vertices[id];
                let u = if bays != 0.0 {
                    (s - s0) / len * bays
                } else {
                    0.0
                };
                // Photo roofs stay in the primary mesh until CityTileBuffers has a separate photo mesh.
                let photo = if surface.uv.is_some() && !strip {
                    uv
                } else {
                    [-1.0, -1.0]
                };
                output.photo_vertex(
                    p,
                    n,
                    color,
                    u,
                    p[1] - building.base,
                    kind,
                    bay,
                    layer,
                    photo,
                );
            }
        }
    }
}

#[derive(Clone, Copy)]
struct Front {
    x0: f32,
    z0: f32,
    len: f32,
    dx: f32,
    dz: f32,
    normal: [f32; 3],
}

fn pitched_roof(
    output: &mut BuildingMesh<'_>,
    roof: Rectangle,
    top: f32,
    wall_top: f32,
    rise: f32,
    finish: &Finish,
    random: &mut Random,
) {
    let (sx, sz, overhang) = (-roof.az, roof.ax, 0.4);
    let roof_color = PITCHED_ROOFS[(random.next() * PITCHED_ROOFS.len() as f32) as usize];
    let color = linear(aerial(roof_color).map(|value| value * 0.8));
    let eave = wall_top - overhang * rise / roof.b;
    let corner = |sa: f32, sb: f32| {
        [
            roof.cx + roof.ax * sa * (roof.a + overhang) + sx * sb * (roof.b + overhang),
            eave,
            roof.cz + roof.az * sa * (roof.a + overhang) + sz * sb * (roof.b + overhang),
        ]
    };
    let hip = random.next() < 0.5 && roof.a - roof.b > 0.3;
    let reach = if hip {
        roof.a - roof.b
    } else {
        roof.a + overhang
    };
    let r0 = [roof.cx - roof.ax * reach, top, roof.cz - roof.az * reach];
    let r1 = [roof.cx + roof.ax * reach, top, roof.cz + roof.az * reach];
    output.quad(
        corner(-1.0, 1.0),
        corner(1.0, 1.0),
        r1,
        r0,
        [0.0, 1.0, 0.0],
        color,
        KIND_PITCHED_ROOF,
        WALL_SIDING,
    );
    output.quad(
        corner(1.0, -1.0),
        corner(-1.0, -1.0),
        r0,
        r1,
        [0.0, 1.0, 0.0],
        color,
        KIND_PITCHED_ROOF,
        WALL_SIDING,
    );
    if hip {
        output.triangle(
            corner(1.0, 1.0),
            corner(1.0, -1.0),
            r1,
            [0.0, 1.0, 0.0],
            color,
            KIND_PITCHED_ROOF,
            WALL_SIDING,
        );
        output.triangle(
            corner(-1.0, -1.0),
            corner(-1.0, 1.0),
            r0,
            [0.0, 1.0, 0.0],
            color,
            KIND_PITCHED_ROOF,
            WALL_SIDING,
        );
    } else {
        for side in [-1.0, 1.0] {
            let gable = |sb: f32| {
                [
                    roof.cx + roof.ax * side * roof.a + sx * sb * roof.b,
                    wall_top,
                    roof.cz + roof.az * side * roof.a + sz * sb * roof.b,
                ]
            };
            output.triangle(
                gable(-1.0),
                gable(1.0),
                [
                    roof.cx + roof.ax * side * roof.a,
                    top,
                    roof.cz + roof.az * side * roof.a,
                ],
                [roof.ax * side, 0.0, roof.az * side],
                finish.color,
                KIND_SOLID,
                finish.layer,
            );
        }
    }
}

fn equipment_position(
    random: &mut Random,
    rings: &[Vec<Point2>],
    bounds: [f32; 4],
    half: f32,
) -> Option<Point2> {
    for _ in 0..10 {
        let x = bounds[0] + random.next() * (bounds[1] - bounds[0]);
        let z = bounds[2] + random.next() * (bounds[3] - bounds[2]);
        if inside_rings(x, z, rings) && edge_distance(x, z, rings) > half + 0.7 {
            return Some(Point2 { x, z });
        }
    }
    None
}

#[allow(clippy::too_many_arguments)]
fn rooftop_equipment(
    output: &mut BuildingMesh<'_>,
    building: &Building,
    area: f32,
    floors: f32,
    wall_top: f32,
    longest: [f32; 2],
    finish: &Finish,
    random: &mut Random,
) {
    if area <= 70.0 || building.height <= 7.0 {
        return;
    }
    let rings = &building.polygons[0];
    let outer = &rings[0];
    let mut bounds = [
        f32::INFINITY,
        f32::NEG_INFINITY,
        f32::INFINITY,
        f32::NEG_INFINITY,
    ];
    for point in outer {
        bounds[0] = bounds[0].min(point.x);
        bounds[1] = bounds[1].max(point.x);
        bounds[2] = bounds[2].min(point.z);
        bounds[3] = bounds[3].max(point.z);
    }
    let [dx, dz] = longest;
    if floors >= 4.0 && area > 110.0 {
        let hx = 1.6 + random.next() * 1.2;
        let hz = 1.5 + random.next() * 0.8;
        if let Some(p) = equipment_position(random, rings, bounds, hx.hypot(hz)) {
            output.equipment_box(
                p.x,
                p.z,
                wall_top,
                wall_top + 2.7 + random.next() * 0.9,
                hx,
                hz,
                dx,
                dz,
                finish.color,
                finish.layer,
            );
        }
    }
    let count = ((if finish.category == Category::Glass {
        5
    } else {
        7
    }) as f32)
        .min((area / 120.0).floor() + 1.0) as usize;
    let grey = linear([0.74, 0.75, 0.75]);
    for _ in 0..count {
        let equipment_type = random.next();
        if equipment_type < 0.6 {
            let units = 1 + (random.next() * 4.0).floor() as usize;
            if let Some(p) = equipment_position(random, rings, bounds, units as f32 * 0.6 + 0.3) {
                for unit in 0..units {
                    let offset = (unit as f32 - (units - 1) as f32 / 2.0) * 1.15;
                    output.equipment_box(
                        p.x + dx * offset,
                        p.z + dz * offset,
                        wall_top,
                        wall_top + 0.95,
                        0.48,
                        0.24,
                        dx,
                        dz,
                        grey,
                        WALL_SIDING,
                    );
                }
            }
        } else if equipment_type < 0.78 && finish.category != Category::Glass {
            if let Some(p) = equipment_position(random, rings, bounds, 1.3) {
                output.equipment_box(
                    p.x,
                    p.z,
                    wall_top + 0.7,
                    wall_top + 2.7,
                    1.0,
                    1.0,
                    dx,
                    dz,
                    linear([0.82, 0.82, 0.78]),
                    WALL_PLASTER,
                );
                output.equipment_box(
                    p.x,
                    p.z,
                    wall_top,
                    wall_top + 0.7,
                    0.8,
                    0.8,
                    dx,
                    dz,
                    linear([0.4, 0.4, 0.4]),
                    WALL_SIDING,
                );
            }
        } else {
            let hx = 1.0
                + random.next()
                    * if finish.category == Category::Glass {
                        4.0
                    } else {
                        1.5
                    };
            let hz = 0.7
                + random.next()
                    * if finish.category == Category::Glass {
                        3.0
                    } else {
                        0.8
                    };
            if let Some(p) = equipment_position(random, rings, bounds, hx.hypot(hz)) {
                output.equipment_box(
                    p.x,
                    p.z,
                    wall_top,
                    wall_top + 1.1 + random.next() * 1.4,
                    hx,
                    hz,
                    dx,
                    dz,
                    linear([0.6, 0.61, 0.62]),
                    WALL_SIDING,
                );
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn balconies(
    output: &mut BuildingMesh<'_>,
    building: &Building,
    floors: f32,
    wall_top: f32,
    fronts: &[Front],
    inner: [f32; 3],
    finish: &Finish,
    random: &mut Random,
) {
    if !matches!(finish.category, Category::Apartment | Category::Mixed)
        || floors < 2.0
        || fronts.is_empty()
    {
        return;
    }
    let score = |front: &Front| front.len * (0.65 + 0.35 * front.normal[2]);
    let main = fronts
        .iter()
        .reduce(|best, front| {
            if score(front) > score(best) {
                front
            } else {
                best
            }
        })
        .unwrap();
    let depth = 1.05;
    let color = if random.next() < 0.6 {
        finish.color.map(|value| value + (1.0 - value) * 0.35)
    } else {
        linear([0.5, 0.51, 0.52])
    };
    for front in fronts {
        if front.normal[0] * main.normal[0] + front.normal[2] * main.normal[2] < 0.85
            || front.len < 4.0
        {
            continue;
        }
        let inset = 0.3;
        let ax = front.x0 + front.dx * inset;
        let az = front.z0 + front.dz * inset;
        let bx = front.x0 + front.dx * (front.len - inset);
        let bz = front.z0 + front.dz * (front.len - inset);
        let ox = front.normal[0] * depth;
        let oz = front.normal[2] * depth;
        for floor in 1..floors as usize {
            let y0 = building.base + floor as f32 * output.floor_height - 0.12;
            let y1 = y0 + 1.2;
            if y1 > wall_top - 0.4 {
                break;
            }
            let a = |y: f32| [ax, y, az];
            let b = |y: f32| [bx, y, bz];
            let c = |y: f32| [bx + ox, y, bz + oz];
            let d = |y: f32| [ax + ox, y, az + oz];
            output.quad(
                a(y0),
                b(y0),
                c(y0),
                d(y0),
                [0.0, -1.0, 0.0],
                color,
                KIND_SOLID,
                WALL_PLASTER,
            );
            output.quad(
                a(y0 + 0.12),
                b(y0 + 0.12),
                c(y0 + 0.12),
                d(y0 + 0.12),
                [0.0, 1.0, 0.0],
                color,
                KIND_SOLID,
                WALL_PLASTER,
            );
            output.quad(
                d(y0),
                c(y0),
                c(y1),
                d(y1),
                front.normal,
                color,
                KIND_SOLID,
                WALL_PLASTER,
            );
            output.quad(
                d(y0),
                c(y0),
                c(y1),
                d(y1),
                [-front.normal[0], 0.0, -front.normal[2]],
                inner,
                KIND_SOLID,
                WALL_PLASTER,
            );
            output.quad(
                a(y0),
                d(y0),
                d(y1),
                a(y1),
                [-front.dx, 0.0, -front.dz],
                color,
                KIND_SOLID,
                WALL_PLASTER,
            );
            output.quad(
                b(y0),
                c(y0),
                c(y1),
                b(y1),
                [front.dx, 0.0, front.dz],
                color,
                KIND_SOLID,
                WALL_PLASTER,
            );
        }
    }
}

fn procedural(
    building: &Building,
    mesh: &mut MeshBuffers,
    random: &mut Random,
    seed: f32,
    finish: &Finish,
) {
    let top = building.base + building.height;
    let bottom = building.base - SINK;
    let outer = &building.polygons[0][0];
    let area = building
        .polygons
        .iter()
        .map(|polygon| polygon.iter().map(|ring| ring_area(ring)).sum::<f32>())
        .sum::<f32>();
    let mut roof = None;
    let mut rise = 0.0;
    if finish.category == Category::House
        && building.height < 13.0
        && building.polygons.len() == 1
        && building.polygons[0].len() == 1
        && let Some(rect) = min_area_rect(outer)
        && area / rect.area > 0.78
        && rect.b > 1.8
    {
        rise = 2.6_f32.min(rect.b * 0.5).min(building.height - 2.4);
        if rise > 0.7 {
            roof = Some(rect);
        }
    }
    let wall_top = if roof.is_some() { top - rise } else { top };
    let wall_height = wall_top - building.base;
    let parapet = if roof.is_some() {
        0.0
    } else if finish.category == Category::House {
        0.3
    } else if building.height > 30.0 {
        1.2
    } else {
        0.75
    };
    let floors = if building.storeys > 0 {
        building.storeys as f32
    } else {
        (wall_height / 3.2).round().max(1.0)
    };
    let floor_height = (wall_height / floors).clamp(2.5, 6.0);
    let mut output = BuildingMesh {
        mesh,
        base: building.base,
        floor_height,
        seed,
        wall_height,
        category: finish.category,
    };
    let inner = finish.color.map(|value| value * 0.8);
    let flat_roof = linear(if random.next() < 0.1 {
        [0.4, 0.45, 0.44]
    } else {
        let grey = 0.46 + 0.16 * random.next();
        [grey * 0.96, grey, grey * 1.04]
    });
    let mut longest = [1.0, 0.0];
    let mut longest_length = 0.0;
    let mut fronts = Vec::new();
    for polygon in &building.polygons {
        for (ring_index, ring) in polygon.iter().enumerate() {
            for (index, a) in ring.iter().enumerate() {
                let b = ring[(index + 1) % ring.len()];
                let (x0, z0, x1, z1) = (a.x, a.z, b.x, b.z);
                let length = (x1 - x0).hypot(z1 - z0);
                if length < 0.05 {
                    continue;
                }
                let (dx, dz) = ((x1 - x0) / length, (z1 - z0) / length);
                let normal = [-dz, 0.0, dx];
                let bays = if length < 1.8 {
                    0.0
                } else {
                    (length / finish.category.bay()).round().max(1.0)
                };
                let bay = if bays != 0.0 { length / bays } else { 0.0 };
                let y_top = wall_top + parapet;
                let v_top = y_top - building.base;
                let points = [
                    ([x0, bottom, z0], 0.0, -SINK),
                    ([x1, bottom, z1], bays, -SINK),
                    ([x1, y_top, z1], bays, v_top),
                    ([x0, bottom, z0], 0.0, -SINK),
                    ([x1, y_top, z1], bays, v_top),
                    ([x0, y_top, z0], 0.0, v_top),
                ];
                for (point, u, v) in points {
                    output.vertex(
                        point,
                        normal,
                        finish.color,
                        u,
                        v,
                        KIND_WALL,
                        bay,
                        finish.layer,
                    );
                }
                if parapet != 0.0 {
                    output.quad(
                        [x0, wall_top, z0],
                        [x1, wall_top, z1],
                        [x1, y_top, z1],
                        [x0, y_top, z0],
                        [dz, 0.0, -dx],
                        inner,
                        KIND_SOLID,
                        finish.layer,
                    );
                }
                if length > longest_length {
                    longest_length = length;
                    longest = [dx, dz];
                }
                if ring_index == 0 && length >= 3.5 {
                    fronts.push(Front {
                        x0,
                        z0,
                        len: length,
                        dx,
                        dz,
                        normal,
                    });
                }
            }
        }
    }
    if let Some(rect) = roof {
        pitched_roof(&mut output, rect, top, wall_top, rise, finish, random);
    } else {
        rooftop_equipment(
            &mut output,
            building,
            area,
            floors,
            wall_top,
            longest,
            finish,
            random,
        );
    }
    balconies(
        &mut output,
        building,
        floors,
        wall_top,
        &fronts,
        inner,
        finish,
        random,
    );
    if roof.is_none() {
        for polygon in &building.polygons {
            for triangle in triangulate(polygon) {
                for point in triangle {
                    output.vertex(
                        [point.x, wall_top, point.z],
                        [0.0, 1.0, 0.0],
                        flat_roof,
                        0.0,
                        wall_height,
                        KIND_FLAT_ROOF,
                        0.0,
                        WALL_ROOF,
                    );
                }
            }
        }
    }
}

pub fn photo_mesh(mesh: &MeshBuffers) -> MeshBuffers {
    let mut output = MeshBuffers::default();
    for i in 0..mesh.position.len() / 3 {
        let uv = [mesh.photo[i * 2], mesh.photo[i * 2 + 1]];
        let kind = mesh.building[i * 4 + 2];
        if uv[0] < 0.0 || (kind != KIND_FLAT_ROOF && kind != KIND_PITCHED_ROOF) {
            continue;
        }
        output
            .position
            .extend_from_slice(&mesh.position[i * 3..i * 3 + 3]);
        output
            .normal
            .extend_from_slice(&mesh.normal[i * 3..i * 3 + 3]);
        output.color.extend_from_slice(&[1.0, 1.0, 1.0]);
        output.layer.push(3.0);
        output.uv.extend_from_slice(&uv);
    }
    output
}

pub fn build(buildings: &[Building], tx: i32, tz: i32) -> MeshBuffers {
    let mut mesh = MeshBuffers::default();
    for (index, building) in buildings.iter().enumerate() {
        if building.polygons.is_empty() {
            continue;
        }
        let seed = (hash(tx, tz, index as i32) * 4096.0).floor() / 4096.0;
        let mut random = Random::new(index, tx, tz);
        let finish = finish(building, &mut random, seed);
        if building.surfaces.is_empty() {
            procedural(building, &mut mesh, &mut random, seed, &finish);
        } else {
            lod2_surfaces(building, &mut mesh, &mut random, seed, &finish);
        }
    }
    mesh
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::format::Surface;

    fn building() -> Building {
        Building {
            usage: 412,
            storeys: 3,
            base: 2.0,
            height: 12.0,
            polygons: vec![vec![vec![
                Point2 { x: 0.0, z: 0.0 },
                Point2 { x: 0.0, z: 10.0 },
                Point2 { x: 10.0, z: 10.0 },
                Point2 { x: 10.0, z: 0.0 },
            ]]],
            ..Building::default()
        }
    }

    #[test]
    fn procedural_attributes_follow_tokyo_layout_and_tile_seed() {
        let mesh = build(&[building()], 3, 7);
        assert_eq!(mesh.building[2], 0.0);
        assert!((mesh.building[3] - 10.0 / 3.0).abs() < 1e-5);
        assert_eq!(mesh.facade[0], 0.0);
        assert_eq!(mesh.facade[1], -4.0);
        let last = mesh.building.len() - 4;
        assert_eq!(mesh.building[last + 1], 41.0);
        assert_eq!(mesh.building[last + 2], 1.0);
        let other = build(&[building()], 4, 7);
        assert_ne!(mesh.facade[3], other.facade[3]);
    }

    #[test]
    fn surface_triangles_follow_newell_normal() {
        let mut b = building();
        b.surfaces.push(Surface {
            roof: true,
            rings: vec![vec![
                [0.0, 14.0, 0.0],
                [0.0, 14.0, 10.0],
                [10.0, 14.0, 10.0],
                [10.0, 14.0, 0.0],
            ]],
            uv: None,
        });
        let mesh = build(&[b], 0, 0);
        for triangle in mesh.position.as_chunks::<9>().0 {
            let u = [
                triangle[3] - triangle[0],
                triangle[4] - triangle[1],
                triangle[5] - triangle[2],
            ];
            let v = [
                triangle[6] - triangle[0],
                triangle[7] - triangle[1],
                triangle[8] - triangle[2],
            ];
            let cross_y = u[2] * v[0] - u[0] * v[2];
            assert!(cross_y >= 0.0);
        }
        assert!(
            mesh.building
                .as_chunks::<4>()
                .0
                .iter()
                .all(|b| b[1] == 41.0 && b[2] == 1.0)
        );
    }

    #[test]
    fn photo_roof_uvs_stay_in_primary_building_mesh() {
        let mut b = building();
        b.surfaces.push(Surface {
            roof: true,
            rings: vec![vec![
                [0.0, 14.0, 0.0],
                [0.0, 14.0, 10.0],
                [10.0, 14.0, 10.0],
                [10.0, 14.0, 0.0],
            ]],
            uv: Some(vec![vec![[0.0, 0.0], [0.0, 1.0], [1.0, 1.0], [1.0, 0.0]]]),
        });
        let mesh = build(&[b], 0, 0);
        assert!(!mesh.photo.is_empty());
        let roof_photo = photo_mesh(&mesh);
        assert!(!roof_photo.position.is_empty());
        assert_eq!(roof_photo.uv.len() * 3, roof_photo.position.len() * 2);
        assert!(
            mesh.photo
                .as_chunks::<2>()
                .0
                .iter()
                .all(|uv| { [[0.0, 0.0], [0.0, 1.0], [1.0, 1.0], [1.0, 0.0]].contains(uv) })
        );
        assert!(
            mesh.building
                .as_chunks::<4>()
                .0
                .iter()
                .all(|b| b[2] == KIND_FLAT_ROOF)
        );
    }
}
