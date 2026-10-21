# @navaramap/three-api — GIS Math Reference

Standalone engine-free GIS utilities. All functions are **re-exported from `@navaramap/three`** (preferred when the engine is present — no `initNavaraApi()` needed since `ThreeView.init()` initializes the WASM internally). When using the standalone package directly, call `await initNavaraApi()` once before any other function.

Degrees in, degrees out, heights/ranges in meters, positions in ECEF meters (Three.js `Vector3`), unless stated otherwise.

```ts
type LatLngHeight = { lat: number; lng: number; height: number }; // degrees / meters
type LatLng = { lat: number; lng: number };                       // degrees
type GeographicExtent = { west: number; south: number; east: number; north: number }; // degrees
type HeightRange = { min: number; max: number };                  // meters, ellipsoid-relative
type WindowObject = { width: number; height: number; pixelRatio: number };
```

## Initialization

```ts
async function initNavaraApi(): Promise<void>; // standalone package only
```

## Ellipsoid (WGS84)

| Function | Returns |
|---|---|
| `getWGS84SemiMajorAxis(): number` | `6378137` m |
| `getWGS84SemiMinorAxis(): number` | `6356752.314245` m |
| `getWGS84EccentricitySquared(): number` | |
| `getWGS84Flattening(): number` | |
| `getWGS84Eccentricity(): number` | |

## Coordinate transforms

| Function | Signature | Notes |
|---|---|---|
| `geodeticToVector3` | `(lle: LatLngHeight): Vector3` | Geodetic → ECEF |
| `vector3ToGeodetic` | `(xyz: Vector3): LatLngHeight` | ECEF → geodetic |
| `degreeToRadian` / `radianToDegree` | `(n: number): number` | Public API angles are degrees; radians only for Three.js Euler math |
| `geodeticSurfaceNormal` | `(lle: LatLngHeight): Vector3` | Normalized |

## Tangent frames (ECEF origin → 4×4 Matrix4)

| Function | Axes (x, y, z) | Up | glTF Y-up correction needed |
|---|---|---|---|
| `eastNorthUpToFixedFrame(origin)` | E, N, Up | Z | `Rx(+90°)` |
| `northEastDownToFixedFrame(origin)` | N, E, Down | −Z | yes |
| `northUpEastToFixedFrame(origin)` | N, Up, E | Y | no (asset faces **east** at 0 rotation) |
| `northWestUpToFixedFrame(origin)` | N, W, Up | Z | `Rx(+90°)` |
| `westUpNorthToFixedFrame(origin)` | W, Up, N | Y | **no** (matches glTF on all axes) |
| `headingPitchRollToFixedFrame(placement)` | WUN frame + HPR + scale | Y | no |

```ts
function headingPitchRollToFixedFrame(placement: {
  lng: number;            // required, degrees
  lat: number;            // required, degrees
  height?: number;        // meters above ellipsoid, default 0
  heading?: number;       // degrees CW from north the glTF +Z front faces, default 0
  pitch?: number;         // degrees, nose up positive
  roll?: number;          // degrees, right wing down positive
  scale?: number;         // uniform or per-axis, default 1
}): Matrix4;
// heightReference is deliberately NOT a parameter (needs a view to sample terrain) — use a mesh Descriptor's geodetic.heightReference instead
```

The single call that turns a geographic placement into a world matrix. Models ported from other globe engines may need a multiple of 90° added to `heading` (front-axis conventions differ).

## Screen ↔ world

```ts
function convertScreenToWorld(windowObject: WindowObject, camera: PerspectiveCamera, vec2: Vector2): Vector3 | undefined;
function convertWorldToScreen(windowObject: WindowObject, camera: PerspectiveCamera, worldPos: Vector3): Vector2 | undefined; // undefined outside frustum
function getPickRay(windowObject: WindowObject, camera: PerspectiveCamera, vec2: Vector2): Ray;
```

## Ray casting

```ts
function getPlaneFromPointNormal(point: Vector3, normal: Vector3): Plane;
function getRayPlaneIntersection(ray: Ray, plane: Plane): Vector3 | undefined;
function getHeightFromEllipsoid(point: Vector3): number; // ECEF → height in meters
```

