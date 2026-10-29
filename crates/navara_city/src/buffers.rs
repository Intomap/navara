use std::collections::HashMap;

use serde::Serialize;

use crate::projection::{RtcCenter, local_normal_to_ecef};

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MeshBuffers {
    pub position: Vec<f32>,
    pub local: Vec<f32>,
    pub normal: Vec<f32>,
    pub color: Vec<f32>,
    pub layer: Vec<f32>,
    pub light: Vec<f32>,
    pub facade: Vec<f32>,
    pub building: Vec<f32>,
    pub photo: Vec<f32>,
    pub uv: Vec<f32>,
    pub index: Vec<u32>,
}

impl MeshBuffers {
    pub fn vertex(&mut self, p: [f32; 3], n: [f32; 3], color: [f32; 3], layer: f32) {
        self.position.extend_from_slice(&p);
        self.normal.extend_from_slice(&n);
        self.color.extend_from_slice(&color);
        self.layer.push(layer);
    }

    pub fn project(&mut self, center: &RtcCenter) {
        self.local = self.position.clone();
        let source = std::mem::take(&mut self.position);
        self.position.reserve(source.len());
        for (i, p) in source.as_chunks::<3>().0.iter().enumerate() {
            let projected = center.project([p[0] as f64, p[1] as f64, p[2] as f64]);
            self.position.extend_from_slice(&projected.position);
            if self.normal.len() == source.len() {
                let n = &self.normal[i * 3..i * 3 + 3];
                let transformed = local_normal_to_ecef(
                    [n[0] as f64, n[1] as f64, n[2] as f64],
                    projected.geographic,
                );
                self.normal[i * 3..i * 3 + 3].copy_from_slice(&transformed);
            }
        }
    }

    /// Weld identical vertices into an indexed mesh. Lossless: the emitted
    /// triangles are exactly those already present in the non-indexed soup,
    /// only shared vertices are deduplicated. Two vertices are identical when
    /// every per-vertex attribute is bit-for-bit equal (so flat-shaded facets
    /// keep their distinct normals). The source `local` coordinates carry the
    /// exact city-frame identity and therefore anchor the deduplication.
    pub fn weld(&mut self) {
        let vertex_count = self.position.len() / 3;
        if vertex_count == 0 || !self.index.is_empty() {
            return;
        }
        let attributes: [(&[f32], usize); 10] = [
            (self.local.as_slice(), 3),
            (self.position.as_slice(), 3),
            (self.normal.as_slice(), 3),
            (self.color.as_slice(), 3),
            (self.layer.as_slice(), 1),
            (self.light.as_slice(), 1),
            (self.facade.as_slice(), 4),
            (self.building.as_slice(), 4),
            (self.photo.as_slice(), 2),
            (self.uv.as_slice(), 2),
        ];
        let active: Vec<(&[f32], usize)> = attributes
            .into_iter()
            .filter(|(values, stride)| values.len() == vertex_count * stride)
            .collect();
        if active.is_empty() {
            return;
        }
        let key_len: usize = active.iter().map(|(_, stride)| stride).sum();
        let mut remap = vec![0u32; vertex_count];
        let mut kept: Vec<u32> = Vec::with_capacity(vertex_count);
        let mut map: HashMap<Vec<u8>, u32> = HashMap::with_capacity(vertex_count);
        for vertex in 0..vertex_count {
            let mut key = Vec::with_capacity(key_len * 4);
            for (values, stride) in &active {
                let start = vertex * stride;
                for value in &values[start..start + stride] {
                    key.extend_from_slice(&value.to_bits().to_le_bytes());
                }
            }
            if let Some(&unique) = map.get(&key) {
                remap[vertex] = unique;
            } else {
                let unique = kept.len() as u32;
                kept.push(vertex as u32);
                map.insert(key, unique);
                remap[vertex] = unique;
            }
        }
        self.index = remap;
        self.position = rebuild(&self.position, &kept, 3);
        self.local = rebuild(&self.local, &kept, 3);
        self.normal = rebuild(&self.normal, &kept, 3);
        self.color = rebuild(&self.color, &kept, 3);
        self.layer = rebuild(&self.layer, &kept, 1);
        self.light = rebuild(&self.light, &kept, 1);
        self.facade = rebuild(&self.facade, &kept, 4);
        self.building = rebuild(&self.building, &kept, 4);
        self.photo = rebuild(&self.photo, &kept, 2);
        self.uv = rebuild(&self.uv, &kept, 2);
    }

