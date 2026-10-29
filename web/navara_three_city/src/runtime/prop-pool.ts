import {
  BufferGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type Material,
} from "three";

export type PropPoolInstance = {
  matrix: Matrix4;
  color?: Color;
  attributes?: Record<string, number[]>;
};

type PoolEntry = Omit<PropPoolInstance, "matrix"> & {
  matrix: Float32Array;
  active: boolean;
};
export type PropPoolShare = { pool: InstancePool; entry: PoolEntry };

type InstancePoolOptions = {
  geometry: BufferGeometry;
  material: Material;
  shadow: boolean;
  attributes?: Record<string, number>;
};

const BUCKET_SIZE = 4096;

function bucketKey(matrix: Matrix4): string {
  const { elements } = matrix;
  const x = elements[12];
  const z = elements[14];
  return `${Math.round(x / BUCKET_SIZE)}:${Math.round(z / BUCKET_SIZE)}`;
}

class InstancePool {
  readonly mesh: InstancedMesh;
  private geometry: BufferGeometry;
  private ownedGeometry: boolean;
  private entries: PoolEntry[] = [];
  private dirty = false;
  private capacity = 0;
  private scratchMatrix = new Matrix4();

  constructor(private options: InstancePoolOptions) {
    this.ownedGeometry = options.attributes !== undefined;
    this.geometry = this.ownedGeometry
      ? options.geometry.clone()
      : options.geometry;
    this.mesh = new InstancedMesh(this.geometry, options.material, 0);
    this.mesh.count = 0;
    this.mesh.castShadow = options.shadow;
    this.mesh.receiveShadow = options.shadow;
    this.mesh.frustumCulled = true;
  }

  add(instance: PropPoolInstance): PropPoolShare {
    const matrix = new Float32Array(16);
    matrix.set(instance.matrix.elements);
    const entry = { ...instance, matrix, active: true };
    this.entries.push(entry);
    this.dirty = true;
    return { pool: this, entry };
  }

  remove(share: PropPoolShare): void {
    const index = this.entries.indexOf(share.entry);
    if (index < 0) return;
    this.entries.splice(index, 1);
    this.dirty = true;
  }

  setActive(share: PropPoolShare, active: boolean): void {
    if (share.entry.active === active) return;
    share.entry.active = active;
    this.dirty = true;
  }

  get empty(): boolean {
    return this.entries.length === 0;
  }

  sync(): void {
    if (!this.dirty) return;
    const active = this.entries.filter((entry) => entry.active);
    if (this.entries.length > this.capacity)
      this.resize(Math.ceil(this.entries.length * 1.5));
    else if (this.capacity > 8 && this.entries.length * 2 < this.capacity)
      this.resize(Math.max(1, Math.ceil(this.entries.length * 1.25)));
    this.mesh.count = active.length;
    active.forEach((entry, index) => {
      this.scratchMatrix.fromArray(entry.matrix);
      this.mesh.setMatrixAt(index, this.scratchMatrix);
      if (entry.color) this.mesh.setColorAt(index, entry.color);
      for (const [name, values] of Object.entries(entry.attributes ?? {})) {
        const attribute = this.geometry.getAttribute(name);
        values.forEach(
          (value, offset) =>
            (attribute.array[index * attribute.itemSize + offset] = value),
        );
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const name of Object.keys(this.options.attributes ?? {})) {
      const attribute = this.geometry.getAttribute(name);
      attribute.needsUpdate = true;
    }
    this.mesh.computeBoundingSphere();
    this.dirty = false;
  }

  private resize(capacity: number): void {
    this.capacity = Math.max(1, capacity);
    this.mesh.instanceMatrix.dispose();
    this.mesh.instanceMatrix = new InstancedBufferAttribute(
      new Float32Array(this.capacity * 16),
      16,
    );
    this.mesh.instanceColor?.dispose();
    this.mesh.instanceColor = null;
    if (this.entries.some((entry) => entry.color)) {
      this.mesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(this.capacity * 3),
        3,
      );
    }
    for (const [name, size] of Object.entries(this.options.attributes ?? {})) {
      this.geometry.setAttribute(
        name,
        new InstancedBufferAttribute(
          new Float32Array(this.capacity * size),
          size,
        ),
      );
    }
  }

  dispose(): void {
    this.mesh.dispose();
    this.mesh.removeFromParent();
    if (this.ownedGeometry) this.geometry.dispose();
    this.entries = [];
  }
}

export class PropPoolSet {
  readonly group = new Group();
  readonly pools = new Group();
  private items = new Map<string, Map<string, InstancePool>>();

  constructor() {
    this.group.name = "city-global-props";
    this.pools.name = "city-global-lamp-pools";
  }

  add(
    key: string,
    options: InstancePoolOptions,
    instance: PropPoolInstance,
    lamp = false,
  ): PropPoolShare {
    let buckets = this.items.get(key);
    if (!buckets) {
      buckets = new Map<string, InstancePool>();
      this.items.set(key, buckets);
    }
    const bucket = bucketKey(instance.matrix);
    let pool = buckets.get(bucket);
    if (!pool) {
      pool = new InstancePool(options);
      buckets.set(bucket, pool);
      (lamp ? this.pools : this.group).add(pool.mesh);
    }
    return pool.add(instance);
  }

  setActive(share: PropPoolShare, active: boolean): void {
    share.pool.setActive(share, active);
  }

  remove(share: PropPoolShare): void {
    share.pool.remove(share);
  }

  sync(): void {
    for (const buckets of this.items.values()) {
      for (const [bucket, pool] of buckets) {
        if (pool.empty) {
          pool.dispose();
          buckets.delete(bucket);
        } else {
          pool.sync();
        }
      }
    }
  }

  dispose(): void {
    for (const buckets of this.items.values())
      for (const pool of buckets.values()) pool.dispose();
    this.items.clear();
    this.group.removeFromParent();
    this.pools.removeFromParent();
  }
}
