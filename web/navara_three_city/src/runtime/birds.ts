import {
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MathUtils,
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
} from "three";

import type { CityUniforms } from "../materials/programs";

import type { CityDynamicFrame, CityDynamicSystem } from "./dynamics";

export const MAX_BIRDS = 2000;
const FLOCK = 14;
const FLOCKS = Math.ceil(MAX_BIRDS / FLOCK);
const SPAN = 3.2;
const LAND = 13;
const TAKE_OFF = 9;
const CRUISE = 28;

type FlockState = {
  state: "new" | "fly" | "land" | "perched" | "takeoff";
  timer: number;
  perch: number;
  rate: number;
  anchor: Vector3;
  target: Vector3 | null;
};

function birdGeometry(): InstancedBufferGeometry {
  const positions: number[] = [];
  const wings: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => {
    for (const [x, y, z, wing] of [a, b, c]) {
      positions.push(x, y, z);
      wings.push(wing);
    }
  };
  const half = SPAN / 2;
  triangle([0, 0, 0.42, 0], [0.09, 0, -0.1, 0], [-0.09, 0, -0.1, 0]);
  triangle([0.09, 0, -0.1, 0], [0, 0, -0.5, 0], [-0.09, 0, -0.1, 0]);
  for (const side of [-1, 1]) {
    triangle(
      [side * 0.06, 0, 0.2, 0],
      [side * half * 0.5, 0, 0.16, 0.5],
      [side * 0.06, 0, -0.16, 0],
    );
    triangle(
      [side * half * 0.5, 0, 0.16, 0.5],
      [side * half * 0.5, 0, -0.1, 0.5],
      [side * 0.06, 0, -0.16, 0],
    );
    triangle(
      [side * half * 0.5, 0, 0.16, 0.5],
      [side * half, 0, -0.02, 1],
      [side * half * 0.5, 0, -0.1, 0.5],
    );
  }
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aWing", new Float32BufferAttribute(wings, 1));
  const seed = new Float32Array(MAX_BIRDS * 4);
  for (let i = 0; i < MAX_BIRDS; i += 1)
    seed.set(
      [Math.floor(i / FLOCK), Math.random(), Math.random(), Math.random()],
      i * 4,
    );
  geometry.setAttribute("aSeed", new InstancedBufferAttribute(seed, 4));
  geometry.instanceCount = 0;
  return geometry;
}