    /// A simplified copy of an indexed mesh that drops triangles whose area is
    /// below `min_area`. Intended for the distant LOD, where such triangles are
    /// far smaller than a pixel; near geometry keeps the full mesh.
    pub fn thin(&self, min_area: f32) -> MeshBuffers {
        if self.index.is_empty() {
            return self.clone();
        }
        let triangle_count = self.index.len() / 3;
        let mut keep_triangles = Vec::with_capacity(triangle_count);
        for triangle in 0..triangle_count {
            let (a, b, c) = (
                self.index[triangle * 3] as usize,
                self.index[triangle * 3 + 1] as usize,
                self.index[triangle * 3 + 2] as usize,
            );
            if triangle_area(self, a, b, c) >= min_area {
                keep_triangles.push(triangle as u32);
            }
        }
        if keep_triangles.len() == triangle_count {
            return self.clone();
        }
        // Remap the vertices still referenced by kept triangles.
        let mut used = vec![false; self.position.len() / 3];
        let mut remap = vec![0u32; self.position.len() / 3];
        let mut kept_vertices: Vec<u32> = Vec::new();
        for &triangle in &keep_triangles {
            for vertex in [
                self.index[triangle as usize * 3],
                self.index[triangle as usize * 3 + 1],
                self.index[triangle as usize * 3 + 2],
            ] {
                let v = vertex as usize;
                if !used[v] {
                    used[v] = true;
                    remap[v] = kept_vertices.len() as u32;
                    kept_vertices.push(vertex);
                }
            }
        }
        let mut index = Vec::with_capacity(keep_triangles.len() * 3);
        for &triangle in &keep_triangles {
            for vertex in [
                self.index[triangle as usize * 3],
                self.index[triangle as usize * 3 + 1],
                self.index[triangle as usize * 3 + 2],
            ] {
                index.push(remap[vertex as usize]);
            }
        }
        MeshBuffers {
            position: rebuild(&self.position, &kept_vertices, 3),
            local: rebuild(&self.local, &kept_vertices, 3),
            normal: rebuild(&self.normal, &kept_vertices, 3),
            color: rebuild(&self.color, &kept_vertices, 3),
            layer: rebuild(&self.layer, &kept_vertices, 1),
            light: rebuild(&self.light, &kept_vertices, 1),
            facade: rebuild(&self.facade, &kept_vertices, 4),
            building: rebuild(&self.building, &kept_vertices, 4),
            photo: rebuild(&self.photo, &kept_vertices, 2),
            uv: rebuild(&self.uv, &kept_vertices, 2),
            index,
        }
    }
}

/// Selects the values of `kept` vertices (each `stride` floats apart).
fn rebuild(values: &[f32], kept: &[u32], stride: usize) -> Vec<f32> {
    if values.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(kept.len() * stride);
    for &vertex in kept {
        let start = vertex as usize * stride;
        out.extend_from_slice(&values[start..start + stride]);
    }
    out
}

/// Twice the signed area of the triangle `(a, b, c)` in local coordinates.
fn triangle_area(mesh: &MeshBuffers, a: usize, b: usize, c: usize) -> f32 {
    let frame = if mesh.local.len() == mesh.position.len() {
        &mesh.local
    } else {
        &mesh.position
    };
    let p = |i: usize| [frame[i * 3], frame[i * 3 + 1], frame[i * 3 + 2]];
    let (a, b, c) = (p(a), p(b), p(c));
    let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    0.5 * cross.iter().map(|x| x * x).sum::<f32>().sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn soup(positions: &[[f32; 3]]) -> MeshBuffers {
        let mut mesh = MeshBuffers::default();
        for position in positions {
            mesh.vertex(*position, [0.0, 1.0, 0.0], [1.0, 1.0, 1.0], 0.0);
        }
        mesh.local = mesh.position.clone();
        mesh.light = vec![0.0; positions.len()];
        mesh
    }

    #[test]
    fn weld_dedupes_shared_vertices_without_changing_triangles() {
        // A quad split into two triangles; corners 0 and 2 are shared.
        let mut mesh = soup(&[
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [0.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
        ]);
        mesh.weld();
        assert_eq!(mesh.position.len() / 3, 4, "shared corners deduplicated");
        assert_eq!(mesh.index, vec![0, 1, 2, 0, 2, 3]);
        // Idempotent: a second weld leaves the indexed mesh untouched.
        let index = mesh.index.clone();
        mesh.weld();
        assert_eq!(mesh.index, index);
    }

    #[test]
    fn weld_keeps_flat_facets_apart_by_normal() {
        // Two triangles sharing a position but with different normals stay apart.
        let mut mesh = MeshBuffers::default();
        mesh.vertex([0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0], 0.0);
        mesh.vertex([1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0], 0.0);
        mesh.vertex([0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0], 0.0);
        mesh.vertex([0.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], 0.0);
        mesh.vertex([1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], 0.0);
        mesh.vertex([0.0, 1.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], 0.0);
        mesh.local = mesh.position.clone();
        mesh.light = vec![0.0; 6];
        mesh.weld();
        assert_eq!(
            mesh.position.len() / 3,
            6,
            "distinct normals keep vertices apart"
        );
    }

    #[test]
    fn thin_drops_small_triangles_and_keeps_large_ones() {
        // One large triangle (area 0.5) and one tiny (area 0.02).
        let mut mesh = soup(&[
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.2, 0.0, 0.0],
            [0.0, 0.2, 0.0],
        ]);
        mesh.weld();
        let thin = mesh.thin(0.1);
        assert_eq!(thin.index.len() / 3, 1, "only the large triangle survives");
        assert_eq!(thin.position.len() / 3, 3);
        // The surviving triangle still matches the original large triangle.
        assert_eq!(
            &thin.position[..],
            &mesh.position[..9],
            "large triangle vertices are preserved"
        );
    }
}

#[derive(Debug, Clone, Default)]
pub struct CityTileBuffers {
    pub rtc: [f64; 3],
    pub terrain: MeshBuffers,
    pub ground: MeshBuffers,
    pub paint: MeshBuffers,
    pub decals: MeshBuffers,
    pub buildings: MeshBuffers,
    pub buildings_lod1: MeshBuffers,
    pub prefab: MeshBuffers,
    pub prefab_lod1: MeshBuffers,
    pub photo: MeshBuffers,
    pub walls: MeshBuffers,
    pub wires: Vec<f32>,
    pub prop_matrices: Vec<f32>,
    pub prop_metadata: Vec<f32>,
    pub tree_count: u32,
    pub signs: Vec<CitySign>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct CitySign {
    pub position: [f32; 3],
    pub normal: [f32; 3],
    pub width: f32,
    pub height: f32,
    pub style: u8,
    pub color: u8,
    pub text: String,
}

pub fn srgb_to_linear(value: f32) -> f32 {
    if value <= 0.04045 {
        value / 12.92
    } else {
        ((value + 0.055) / 1.055).powf(2.4)
    }
}
