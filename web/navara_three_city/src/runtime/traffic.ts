import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { CityUniforms } from "../materials/programs";
import type { CityRoads } from "../types";

import type { CityDynamicFrame, CityDynamicSystem } from "./dynamics";
import type { CityLampLight } from "./lamplight";
import type { CityRtcFrame } from "./rtc";

const LANE = 3;
const CAR_RADIUS = 330;
const DEFAULT_CARS = 260;
const MAX_CARS = 1500;
const CYCLE = 64;
const GREEN = 27;
const LANE_CELL = 200;

type RGB = [number, number, number];
type VehicleSpec = {
  L: number;
  W: number;
  belt: number;
  roof: number;
  z0: number;
  z1: number;
  rake?: number;
  tyre?: number;
  box?: { h: number; len: number; z: number };
};
type VehicleType = {
  name: string;
  share: number;
  L: number;
  spec: VehicleSpec;
};
type RoadLane = {
  ramp: boolean;
  pts: Vector3[];
  cum: number[];
  length: number;
  from: number;
  to: number;
  n: number;
  offset: (lane: number) => number;
  speed: number;
  weight: number;
  motorway: boolean;
  raised: boolean;
  hidden: boolean;
  signal: boolean;
  edge: CityRoads["edges"][number];
  cars: Car[];
  phase: number;
  hx: number;
  hz: number;
  stop: number;
  inside: boolean;
};
type Car = {
  type: number;
  color: number;
  lane: RoadLane | null;
  next: RoadLane | null | undefined;
  s: number;
  k: number;
  v: number;
  waited: number;
};
type TrafficGraph = {
  lanes: RoadLane[];
  out: RoadLane[][];
  into: RoadLane[][];
  junction: boolean[];
  group: number[];
};

const PAINT: RGB = [1, 1, 1];
const GLASS: RGB = [0.03, 0.04, 0.05];
const TYRE: RGB = [0.015, 0.015, 0.015];
const TRIM: RGB = [0.05, 0.05, 0.055];
const LAMP: RGB = [1, 1, 1];

function finish(
  geometry: BufferGeometry,
  rgb: RGB,
  code: number,
): BufferGeometry {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (result !== geometry) geometry.dispose();
  const count = result.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const glow = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    colors.set(rgb, i * 3);
    glow[i] = code;
  }
  result.setAttribute("color", new BufferAttribute(colors, 3));
  result.setAttribute("aGlow", new BufferAttribute(glow, 1));
  result.deleteAttribute("uv");
  return result;
}

function part(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rgb: RGB,
  code = 0,
): BufferGeometry {
  return finish(new BoxGeometry(w, h, d).translate(x, y, z), rgb, code);
}

function taper(
  w0: number,
  w1: number,
  y0: number,
  y1: number,
  zA0: number,
  zB0: number,
  zA1: number,
  zB1: number,
  rgb: RGB,
  code = 0,
): BufferGeometry {
  const geometry = new BoxGeometry(1, 1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const top = position.getY(i) > 0;
    const front = position.getZ(i) > 0;
    position.setXYZ(
      i,
      position.getX(i) * (top ? w1 : w0),
      top ? y1 : y0,
      top ? (front ? zB1 : zA1) : front ? zB0 : zA0,
    );
  }
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return finish(flat, rgb, code);
}

function wheel(radius: number, x: number, z: number): BufferGeometry[] {
  return [
    finish(
      new CylinderGeometry(radius, radius, 0.24, 14)
        .rotateZ(Math.PI / 2)
        .translate(x, radius, z),
      TYRE,
      4,
    ),
    finish(
      new CylinderGeometry(radius * 0.58, radius * 0.58, 0.25, 10)
        .rotateZ(Math.PI / 2)
        .translate(x, radius, z),
      [0.55, 0.56, 0.58],
      4,
    ),
  ];
}