Typical click-to-ground pattern: `getPickRay(window, camera, new Vector2(e.clientX, e.clientY))` → plane at `{origin, normal: (0,0,1)}` → `getRayPlaneIntersection` → `getHeightFromEllipsoid`.

## RTE (Relative-To-Eye) rendering

GPU double-precision emulation: positions split into `high` + `low` float parts.

| Function | Signature | Notes |
|---|---|---|
| `encodePositionRTE` | `(original: Vector3, resultHigh?: Vector3, resultLow?: Vector3): { high: Vector3; low: Vector3 }` | Optional out params avoid GC |
| `calcModelMatrixRTE` | `(objectMatrixWorld: Matrix4, matrixWorldInverse: Matrix4, result?: Matrix4): Matrix4` | Translation zeroed |
| `calcCameraPosition` | `(cameraPosition: Vector3, modelMatrixWorld: Matrix4): { high: Vector3; low: Vector3 }` | For `cameraPositionHigh/Low` uniforms |
| `composeWorldMatrixForRTE` | `(frameMatrix: Matrix4, localMatrix: Matrix4, resultPosition?: Vector3, resultRotationScale?: Matrix4): { position: Vector3; rotationScale: Matrix4 }` | Compose frame+local, split translation (→ RTE uniforms) from rotation/scale (→ `mesh.matrixWorld`) |

## EllipsoidGeodesic

```ts
const geodesic = new EllipsoidGeodesic(start: LatLngHeight, end: LatLngHeight);
geodesic.distance: number;        // meters
geodesic.converged: boolean;      // false ≈ antipodal: distance approximate, interpolations snap to endpoints
geodesic.startHeading / endHeading: number; // degrees
geodesic.start / end: LatLngHeight;
geodesic.interpolatePoints(granularity?: number): LatLngHeight[]; // granularity meters between points
geodesic.interpolateDistance(distance: number): LatLngHeight;     // point at distance from start
geodesic.dispose(): void;         // releases WASM memory — call when done
```

Full-cycle example:

```ts
import { EllipsoidGeodesic, geodeticToVector3 } from "@navaramap/three";

const g = new EllipsoidGeodesic({ lat: 35.6762, lng: 139.6503, height: 0 }, { lat: 34.6937, lng: 135.5023, height: 0 });
console.log((g.distance / 1000).toFixed(1), "km,", g.startHeading.toFixed(1), "°");
const points = g.interpolatePoints(10_000).map(geodeticToVector3); // → BufferGeometry.setFromPoints
g.dispose();
```

## Feature geometry builders

Vertex-data builders for custom mesh Descriptors (the engine behind `PolygonMeshDesc` / `PolylineMeshDesc` — prefer those descriptors for one-off shapes). Result positions are RTE-encoded.

| Function | Signature | Returns |
|---|---|---|
| `buildPolygonGeometry` | `(rings: readonly Float64Array[], geocentric: boolean, material: PolygonGeometryMaterial): PolygonGeometryData \| undefined` | `undefined` when outer ring < 3 vertices or collinear; throws on invalid material |
| `buildPolylineGeometry` | `(positions: Float64Array, geocentric: boolean, ring: boolean, material: PolylineGeometryMaterial): PolylineGeometryData \| undefined` | `undefined` when < 2 distinct positions |
| `polygonGroundVolume` | `(range: HeightRange, extent: GeographicExtent): [number, number]` | Height span a clamped polygon volume needs to enclose ground heights `range` |
| `polylineGroundVolume` | `(range: HeightRange, extent: GeographicExtent): [number, number]` | Same for clamped polylines |

- Flat arrays: `[lng, lat, height, ...]` in degrees/meters, or `[x, y, z, ...]` ECEF meters when `geocentric: true`. Rings: outer first, then holes.
- `material` is the corresponding layer material (`polygon` / `polyline`, see [reference-materials.md](reference-materials.md)) as a plain object with colors as numbers; `clampToGround`, `height`, `perPositionHeight` shape geometry; outline options ignored.
- `PolygonGeometryData`: `positionHigh`, `positionLow`, `normal` (absent when clamped), `scaleNormalAndCap` (`xyz` extrusion dir, `w` 0 bottom / 1 top cap), `indices`, `extent` (degrees).