const VERTEX_SHADER = `
#define PIGEONS 1.0
attribute float aWing;
attribute vec4 aSeed;
uniform float uTime;
uniform sampler2D uFlocks;
uniform vec3 uCityEast;
uniform vec3 uCityNorth;
uniform vec3 uCityUp;
varying float vShade;
varying float vCrow;
varying vec3 vBirdView;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float aloft(float perch) {
  float b = clamp(perch * 1.4 - 0.4 * aSeed.w, 0.0, 1.0);
  return 1.0 - b * b * (3.0 - 2.0 * b);
}
vec3 place(float t, vec4 flock, float perch) {
  float f = aSeed.x;
  float air = aloft(perch);
  vec2 reach = 45.0 + 170.0 * vec2(hash(f + 1.0), hash(f + 5.0));
  vec3 c = vec3(
    reach.x * sin(t * (0.05 + 0.06 * hash(f + 8.0)) + 6.28 * hash(f + 2.0)),
    22.0 + 230.0 * pow(hash(f + 3.0), 2.0) + 14.0 * sin(t * 0.05 + 6.28 * hash(f + 4.0)),
    reach.y * sin(t * (0.05 + 0.06 * hash(f + 10.0)) + 6.28 * hash(f + 6.0)));
  float radius = 8.0 + 55.0 * aSeed.y;
  float turn = (0.5 + aSeed.z) * 4.5 / radius * (hash(f + 7.0) < 0.5 ? -1.0 : 1.0);
  float a = t * turn + 6.28 * aSeed.w;
  vec3 own = vec3(cos(a) * radius, 9.0 * sin(t * 0.21 + 6.28 * aSeed.z) + 50.0 * (aSeed.w - 0.5), sin(a) * radius * 0.8);
  own.y = max(own.y, 4.0 - c.y);
  vec3 twig = (vec3(aSeed.y, aSeed.z, aSeed.w) - 0.5) * vec3(3.0, 2.0, 3.0);
  return flock.xyz + mix(twig, c + own, air);
}
void main() {
  float u = (aSeed.x + 0.5) / ${FLOCKS}.0;
  vec4 flock = texture2D(uFlocks, vec2(u, 0.25));
  float rate = texture2D(uFlocks, vec2(u, 0.75)).x;
  vec3 p = place(uTime, flock, flock.w);
  vec3 ahead = place(uTime + 0.25, flock, clamp(flock.w + rate * 0.25, 0.0, 1.0));
  vec3 fwd = normalize(ahead - p + vec3(0.0, 0.0, 1e-4));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  float beat = smoothstep(-0.2, 0.3, sin(uTime * 0.35 + 6.28 * aSeed.y));
  float crow = step(PIGEONS, hash(aSeed.x + 9.0));
  float lift = mix(0.18, sin(uTime * mix(8.0, 4.5, crow) * (0.85 + 0.3 * aSeed.z) + 6.28 * aSeed.w), beat) * 0.55;
  vec3 local = position * mix(0.7, 1.0, crow) * max(smoothstep(0.0, 0.05, aloft(flock.w)), 0.3);
  vCrow = crow;
  local.y += abs(local.x) * lift * aWing;
  local.x *= 1.0 - 0.22 * abs(lift) * aWing;
  vec3 enu = p + right * local.x + up * local.y + fwd * local.z;
  vec3 rtc = uCityEast * enu.x + uCityUp * enu.y - uCityNorth * enu.z;
  vBirdView = (modelViewMatrix * vec4(rtc, 1.0)).xyz;
  vShade = 0.75 + 0.25 * aWing;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rtc, 1.0);
}`;

export class CityBirds implements CityDynamicSystem {
  readonly group = new Group();
  private geometry = birdGeometry();
  private data = new Float32Array(FLOCKS * 2 * 4);
  private flockTexture = new DataTexture(
    this.data,
    FLOCKS,
    2,
    RGBAFormat,
    FloatType,
  );
  /** Main pass material. The view wires it into the MRT G-buffer. */
  readonly material: ShaderMaterial;
  private depth: ShaderMaterial;
  private mesh: Mesh;
  private flocks: FlockState[];
  private count: number;