function vehicle(spec: VehicleSpec): BufferGeometry {
  const { L, W, belt, roof, z0, z1, box } = spec;
  const rake = spec.rake ?? 0.5;
  const tyre = spec.tyre ?? 0.31;
  const zr = -L / 2;
  const zf = L / 2;
  const sill = 0.24;
  const parts: BufferGeometry[] = [
    taper(W * 0.97, W, sill, belt, zr + 0.06, zf - 0.06, zr, zf - 0.02, PAINT),
    part(W * 1.01, 0.16, L + 0.06, 0, sill + 0.04, 0, TRIM, 4),
  ];
  const c0 = zr + z0 * L;
  const c1 = zr + z1 * L;
  const back = rake * 0.6;
  const zm = (c0 + c1) / 2;
  parts.push(
    taper(
      W * 0.9,
      W * 0.76,
      belt,
      roof,
      c0,
      c1,
      c0 + back,
      c1 - rake,
      GLASS,
      3,
    ),
    taper(
      W * 0.78,
      W * 0.72,
      roof - 0.02,
      roof + 0.05,
      c0 + back - 0.02,
      c1 - rake + 0.02,
      c0 + back + 0.1,
      c1 - rake - 0.1,
      PAINT,
    ),
  );
  if (c1 - c0 > 2.2)
    parts.push(
      taper(
        W * 0.905,
        W * 0.765,
        belt,
        roof,
        zm - 0.07,
        zm + 0.07,
        zm - 0.07,
        zm + 0.07,
        PAINT,
      ),
    );
  if (box)
    parts.push(
      part(
        W,
        box.h,
        box.len * L,
        0,
        belt + box.h / 2,
        (box.z - 0.5) * L,
        [0.92, 0.92, 0.9],
      ),
    );
  parts.push(part(W * 0.5, 0.16, 0.05, 0, belt - 0.3, zf, TRIM, 4));
  for (const z of [zf + 0.01, zr - 0.01])
    parts.push(part(0.34, 0.13, 0.03, 0, sill + 0.22, z, [0.9, 0.9, 0.86], 4));
  for (const sx of [-1, 1]) {
    const far = L > 8 ? 0.34 : 0.31;
    for (const wz of [far, -far])
      parts.push(...wheel(tyre, sx * (W / 2 - 0.1), wz * L));
    parts.push(
      part(
        0.38,
        0.15,
        0.07,
        sx * (W / 2 - 0.26),
        belt - 0.2,
        zf - 0.02,
        LAMP,
        1,
      ),
      part(
        0.36,
        0.13,
        0.07,
        sx * (W / 2 - 0.24),
        belt - 0.18,
        zr + 0.02,
        LAMP,
        2,
      ),
      part(
        0.1,
        0.1,
        0.16,
        sx * (W / 2 + 0.03),
        belt + 0.08,
        c1 - rake * 0.5,
        PAINT,
      ),
    );
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((item) => item.dispose());
  if (!geometry) throw new Error("Vehicle geometry is empty");
  return geometry;
}

export function beamTexture(): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const u = ((i + 0.5) / size) * 2 - 1;
      const v = (j + 0.5) / size;
      const side =
        1 - MathUtils.smoothstep(Math.abs(u) / Math.max(v, 0.03), 0.3, 0.98);
      const reach =
        1 - MathUtils.smoothstep(Math.hypot(u * 0.55, v), 0.55, 0.99);
      const value =
        side *
        reach *
        MathUtils.smoothstep(v, 0, 0.06) *
        (0.1 + 0.9 * Math.exp(-v * 3.4));
      data.set(
        [value * 255, value * 255, value * 255, 255],
        (j * size + i) * 4,
      );
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function beamGeometry(length: number): BufferGeometry {
  const geometry = new BufferGeometry();
  const y = 0.14;
  const position: number[] = [];
  const uv: number[] = [];
  const color: number[] = [];
  const quad = (x: number, near: number, far: number, rgb: RGB) => {
    position.push(
      -x,
      y,
      near,
      x,
      y,
      near,
      x,
      y,
      far,
      -x,
      y,
      near,
      x,
      y,
      far,
      -x,
      y,
      far,
    );
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    for (let i = 0; i < 6; i += 1) color.push(...rgb);
  };
  quad(7.5, length / 2 - 0.3, length / 2 + 24, [1, 0.95, 0.84]);
  quad(-3.2, -length / 2 + 0.3, -length / 2 - 6, [0.8, 0.05, 0.02]);
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(color, 3));
  return geometry;
}

