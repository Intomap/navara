import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
} from "three";
import { describe, expect, it, vi } from "vitest";

import { PropPoolSet } from "../runtime/prop-pool";

describe("city prop pool", () => {
  it("batches, grows, recolors and removes shares idempotently", () => {
    const pools = new PropPoolSet();
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const options = { geometry, material, shadow: true };
    const a = pools.add("same", options, {
      matrix: new Matrix4(),
      color: new Color(1, 0, 0),
    });
    const b = pools.add("same", options, {
      matrix: new Matrix4().makeTranslation(4, 0, 0),
      color: new Color(0, 1, 0),
    });
    pools.sync();
    expect(pools.group.children).toHaveLength(1);
    const mesh = pools.group.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("pool mesh missing");
    expect(mesh.count).toBe(2);
    expect(mesh.instanceMatrix.array.length).toBe(48);
    expect(mesh.instanceMatrix.array[28]).toBe(4);
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.boundingSphere?.radius).toBeGreaterThan(0);
    if (!mesh.instanceColor) throw new Error("pool colors missing");
    expect(Array.from(mesh.instanceColor.array.slice(0, 6))).toEqual([
      1, 0, 0, 0, 1, 0,
    ]);
    const update = mesh.instanceMatrix.needsUpdate;
    pools.sync();
    expect(mesh.instanceMatrix.needsUpdate).toBe(update);
    pools.remove(a);
    pools.remove(a);
    pools.sync();
    expect(mesh.count).toBe(1);
    pools.remove(b);
    pools.sync();
    expect(pools.group.children).toHaveLength(0);
    geometry.dispose();
    material.dispose();
  });

  it("shrinks instance buffers after entries are removed", () => {
    const pools = new PropPoolSet();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    const shares = Array.from({ length: 20 }, () =>
      pools.add(
        "same",
        { geometry, material, shadow: true },
        {
          matrix: new Matrix4(),
        },
      ),
    );
    pools.sync();
    const mesh = pools.group.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("pool mesh missing");
    const grown = mesh.instanceMatrix.array.length;
    shares.slice(0, 16).forEach((share) => pools.remove(share));
    pools.sync();
    expect(mesh.instanceMatrix.array.length).toBeLessThan(grown);
    expect(mesh.instanceMatrix.array.length).toBeGreaterThanOrEqual(16);
    pools.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("splits distant instances into separately culled spatial buckets", () => {
    const pools = new PropPoolSet();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    const options = { geometry, material, shadow: true };
    pools.add("same", options, { matrix: new Matrix4() });
    pools.add("same", options, {
      matrix: new Matrix4().makeTranslation(6000, 0, 0),
    });
    pools.sync();
    expect(pools.group.children).toHaveLength(2);
    const centers = pools.group.children.map((child) => {
      if (!(child instanceof InstancedMesh))
        throw new Error("pool mesh missing");
      return child.boundingSphere?.center.x ?? 0;
    });
    expect(centers[1] - centers[0]).toBe(6000);
    pools.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("keeps per-instance attributes local to each bucket geometry", () => {
    const pools = new PropPoolSet();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    pools.add(
      "signal",
      { geometry, material, shadow: false, attributes: { aLens: 2 } },
      { matrix: new Matrix4(), attributes: { aLens: [1, 0] } },
    );
    pools.add(
      "signal",
      { geometry, material, shadow: false, attributes: { aLens: 2 } },
      {
        matrix: new Matrix4().makeTranslation(6000, 0, 0),
        attributes: { aLens: [2, 1] },
      },
    );
    pools.sync();
    const values = pools.group.children.map((child) => {
      if (!(child instanceof InstancedMesh))
        throw new Error("pool mesh missing");
      return Array.from(child.geometry.getAttribute("aLens").array);
    });
    expect(values).toEqual([
      [1, 0, 0, 0],
      [2, 1, 0, 0],
    ]);
    expect(geometry.getAttribute("aLens")).toBeUndefined();
    const dispose = vi.spyOn(geometry, "dispose");
    pools.dispose();
    expect(dispose).not.toHaveBeenCalled();
    geometry.dispose();
    material.dispose();
  });

  it("detaches both roots and releases mesh buffers on disposal", () => {
    const pools = new PropPoolSet();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    pools.add(
      "item",
      { geometry, material, shadow: false },
      { matrix: new Matrix4() },
    );
    pools.sync();
    const mesh = pools.group.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("pool mesh missing");
    const dispose = vi.spyOn(mesh, "dispose");
    pools.dispose();
    pools.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(pools.group.children).toHaveLength(0);
    geometry.dispose();
    material.dispose();
  });
});