  constructor(
    uniforms: CityUniforms,
    private ground: (x: number, z: number) => number,
    private roosts: () => number[][],
    count = 72,
  ) {
    this.group.name = "birds";
    this.count = MathUtils.clamp(Math.round(count), 0, MAX_BIRDS);
    this.flockTexture.minFilter = this.flockTexture.magFilter = NearestFilter;
    const shaderUniforms = {
      uTime: uniforms.uTime,
      uDark: uniforms.uNight,
      uFlocks: { value: this.flockTexture },
      uCityEast: uniforms.uCityEast,
      uCityNorth: uniforms.uCityNorth,
      uCityUp: uniforms.uCityUp,
    };
    this.material = new ShaderMaterial({
      side: DoubleSide,
      uniforms: shaderUniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: `
uniform float uDark;
varying float vShade;
varying float vCrow;
varying vec3 vBirdView;
void main() {
  vec3 fdx = dFdx(vBirdView), fdy = dFdy(vBirdView);
  vec3 normal = normalize(cross(fdx, fdy));
  if (normal.z < 0.0) normal = -normal;
  gl_FragColor = vec4(mix(vec3(0.82, 0.82, 0.84), vec3(0.03, 0.03, 0.035), vCrow) * vShade * mix(1.0, 0.5, uDark), 1.0);
}`,
    });
    this.depth = new ShaderMaterial({
      side: DoubleSide,
      uniforms: shaderUniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: `#include <packing>
void main() { gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.customDepthMaterial = this.depth;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.name = "birds";
    this.group.add(this.mesh);
    this.flocks = Array.from({ length: FLOCKS }, () => ({
      state: "new",
      timer: 0,
      perch: 0,
      rate: 0,
      anchor: new Vector3(),
      target: null,
    }));
    this.setCount(this.count);
  }

  setCount(count: number): void {
    this.count = MathUtils.clamp(Math.round(count), 0, MAX_BIRDS);
    this.geometry.instanceCount = this.count;
    this.group.visible = this.count > 0;
  }

  update(frame: CityDynamicFrame): void {
    if (this.count === 0 || !this.group.visible) return;
    const reach = MathUtils.clamp(frame.viewDistance * 0.7, 120, 650);
    const tiles = this.roosts().filter((roosts) => roosts.length > 0);
    const pickTree = (): Vector3 | null => {
      for (let attempt = 0; attempt < 12 && tiles.length; attempt += 1) {
        const roosts = tiles[Math.floor(Math.random() * tiles.length)];
        const index = Math.floor(Math.random() * (roosts.length / 3)) * 3;
        if (
          Math.hypot(
            roosts[index] - frame.focus.x,
            roosts[index + 2] - frame.focus.z,
          ) < reach
        )
          return new Vector3(
            roosts[index],
            roosts[index + 1],
            roosts[index + 2],
          );
      }
      return null;
    };
    const far = (point: Vector3) =>
      Math.hypot(point.x - frame.focus.x, point.z - frame.focus.z) >
      reach * 1.5;
    const count = Math.ceil(this.count / FLOCK);
    for (let i = 0; i < count; i += 1) {
      const flock = this.flocks[i];
      flock.rate = 0;
      if (flock.state === "new") {
        flock.target = pickTree();
        flock.anchor.copy(
          flock.target ??
            new Vector3(
              frame.focus.x + (Math.random() * 2 - 1) * reach * 0.6,
              this.ground(frame.focus.x, frame.focus.z) + 12,
              frame.focus.z + (Math.random() * 2 - 1) * reach * 0.6,
            ),
        );
        if (flock.target && Math.random() < 0.18) {
          flock.state = "perched";
          flock.perch = 1;
          flock.timer = 2 + Math.random() * 18;
        } else {
          flock.state = "fly";
          flock.perch = 0;
          flock.timer = 8 + Math.random() * 62;
        }
      } else if (flock.state === "fly") {
        flock.timer -= frame.dt;
        if (!flock.target || far(flock.target))
          flock.target = pickTree() ?? flock.target;
        if (flock.target) {
          const distance = flock.anchor.distanceTo(flock.target);
          if (distance > 0.01)
            flock.anchor.lerp(
              flock.target,
              Math.min(1, (CRUISE * frame.dt) / distance),
            );
          else if (flock.timer <= 0) flock.state = "land";
        }
      } else if (flock.state === "land") {
        flock.rate = 1 / LAND;
        flock.perch += frame.dt / LAND;
        if (flock.perch >= 1) {
          flock.perch = 1;
          flock.state = "perched";
          flock.timer = 6 + Math.random() * 20;
        }
      } else if (flock.state === "perched") {
        flock.timer -= frame.dt;
        if (far(flock.anchor)) {
          const tree = pickTree();
          if (tree) {
            flock.target = tree;
            flock.anchor.copy(tree);
          }
        }
        if (flock.timer <= 0) flock.state = "takeoff";
      } else {
        flock.rate = -1 / TAKE_OFF;
        flock.perch -= frame.dt / TAKE_OFF;
        if (flock.perch <= 0) {
          flock.perch = 0;
          flock.state = "fly";
          flock.timer = 30 + Math.random() * 55;
        }
      }
      this.data.set(
        [flock.anchor.x, flock.anchor.y, flock.anchor.z, flock.perch],
        i * 4,
      );
      this.data[(FLOCKS + i) * 4] = flock.rate;
    }
    this.flockTexture.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.depth.dispose();
    this.flockTexture.dispose();
    this.group.clear();
    this.flocks = [];
  }
}