const TYPES: VehicleType[] = [
  {
    name: "kei",
    share: 0.3,
    L: 3.4,
    spec: {
      L: 3.4,
      W: 1.48,
      belt: 1,
      roof: 1.72,
      z0: 0.12,
      z1: 0.86,
      rake: 0.42,
      tyre: 0.28,
    },
  },
  {
    name: "sedan",
    share: 0.3,
    L: 4.6,
    spec: {
      L: 4.6,
      W: 1.76,
      belt: 0.92,
      roof: 1.44,
      z0: 0.2,
      z1: 0.72,
      rake: 0.75,
    },
  },
  {
    name: "van",
    share: 0.2,
    L: 4.8,
    spec: {
      L: 4.8,
      W: 1.82,
      belt: 1.05,
      roof: 1.9,
      z0: 0.06,
      z1: 0.86,
      rake: 0.5,
    },
  },
  {
    name: "truck",
    share: 0.12,
    L: 6.2,
    spec: {
      L: 6.2,
      W: 2.1,
      belt: 1,
      roof: 2.2,
      z0: 0.74,
      z1: 0.97,
      rake: 0.18,
      tyre: 0.4,
      box: { h: 2, len: 0.68, z: 0.36 },
    },
  },
  {
    name: "bus",
    share: 0.08,
    L: 10.4,
    spec: {
      L: 10.4,
      W: 2.5,
      belt: 1.25,
      roof: 3,
      z0: 0.02,
      z1: 0.98,
      rake: 0.14,
      tyre: 0.46,
    },
  },
];
const CAR_COLORS = [
  0xd4d4d0, 0xd4d4d0, 0x111214, 0x111214, 0xa4a7ab, 0xa4a7ab, 0x6d7278,
  0x1f3a6e, 0x8c1c1c, 0xc4b68f,
];
const BUS_COLORS = [0x2e8b57, 0xe8e4d8, 0xc0392b];

export type ParkedVehicleKit = {
  models: BufferGeometry[];
  material: MeshStandardMaterial;
  colors: number[];
};

export function createParkedVehicleKit(
  uniforms: CityUniforms,
): ParkedVehicleKit {
  return {
    models: TYPES.slice(0, 3).map((type) => vehicle(type.spec)),
    material: carMaterial(uniforms, false),
    colors: [0xd4d4d0, 0x111214, 0xa4a7ab, 0x1f3a6e],
  };
}

