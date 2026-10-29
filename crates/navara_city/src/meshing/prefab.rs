use crate::{
    buffers::{MeshBuffers, srgb_to_linear},
    format::Prefab,
};

pub fn build(prefab: &Prefab) -> MeshBuffers {
    let mut mesh = MeshBuffers::default();
    for triangle in prefab
        .positions
        .as_chunks::<9>()
        .0
        .iter()
        .zip(prefab.colors.as_chunks::<9>().0.iter())
    {
        let (positions, colors) = triangle;
        let p = &positions[0..3];
        let q = &positions[3..6];
        let r = &positions[6..9];
        let u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        let v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
        let mut n = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ];
        let length = n.iter().map(|v| v * v).sum::<f32>().sqrt().max(1e-20);
        n.iter_mut().for_each(|v| *v /= length);
        for i in 0..3 {
            let color = [
                srgb_to_linear(colors[i * 3] as f32 / 255.0),
                srgb_to_linear(colors[i * 3 + 1] as f32 / 255.0),
                srgb_to_linear(colors[i * 3 + 2] as f32 / 255.0),
            ];
            mesh.vertex(
                [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
                n,
                color,
                0.0,
            );
        }
    }
    mesh
}
