# Shared Types Reference

Types used across multiple modules. All angles in **degrees** unless marked radians; all lengths in **meters**; ECEF = cartesian meters.

```ts
// Geographic
type LatLng = { lat: number; lng: number };                       // degrees
type LatLngHeight = { lat: number; lng: number; height: number }; // degrees / meters above ellipsoid
type GeographicExtent = { west: number; south: number; east: number; north: number }; // degrees; west ≤ east (no antimeridian in some APIs)
type HeightRange = { min: number; max: number };                  // meters, ellipsoid-relative

// Cartesian
type Vec2 = { x: number; y: number };
type XYZ = { x: number; y: number; z: number };                   // ECEF when used as a world position

// Camera
type CameraPosition = {
  lng?: number; lat?: number;        // degrees
  height?: number;                   // camera altitude; OR target elevation when `distance` is set
  pitch?: number;                    // degrees, negative = down (valid −180..0)
  heading?: number;                  // degrees CW from north
  roll?: number;                     // degrees
  distance?: number;                 // meters from target along forward ray; when set, camera is placed at that distance from lng/lat/height
};
type FlyToOptions = { duration?: number /* ms, 0 = jump */; maxHeight?: number /* m */; easing?: "linear" | "quadInOut" | "cubicInOut" | "cubicOut" | "quinticInOut" };

// Mesh placement (mesh Descriptor base `geodetic` field)
type GeodeticPlacement = {
  lng: number; lat: number;          // required, degrees
  height?: number;                   // default 0; meaning depends on heightReference
  heading?: number;                  // default 0; degrees CW from north; bearing of the glTF +Z front
  pitch?: number;                    // default 0; nose up positive
  roll?: number;                     // default 0; right wing down positive
  scale?: number;                    // default 1; scales the frame (also scales position offsets)
  heightReference?: "ellipsoid" | "terrain"; // default "ellipsoid"; "terrain" → height is meters ABOVE terrain
};

// Picking
type PickedFeature = {
  batchId: number;                   // unique within a feature set only
  properties?: Record<string, unknown>;
  layerId?: string;
};
type MapPointerEvent = { map: { x: number; y: number; z: number } } & PointerEvent; // map = ECEF on globe surface

// Feature evaluator
type FeatureInfo = { batchId: number; properties?: Record<string, unknown>; layerId?: string };
type FeatureEvaluatorCallback = (info: FeatureInfo) => Partial<EvaluatedValue>;
```

`EvaluatedValue` (all optional, per-feature overrides) → table in [api-threeview.md](api-threeview.md#featureevaluator).

## Color

Navara `Color` — construct empty, then set: `new Color().setStyle("#00aaff")` / `.setHex(0xff0000)` / `.setRGB(r,g,b)` (sRGB 0–1) / `.setRGBLinear(...)`. Chainable. Some descriptor fields take a **plain hex number** instead of a `Color` — flagged per field in the reference tables (convert with `color.toHex()`).

## Layer / handle types

| Type | Returned by | Update semantics | Members |
|---|---|---|---|
| `Source` | `addSource()` | `update(desc)` partial but requires `type` (+`url`); reloads referencing layers | `id`, `type`, `update()`, `delete(): boolean` (ref-counted) |
| `Layer` | `addLayer()` | `update(desc)` **partial merge** (omitted materials/fields preserved — the JSDoc claiming full replacement is outdated) | `id`, `update()`, `delete(): void`, `forceUpdate()`, feature events (`featureCreated`, `featureUpdated`, `featureVisibilityChanged`, `featureRemoved`, `deleted`) |
| `MeshHandle<L>` / `LightHandle<L>` / `EffectHandle<L>` (extends `BaseHandle`) | `addMesh()` / `addLight()` / `addEffect()` | `update(updates)` **partial** | `id`, `visible` (get/set), `ref: L` (descriptor instance — per-descriptor methods), `update()`, `delete(): void`, `on("deleted")` |

`SourceRef` = `Source | string` (handle or its id). All handles are invalid after `delete()`. **Descriptor events live on `handle.ref`, not the handle** — mesh/light/effect handles only emit `deleted`; descriptor-specific events (`load`, `error`, `animationReady` on GLTF/splat descs) are subscribed via `handle.ref.on(...)`.

## Descriptor config envelope

Any `addMesh`/`addLight`/`addEffect` description:

```ts
{
  id?: string; visible?: boolean;          // base fields
  // placement (mesh only) — at most ONE of:
  position?: XYZ; rotation?: XYZ /* radians */; scale?: XYZ;
  matrix?: Matrix4; matrixWorld?: Matrix4; geodetic?: GeodeticPlacement;
  lit?: boolean;                           // three-state lighting override (undefined = follow view.lit)
  pickable?: boolean;                      // mesh only, most shape descriptors
  <descriptorKey>: { ...descriptorConfig } // exactly one key per add call
}
```

`matrix` / `matrixWorld` / `geodetic` are mutually exclusive — combining throws `ConflictingTransformError`. With no frame set, `position`/`rotation`/`scale` apply in raw ECEF (a bare `position` will NOT stand a mesh upright at a location — use `geodetic`).
