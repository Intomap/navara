import { DoubleSide, MeshStandardMaterial } from "three";

import type { CityUniforms } from "./programs";

const SHELL = `
vec3 sN = cityLocalNormal(vCityNormal) * (gl_FrontFacing ? 1.0 : -1.0);
float sWall = 1.0 - smoothstep(0.42, 0.62, abs(sN.y));
cityShellLight = 0.0;
if (sWall > 0.5) {
  vec3 T = cross(vec3(0.0, 1.0, 0.0), sN);
  float tl = length(T);
  T = tl > 1e-4 ? T / tl : vec3(1.0, 0.0, 0.0);
  vec3 pk = vec3(floor(atan(sN.z, sN.x) / 1.5707963 + 0.5),
    floor(dot(vCityLocal, T) / 48.0), floor(vCityLocal.y / 24.0)) * 5.7;
  float bay = mix(3.0, 4.4, cityHash13(pk + 1.7));
  float floorH = mix(3.2, 3.7, cityHash13(pk + 9.3));
  float u = dot(vCityLocal, T) / bay, v = (vCityLocal.y - 3.4) / floorH;
  vec2 f = fract(vec2(u, v)), cell = floor(vec2(u, v));
  float winW = mix(0.52, 0.62, cityHash13(pk + 21.1));
  float winH = mix(0.5, 0.58, cityHash13(pk + 31.7));
  vec2 d = abs(f - 0.5);
  float win = step(d.x, winW * 0.5) * step(d.y, winH * 0.5);
  float reveal = (1.0 - step(d.x, winW * 0.5 + 0.03))
    * (1.0 - step(d.y, winH * 0.5 + 0.035)) * (1.0 - win);
  float low = 1.0 - smoothstep(4.4, 5.6, vCityLocal.y);
  float board = smoothstep(3.7, 4.2, vCityLocal.y) * (1.0 - smoothstep(4.7, 5.2, vCityLocal.y));
  float glass = max(win * (1.0 - low), low * step(abs(f.y - 0.6), 0.3));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3 + 0.012, board * (1.0 - uNight * 0.55));
  vec3 pane = mix(vec3(0.11, 0.13, 0.16), diffuseColor.rgb * 0.45, 0.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, pane, glass * 0.85);
  diffuseColor.rgb *= 1.0 - 0.16 * reveal * (1.0 - glass);
  float on = step(0.72, cityHash13(vec3(cell, pk.x + pk.y)));
  cityShellLight = glass * on * (1.0 - low)
    * (0.3 + 0.7 * cityHash13(pk + cell.x * 3.7 + cell.y * 1.3));
} else if (sN.y > 0.5 && uOrthoOn > 0.5) {
  vec2 ouv = (vCityLocal.xz - uOrthoRect.xy) / uOrthoRect.zw;
  if (all(greaterThan(ouv, vec2(0.0))) && all(lessThan(ouv, vec2(1.0))))
    diffuseColor.rgb = texture2D(uOrtho, vec2(ouv.x, 1.0 - ouv.y)).rgb;
}
`;

export function createShellMaterial(
  uniforms: CityUniforms,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aLocal; attribute float aLight; varying vec3 vCityLocal; varying vec3 vCityNormal; varying float vLamp;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCityLocal = aLocal; vCityNormal = normal; vLamp = aLight;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uNight; uniform float uTime; uniform float uOrthoOn;
uniform sampler2D uOrtho; uniform vec4 uOrthoRect;
uniform vec3 uCityEast; uniform vec3 uCityNorth; uniform vec3 uCityUp;
varying vec3 vCityLocal; varying vec3 vCityNormal; varying float vLamp;
float cityShellLight;
float cityHash13(vec3 p) {
  p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 cityLocalNormal(vec3 n) {
  return normalize(vec3(dot(n, uCityEast), dot(n, uCityUp), -dot(n, uCityNorth)));
}`,
      )
      .replace("#include <map_fragment>", `#include <map_fragment>\n${SHELL}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += cityShellLight * uNight * vec3(0.95, 0.84, 0.66) * 0.6;
totalEmissiveRadiance += diffuseColor.rgb * vLamp * uNight * vec3(1.0, 0.8, 0.55) * 2.2;`,
      );
  };
  material.customProgramCacheKey = () => "navara-city-shell-v2";
  return material;
}