function carMaterial(
  uniforms: CityUniforms,
  headlights = true,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.5,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uLampMap = uniforms.uLampMap;
    shader.uniforms.uLampMatrix = uniforms.uLampMatrix;
    shader.uniforms.uLampOn = uniforms.uLampOn;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aGlow; varying float vGlow; varying vec3 vCarWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vGlow = aGlow;
#ifdef USE_INSTANCING
  vCarWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vCarWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uNight; varying float vGlow; varying vec3 vCarWorld;
uniform sampler2D uLampMap; uniform mat4 uLampMatrix; uniform float uLampOn;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 lamp = vGlow > 1.5 ? vec3(0.9, 0.03, 0.02) : vec3(1.0, 0.96, 0.85);
if (vGlow > 0.5 && vGlow < 2.5) diffuseColor.rgb = lamp * 0.6;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = vGlow > 3.5 ? 0.85 : vGlow > 2.5 ? 0.06 : roughnessFactor;",
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor = vGlow > 3.5 ? 0.0 : vGlow > 2.5 ? 0.9 : metalnessFactor;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
if (${headlights ? "true" : "false"} && vGlow > 0.5 && vGlow < 2.5) totalEmissiveRadiance += lamp * (0.15 + uNight * (vGlow > 1.5 ? 5.0 : 3.6));
totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.72) * (0.28 * uNight);
if (uLampOn > 0.01) {
  vec4 lampClip = uLampMatrix * vec4(vCarWorld, 1.0);
  vec2 lampUv = lampClip.xy / lampClip.w * 0.5 + 0.5;
  if (all(greaterThan(lampUv, vec2(0.0))) && all(lessThan(lampUv, vec2(1.0)))) {
    totalEmissiveRadiance += diffuseColor.rgb * texture2D(uLampMap, lampUv).rgb * uLampOn * 1.4;
  }
}`,
      );
  };
  material.customProgramCacheKey = () =>
    `navara-city-car-v3-${headlights ? "lit" : "parked"}`;
  return material;
}

function buildGraph(
  roads: CityRoads,
  surface: (x: number, z: number) => number,
): TrafficGraph {
  const signalled = new Set(roads.signals);
  const out = roads.nodes.map(() => [] as RoadLane[]);
  const into = roads.nodes.map(() => [] as RoadLane[]);
  const lanes: RoadLane[] = [];
  for (const edge of roads.edges) {
    if (edge.highway === "service" && edge.lanes <= 1) continue;
    const points: Vector3[] = [];
    for (let i = 0; i < edge.pts.length; i += 3)
      points.push(new Vector3(edge.pts[i], edge.pts[i + 1], edge.pts[i + 2]));
    const minor = [
      "residential",
      "unclassified",
      "living_street",
      "service",
    ].includes(edge.highway);
    const speed = Math.min(
      15,
      Math.max(4.5, (edge.maxspeed * (minor ? 0.6 : 0.8)) / 3.6),
    );
    const weight = edge.highway.startsWith("motorway")
      ? 5
      : ["trunk", "primary"].includes(edge.highway)
        ? 4
        : ["secondary", "tertiary"].includes(edge.highway)
          ? 2.5
          : 1;
    for (const forward of [true, false]) {
      if (forward ? edge.oneway === -1 : edge.oneway === 1) continue;
      const pts = forward ? points : [...points].reverse();
      const cum = [0];
      for (let i = 1; i < pts.length; i += 1)
        cum.push(
          cum[i - 1] +
            Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
        );
      const length = cum[cum.length - 1];
      if (length < 1) continue;
      const n = edge.oneway
        ? Math.max(1, edge.lanes)
        : Math.max(1, Math.floor(edge.lanes / 2));
      const offset = (k: number) =>
        edge.oneway
          ? (k - (n - 1) / 2) * LANE
          : edge.lanes >= 2
            ? -(k + 0.5) * LANE
            : -1.15;
      let ramp = false;
      if (
        !edge.flyover &&
        !edge.span &&
        !edge.tunnel &&
        edge.highway.startsWith("motorway")
      ) {
        for (let i = 1; i < pts.length && !ramp; i += 1) {
          for (
            let s = 0;
            s <= 1;
            s += Math.min(1, 3 / (cum[i] - cum[i - 1] || 1))
          ) {
            const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * s;
            const z = pts[i - 1].z + (pts[i].z - pts[i - 1].z) * s;
            if (
              pts[i - 1].y + (pts[i].y - pts[i - 1].y) * s - surface(x, z) >
              1.5
            ) {
              ramp = true;
              break;
            }
          }
        }
      }
      const lane: RoadLane = {
        ramp,
        pts,
        cum,
        length,
        from: forward ? edge.a : edge.b,
        to: forward ? edge.b : edge.a,
        n,
        offset,
        speed,
        weight,
        motorway: edge.highway.startsWith("motorway"),
        raised: Boolean(edge.flyover),
        hidden: Boolean(edge.tunnel),
        signal: signalled.has(forward ? edge.b : edge.a),
        edge,
        cars: [],
        phase: 0,
        hx: 0,
        hz: 0,
        stop: 0,
        inside: false,
      };
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const facing =
        (Math.atan2(-(b.x - a.x), -(b.z - a.z)) + Math.PI * 2) % (Math.PI * 2);
      lane.phase = Math.round(facing / (Math.PI / 2)) % 2;
      const lengthXZ = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      lane.hx = (b.x - a.x) / lengthXZ;
      lane.hz = (b.z - a.z) / lengthXZ;
      lanes.push(lane);
      out[lane.from].push(lane);
      into[lane.to].push(lane);
    }
  }
  const junction = roads.nodes.map(
    (_, i) =>
      new Set([...out[i], ...into[i]].map((lane) => lane.edge)).size >= 3,
  );
  const group = roads.nodes.map((_, i) => i);
  const find = (i: number): number => {
    while (group[i] !== i) {
      group[i] = group[group[i]];
      i = group[i];
    }
    return i;
  };
  for (const lane of lanes)
    if (lane.length < 26 && junction[lane.from] && junction[lane.to])
      group[find(lane.from)] = find(lane.to);
  roads.nodes.forEach((_, i) => {
    group[i] = find(i);
  });
  for (const lane of lanes) {
    lane.inside = group[lane.from] === group[lane.to] && junction[lane.to];
    if (lane.inside) lane.signal = false;
  }
  const reach = roads.nodes.map(() => 0);
  for (const lane of lanes) {
    const half =
      ((lane.edge.oneway ? lane.n : Math.max(1, lane.edge.lanes)) * LANE) / 2;
    reach[lane.to] = Math.max(reach[lane.to], half);
    reach[lane.from] = Math.max(reach[lane.from], half);
  }
  for (const lane of lanes)
    lane.stop = Math.min(reach[lane.to] + 5.5, lane.length * 0.45);
  return { lanes, out, into, junction, group };
}

const tmp = new Vector3();
const tmp2 = new Vector3();
function along(
  lane: RoadLane,
  s: number,
  position: Vector3,
  direction: Vector3,
): void {
  const { pts, cum } = lane;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const t = Math.min(1, Math.max(0, (s - cum[lo]) / (cum[hi] - cum[lo] || 1)));
  position.lerpVectors(pts[lo], pts[hi], t);
  direction.subVectors(pts[hi], pts[lo]);
  direction.multiplyScalar(1 / (Math.hypot(direction.x, direction.z) || 1));
}

export class CityTraffic implements CityDynamicSystem {
  readonly group = new Group();
  readonly lamps = new Group();
  count: number;
  private graph: TrafficGraph;
  private crossing: {
    lane: RoadLane | null;
    until: number;
    straight: boolean;
  }[];
  private cars: Car[] = [];
  private fleets: { mesh: InstancedMesh; beams: InstancedMesh }[] = [];
  private material: MeshStandardMaterial;
  private beam;
  private texture: DataTexture;
  private seed = 12345;
  private now = 0;
  private headlights = 5;
  private radius = CAR_RADIUS;
  private lanesByCell?: Map<string, RoadLane[]>;
  private dummy = new Object3D();
  private color = new Color();
  private matrix = new Matrix4();

  constructor(
    roads: CityRoads,
    private surface: (x: number, z: number) => number,
    private rtc: CityRtcFrame,
    uniforms: CityUniforms,
    lampLight: CityLampLight,
    applyShadow: (material: Material) => void,
    count = DEFAULT_CARS,
  ) {
    this.group.name = "traffic";
    this.lamps.name = "traffic-headlights";
    this.count = MathUtils.clamp(Math.round(count), 0, MAX_CARS);
    this.graph = buildGraph(roads, surface);
    this.crossing = roads.nodes.map(() => ({
      lane: null,
      until: 0,
      straight: false,
    }));
    this.dummy.rotation.order = "YXZ";
    this.material = carMaterial(uniforms);
    applyShadow(this.material);
    this.texture = beamTexture();
    this.beam = lampLight.createMaterial(this.texture, true);
    lampLight.add(this.lamps);
    for (const type of TYPES) {
      const capacity = Math.ceil(MAX_CARS * type.share * 1.25) + 8;
      const mesh = new InstancedMesh(
        vehicle(type.spec),
        this.material,
        capacity,
      );
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      const beams = new InstancedMesh(
        beamGeometry(type.L),
        this.beam,
        capacity,
      );
      beams.instanceMatrix = mesh.instanceMatrix;
      beams.frustumCulled = false;
      beams.count = 0;
      this.group.add(mesh);
      this.lamps.add(beams);
      this.fleets.push({ mesh, beams });
    }
  }

  setCount(count: number | undefined): void {
    this.count = MathUtils.clamp(
      Math.round(count ?? DEFAULT_CARS),
      0,
      MAX_CARS,
    );
  }

  setEnabled(enabled: boolean): void {
    this.group.visible = enabled;
    this.lamps.visible = enabled;
  }

  setHeadlights(value = 5): void {
    this.headlights = MathUtils.clamp(value, 0, 20);
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private pick(
    focus: { x: number; z: number },
    radius: number,
    filter: (lane: RoadLane) => boolean,
  ): RoadLane | null {
    let best: RoadLane | null = null;
    let bestKey = -1;
    if (!this.lanesByCell) {
      this.lanesByCell = new Map();
      for (const lane of this.graph.lanes) {
        const middle = lane.pts[lane.pts.length >> 1];
        const key = `${Math.floor(middle.x / LANE_CELL)},${Math.floor(middle.z / LANE_CELL)}`;
        const list = this.lanesByCell.get(key) ?? [];
        list.push(lane);
        this.lanesByCell.set(key, list);
      }
    }
    for (
      let cx = Math.floor((focus.x - radius) / LANE_CELL);
      cx <= Math.floor((focus.x + radius) / LANE_CELL);
      cx += 1
    ) {
      for (
        let cz = Math.floor((focus.z - radius) / LANE_CELL);
        cz <= Math.floor((focus.z + radius) / LANE_CELL);
        cz += 1
      ) {
        for (const lane of this.lanesByCell.get(`${cx},${cz}`) ?? []) {
          if (!filter(lane)) continue;
          const middle = lane.pts[lane.pts.length >> 1];
          if (Math.hypot(middle.x - focus.x, middle.z - focus.z) > radius)
            continue;
          const key =
            this.rnd() **
            (1 /
              (lane.weight *
                Math.min(lane.length, 120) *
                lane.n *
                (lane.motorway ? 5 : 1)));
          if (key > bestKey) {
            bestKey = key;
            best = lane;
          }
        }
      }
    }
    return best;
  }

  private spawnCar(car: Car, focus: { x: number; z: number }): boolean {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const lane = this.pick(
        focus,
        this.radius,
        (candidate) => !candidate.hidden && candidate.length > 20,
      );
      if (!lane) return false;
      const s = 8 + this.rnd() * (lane.length - 16);
      if (
        lane.cars.some((other) => other !== car && Math.abs(other.s - s) < 16)
      )
        continue;
      if (car.lane) car.lane.cars.splice(car.lane.cars.indexOf(car), 1);
      car.lane = lane;
      car.s = s;
      car.k = Math.floor(this.rnd() * lane.n);
      car.v = lane.speed * 0.5;
      car.next = undefined;
      car.waited = 0;
      lane.cars.push(car);
      return true;
    }
    return false;
  }

  private chooseNext(lane: RoadLane): RoadLane | null {
    const a = lane.pts[lane.pts.length - 2];
    const b = lane.pts[lane.pts.length - 1];
    const hx = b.x - a.x;
    const hz = b.z - a.z;
    const hl = Math.hypot(hx, hz) || 1;
    let next: RoadLane | null = null;
    let key = -1;
    for (const candidate of this.graph.out[lane.to]) {
      if (candidate.edge === lane.edge) continue;
      const ox = candidate.pts[1].x - candidate.pts[0].x;
      const oz = candidate.pts[1].z - candidate.pts[0].z;
      const ol = Math.hypot(ox, oz) || 1;
      const straight = (hx * ox + hz * oz) / (hl * ol);
      if (straight < -0.6) continue;
      const candidateKey =
        this.rnd() **
        (1 / (candidate.weight * (0.4 + Math.max(0, straight) * 1.6)));
      if (candidateKey > key) {
        key = candidateKey;
        next = candidate;
      }
    }
    return next;
  }

  private mayCross(car: Car, lane: RoadLane, toEnd: number): boolean {
    const node = lane.to;
    const crossing = this.crossing[this.graph.group[node]];
    const next = car.next;
    const straight = next
      ? lane.hx * (next.pts[1].x - next.pts[0].x) +
          lane.hz * (next.pts[1].z - next.pts[0].z) >
        0.8 * (next.cum[1] || 1)
      : false;
    if (crossing.lane && crossing.lane !== lane && this.now < crossing.until) {
      const oncoming =
        lane.hx * crossing.lane.hx + lane.hz * crossing.lane.hz < -0.8;
      if (!(oncoming && straight && crossing.straight)) return false;
    }
    if (!lane.signal) {
      for (const other of this.graph.into[node]) {
        if (
          other === lane ||
          other.edge === lane.edge ||
          other.weight <= lane.weight
        )
          continue;
        for (const otherCar of other.cars)
          if (
            otherCar.v > 0.5 &&
            (other.length - otherCar.s) / Math.max(otherCar.v, 2) < 4.5
          )
            return false;
      }
    }
    const until = this.now + toEnd / Math.max(car.v, 2) + 3.5;
    if (crossing.lane === lane && this.now < crossing.until) {
      crossing.until = Math.max(crossing.until, until);
      crossing.straight = crossing.straight && straight;
    } else {
      crossing.lane = lane;
      crossing.until = until;
      crossing.straight = straight;
    }
    return true;
  }

  private stopLight(lane: RoadLane): boolean {
    return lane.signal && (this.now + lane.phase * 32) % CYCLE > GREEN;
  }

  update(frame: CityDynamicFrame): void {
    const { dt, focus } = frame;
    this.now = frame.time;
    if (!this.group.visible) {
      this.fleets.forEach((fleet) => {
        fleet.mesh.count = 0;
        fleet.beams.count = 0;
      });
      return;
    }
    this.radius =
      CAR_RADIUS *
      Math.min(2.4, Math.max(1, Math.sqrt(this.count / DEFAULT_CARS)));
    while (this.cars.length > this.count) {
      const gone = this.cars.pop();
      if (gone?.lane) gone.lane.cars.splice(gone.lane.cars.indexOf(gone), 1);
    }
    while (this.cars.length < this.count) {
      const random = this.rnd();
      let accumulated = 0;
      let type = 0;
      for (let i = 0; i < TYPES.length; i += 1) {
        accumulated += TYPES[i].share;
        if (random < accumulated) {
          type = i;
          break;
        }
      }
      const palette = TYPES[type].name === "bus" ? BUS_COLORS : CAR_COLORS;
      const car: Car = {
        type,
        color: palette[Math.floor(this.rnd() * palette.length)],
        lane: null,
        next: undefined,
        s: 0,
        k: 0,
        v: 0,
        waited: 0,
      };
      if (!this.spawnCar(car, focus)) break;
      this.cars.push(car);
    }
    const counts = this.fleets.map(() => 0);
    const { junction, into } = this.graph;
    for (const car of this.cars) {
      if (!car.lane && !this.spawnCar(car, focus)) continue;
      const lane = car.lane;
      if (!lane) continue;
      const length = TYPES[car.type].L;
      if (car.next === undefined) car.next = this.chooseNext(lane);
      const next = car.next;
      const toEnd = lane.length - car.s - length / 2;
      let gap = Infinity;
      let lead = 0;
      const kNext = next ? Math.min(car.k, next.n - 1) : car.k;
      for (const other of lane.cars) {
        if (other === car) continue;
        const merging =
          next &&
          toEnd < 35 &&
          other.k !== car.k &&
          Math.min(other.k, next.n - 1) === kNext &&
          other.next === next;
        if (
          other.k === car.k
            ? other.s <= car.s
            : !(
                merging &&
                (other.s > car.s + 0.5 ||
                  (Math.abs(other.s - car.s) <= 0.5 && other.k < car.k))
              )
        )
          continue;
        const distance = other.s - car.s - (TYPES[other.type].L + length) / 2;
        if (distance < gap) {
          gap = Math.max(distance, 0);
          lead = other.v;
        }
      }
      let roomAhead = true;
      if (next) {
        for (const other of next.cars) {
          if (other.k !== kNext) continue;
          const distance = toEnd + other.s - TYPES[other.type].L / 2;
          if (distance < gap) {
            gap = distance;
            lead = other.v;
          }
          if (other.s < TYPES[other.type].L / 2 + length + 3) roomAhead = false;
        }
      }
      const stopAt = toEnd - lane.stop;
      const braking = (car.v * car.v) / 7 + 5;
      const past = stopAt < -1;
      let hold =
        !lane.inside &&
        !past &&
        (this.stopLight(lane) || (junction[lane.to] && !roomAhead));
      const giveWay =
        junction[lane.to] &&
        !lane.signal &&
        into[lane.to].some(
          (other) => other.edge !== lane.edge && other.weight > lane.weight,
        );
      if (!hold && !lane.inside && junction[lane.to] && stopAt < braking + 8)
        hold = !this.mayCross(car, lane, toEnd) && !past;
      if (hold && stopAt < gap) {
        gap = Math.max(0, stopAt);
        lead = 0;
      }
      let want = lane.speed * (toEnd < 14 ? 0.55 : 1);
      if (giveWay && toEnd < 14) want = Math.min(want, 1.2 + toEnd * 0.35);
      if (gap < Infinity)
        want = Math.min(want, Math.max(0, lead + (gap - 2.5) / 1.4));
      if (gap < 0.6) want = 0;
      car.v = Math.max(
        0,
        car.v + MathUtils.clamp(want - car.v, -6 * dt, 2.2 * dt),
      );
      car.s += car.v * dt;
      car.waited = car.v < 0.2 ? car.waited + dt : 0;
      if (
        car.waited > 45 &&
        !this.stopLight(lane) &&
        !this.spawnCar(car, focus)
      )
        continue;
      if (car.lane === lane && car.s >= lane.length) {
        lane.cars.splice(lane.cars.indexOf(car), 1);
        const crossing = this.crossing[this.graph.group[lane.to]];
        if (crossing.lane === lane)
          crossing.until = Math.max(
            crossing.until,
            this.now +
              2.2 +
              (next?.inside ? next.length / Math.max(car.v, 3) : 0),
          );
        if (next) {
          car.lane = next;
          car.s -= lane.length;
          car.k = Math.min(car.k, next.n - 1);
          car.next = undefined;
          next.cars.push(car);
        } else {
          car.lane = null;
          if (!this.spawnCar(car, focus)) continue;
        }
      }
      if (!car.lane) continue;
      along(car.lane, car.s, tmp, tmp2);
      if (Math.hypot(tmp.x - focus.x, tmp.z - focus.z) > this.radius + 90) {
        if (!this.spawnCar(car, focus) || !car.lane) continue;
        along(car.lane, car.s, tmp, tmp2);
      }
      if (car.lane.hidden) continue;
      const offset = car.lane.offset(car.k);
      const px = tmp.x - tmp2.z * offset;
      const pz = tmp.z + tmp2.x * offset;
      const fleet = this.fleets[car.type];
      if (counts[car.type] >= fleet.mesh.instanceMatrix.count) continue;
      const index = counts[car.type]++;
      const onRamp = car.lane.ramp && tmp.y > this.surface(px, pz) + 0.03;
      this.dummy.position.set(
        px,
        car.lane.raised || onRamp ? tmp.y + 0.04 : this.surface(px, pz) + 0.07,
        pz,
      );
      const slope =
        car.lane.raised || onRamp
          ? tmp2.y
          : (this.surface(px + tmp2.x * 5, pz + tmp2.z * 5) -
              this.surface(px - tmp2.x * 5, pz - tmp2.z * 5)) /
            10;
      this.dummy.rotation.set(-Math.atan(slope), Math.atan2(tmp2.x, tmp2.z), 0);
      this.rtc.matrix(
        this.dummy.position,
        this.dummy.quaternion,
        this.dummy.scale,
        this.matrix,
      );
      fleet.mesh.setMatrixAt(index, this.matrix);
      fleet.mesh.setColorAt(index, this.color.setHex(car.color));
    }
    this.beam.color.setScalar(0.36 * this.headlights * frame.night);
    this.beam.visible = frame.night > 0.02;
    this.fleets.forEach((fleet, index) => {
      fleet.mesh.count = fleet.beams.count = counts[index];
      fleet.mesh.instanceMatrix.needsUpdate = true;
      if (fleet.mesh.instanceColor) fleet.mesh.instanceColor.needsUpdate = true;
    });
  }

  dispose(): void {
    for (const fleet of this.fleets) {
      fleet.mesh.geometry.dispose();
      fleet.beams.geometry.dispose();
    }
    this.fleets = [];
    this.material.dispose();
    this.texture.dispose();
    this.lamps.removeFromParent();
    this.group.clear();
    for (const lane of this.graph.lanes) lane.cars.length = 0;
    this.cars = [];
  }
}
