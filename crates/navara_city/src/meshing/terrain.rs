use crate::{buffers::MeshBuffers, meshing::HeightGrid};

pub fn build(grid: HeightGrid<'_>, tx: i32, tz: i32, tile_size: f32) -> MeshBuffers {
    let segments = (tile_size / grid.step).ceil() as usize;
    let n = segments + 1;
    let step = tile_size / segments as f32;
    let mut mesh = MeshBuffers::default();
    for j in 0..n {
        for i in 0..n {
            let x = tx as f32 * tile_size + i as f32 * step;
            let z = tz as f32 * tile_size + j as f32 * step;
            mesh.vertex([x, grid.sample(x, z), z], grid.normal(x, z), [1.0; 3], 0.0);
        }
    }
    for j in 0..segments {
        for i in 0..segments {
            let a = (j * n + i) as u32;
            let b = a + 1;
            let c = a + n as u32;
            let d = c + 1;
            mesh.index.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    mesh
}
