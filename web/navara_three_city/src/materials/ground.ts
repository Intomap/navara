import { Color, MeshStandardMaterial, type ColorRepresentation } from "three";

import type { CityTextureSet } from "../runtime/textures";

import type { CityUniforms } from "./programs";

export type GroundMaterialOptions = {
  color?: ColorRepresentation;
  polygonOffsetFactor?: number;
  polygonOffsetUnits?: number;
};

const NOISE = `
float cityHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float cityNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cityHash(i), cityHash(i + vec2(1.0, 0.0)), f.x),
    mix(cityHash(i + vec2(0.0, 1.0)), cityHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cityRipple(vec2 p, float t) {
  p += 3.2 * vec2(cityNoise(p * 0.11 + t * 0.03), cityNoise(p * 0.11 + 9.0 - t * 0.03))
    + 0.9 * vec2(cityNoise(p * 0.45 - t * 0.05), cityNoise(p * 0.45 + 23.0 + t * 0.05));
  float h = 0.3 * sin(dot(p, vec2(0.92, 0.39)) * 1.1 + t * 1.1);
  h += 0.28 * sin(dot(p, vec2(-0.45, 0.89)) * 1.6 - t * 1.4 + 1.3);
  h += 0.22 * sin(dot(p, vec2(0.2, -0.98)) * 2.7 + t * 1.9 + 4.0);
  h += 0.14 * sin(dot(p, vec2(-0.8, -0.6)) * 4.3 - t * 2.6);
  h += 0.9 * (cityNoise(p * 0.8 + vec2(t * 0.25, -t * 0.18)) - 0.5)
    + 0.45 * (cityNoise(p * 1.9 - vec2(t * 0.4, t * 0.3)) - 0.5);
  return h;
}
`;

const FRAGMENT = `
{
  gN = cityLocalNormal(vCityNormal);
  gT = normalize(cross(gN, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));
  gB = cross(gT, gN);
  vec3 tint = diffuseColor.rgb;
  float layer = uFixedLayer >= 0.0 ? uFixedLayer : floor(vLayer + 0.5);
  bool water = layer > 3.5;
  layer = min(layer, 3.0);
  float sc = uGroundScale[int(layer)];
  vec2 st = abs(gN.y) > 0.5 ? vCityLocal.xz : vec2(vCityLocal.x + vCityLocal.z, vCityLocal.y);
  vec3 a = texture(uGroundAlb, vec3(st / sc, layer)).rgb * 2.0;
  vec3 b = texture(uGroundAlb, vec3(st / (sc * 3.7) + 0.37, layer)).rgb * 2.0;
  float blotch = cityNoise(st * 0.045);
  diffuseColor.rgb *= mix(a, b, 0.4) * (0.86 + 0.28 * blotch);
  if (layer > 1.5 && layer < 2.5 && !water) {
    float turf = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(vec3(turf), diffuseColor.rgb, 0.58) * vec3(1.12, 1.0, 0.8)
      * (0.9 + 0.2 * cityNoise(st * 0.011 + 3.7));
  }
  gNm = texture(uGroundNor, vec3(st / sc, layer)).xyz * 2.0 - 1.0;
  gNm = normalize(vec3(gNm.xy * 0.8, gNm.z));
  gRough = layer < 0.5 ? 0.86 - 0.12 * blotch : 0.93;
  gMetal = 0.0; gWater = 0.0;
  if (layer > 0.5 && layer < 1.5 && !water) {
    vec2 q = st / vec2(0.6, 0.3); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 slab = floor(q), f = fract(q), w = fwidth(st) / vec2(0.6, 0.3);
    float fine = 1.0 - smoothstep(0.3, 0.9, max(w.x, w.y));
    vec2 edge = min(f, 1.0 - f) * vec2(0.6, 0.3);
    float joint = 1.0 - smoothstep(0.004, 0.011 + 0.6 * fwidth(st.x), min(edge.x, edge.y));
    float grey = dot(tint, vec3(0.3, 0.59, 0.11));
    vec3 paver = mix(tint, vec3(grey) * vec3(0.99, 1.0, 1.02), 0.65) * 1.12;
    paver *= (0.92 + 0.16 * cityHash(slab)) * (0.96 + 0.08 * cityNoise(st * 14.0));
    paver = mix(paver, paver * 0.55, joint);
    diffuseColor.rgb = mix(diffuseColor.rgb, paver, fine);
    gNm = normalize(mix(gNm, vec3(0.0, 0.0, 1.0), 0.75 * fine));
    gRough = mix(gRough, 0.88, fine);
  }
  if (uFixedLayer >= 0.0 && uFixedLayer < 3.5 && uOrthoOn > 0.5) {
    vec2 ouv = (vCityLocal.xz - uOrthoRect.xy) / uOrthoRect.zw;
    if (all(greaterThan(ouv, vec2(0.0))) && all(lessThan(ouv, vec2(1.0)))) {
      vec3 photo = texture2D(uOrtho, vec2(ouv.x, 1.0 - ouv.y)).rgb;
      diffuseColor.rgb = photo * (0.9 + 0.2 * (mix(a, b, 0.4).g - 0.5));
      gNm = vec3(0.0, 0.0, 1.0);
    }
  }
  if (water) {
    diffuseColor.rgb = tint * 0.5;
    float t = uTime * uWaterSpeed;
    float e = 0.12;
    float viewDistance = distance(cameraPosition, vCityWorld);
    float attenuation = clamp(170.0 / viewDistance - 0.12, 0.0, 1.0);
    float footprint = max(fwidth(vCityLocal.x), fwidth(vCityLocal.z));
    float detail = 1.0 - smoothstep(0.08, 0.8, footprint);
    float amp = uWaterAmplitude * max(0.3, attenuation) * mix(0.5, 1.0, detail);
    vec2 slope = vec2(cityRipple(vCityLocal.xz + vec2(e, 0.0), t) - cityRipple(vCityLocal.xz - vec2(e, 0.0), t),
      cityRipple(vCityLocal.xz + vec2(0.0, e), t) - cityRipple(vCityLocal.xz - vec2(0.0, e), t)) * (amp / (2.0 * e));
    gWaveN = normalize(vec3(-slope.x, 1.0, -slope.y));
    gNm = vec3(gWaveN.x, gWaveN.z, gWaveN.y);
    gRough = uWaterRoughness; gWater = 1.0;
  }
}
`;

export function createGroundMaterial(
  uniforms: CityUniforms,
  textures: CityTextureSet,
  fixedLayer = -1,
  vertexColors = true,
  options: GroundMaterialOptions = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors,
    roughness: 0.92,
    ...(options.color === undefined ? {} : { color: new Color(options.color) }),
    ...(options.polygonOffsetFactor === undefined
      ? {}
      : {
          polygonOffset: true,
          polygonOffsetFactor: options.polygonOffsetFactor,
          polygonOffsetUnits: options.polygonOffsetUnits ?? 0,
        }),
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uGroundAlb: { value: textures.albedo },
      uGroundNor: { value: textures.normal },
      uGroundScale: { value: textures.scales },
      uFixedLayer: { value: fixedLayer },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aLocal; attribute float aLayer; attribute float aLight;
varying vec3 vCityLocal; varying vec3 vCityWorld; varying vec3 vCityNormal; varying float vLayer; varying float vLamp;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCityLocal = aLocal; vCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCityNormal = normal; vLayer = aLayer; vLamp = aLight;`,
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nif (aLayer > 3.5) gl_Position.z -= 0.0008;",
      )
      .replace(
        "#include <logdepthbuf_vertex>",
        `#include <logdepthbuf_vertex>
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
if (aLayer > 3.5) vFragDepth = max(1.0, vFragDepth - 0.03);
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime; uniform float uNight; uniform float uOrthoOn; uniform float uFixedLayer;
uniform sampler2D uOrtho; uniform vec4 uOrthoRect;
uniform sampler2DArray uGroundAlb; uniform sampler2DArray uGroundNor; uniform float uGroundScale[4];
uniform sampler2D uLampMap; uniform mat4 uLampMatrix; uniform float uLampOn;
uniform float uStreetLights;
uniform sampler2D uMirror; uniform mat4 uMirrorMatrix; uniform float uMirrorOn;
uniform float uWaterAmplitude; uniform float uWaterSpeed; uniform float uWaterDistortion;
uniform float uWaterReflection; uniform float uWaterRoughness;
uniform vec3 uCityEast; uniform vec3 uCityNorth; uniform vec3 uCityUp;
varying vec3 vCityLocal; varying vec3 vCityWorld; varying vec3 vCityNormal; varying float vLayer; varying float vLamp;
float gRough; float gMetal; float gWater; vec3 gT; vec3 gB; vec3 gN; vec3 gNm; vec3 gWaveN;
vec3 cityLocalNormal(vec3 n) { return normalize(vec3(dot(n, uCityEast), dot(n, uCityUp), -dot(n, uCityNorth))); }
${NOISE}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${FRAGMENT}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = gRough;",
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor = gMetal;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 cityN = normalize(gT * gNm.x + gB * gNm.y + gN * gNm.z);
vec3 cityWorldN = uCityEast * cityN.x + uCityUp * cityN.y - uCityNorth * cityN.z;
normal = normalize((viewMatrix * vec4(cityWorldN, 0.0)).xyz);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vLamp * uNight * uStreetLights * vec3(1.0, 0.8, 0.55) * 2.2;
if (uLampOn > 0.01) {
  vec4 lampClip = uLampMatrix * vec4(vCityWorld, 1.0);
  vec2 lampUv = lampClip.xy / lampClip.w * 0.5 + 0.5;
  if (all(greaterThan(lampUv, vec2(0.0))) && all(lessThan(lampUv, vec2(1.0)))) {
    vec3 dynamicLamp = texture2D(uLampMap, lampUv).rgb;
    totalEmissiveRadiance += diffuseColor.rgb * dynamicLamp * uLampOn * smoothstep(0.2, 0.7, gN.y);
  }
}`,
      )
      .replace(
        "#include <opaque_fragment>",
        `
if (gWater > 0.5) {
  vec3 wv = normalize(vCityWorld - cameraPosition);
  vec3 localV = vec3(dot(wv, uCityEast), dot(wv, uCityUp), -dot(wv, uCityNorth));
  vec3 wr = reflect(localV, gWaveN);
  float fresnel = 0.05 + 0.95 * pow(1.0 - max(dot(-localV, gWaveN), 0.0), 4.0);
  vec3 seen = mix(vec3(0.8, 0.86, 0.92), vec3(0.3, 0.48, 0.74), pow(clamp(abs(wr.y), 0.0, 1.0), 0.5))
    * (0.03 + 0.97 * (1.0 - uNight)) * 0.9;
  float thing = 0.0;
  if (uMirrorOn > 0.5) {
    vec4 mc = uMirrorMatrix * vec4(vCityWorld, 1.0);
    float near = clamp(70.0 / distance(cameraPosition, vCityWorld), 0.12, 1.6);
    vec2 muv = mc.xy / mc.w * 0.5 + 0.5 + gWaveN.xz * vec2(0.5, 0.9) * near * uWaterDistortion;
    vec4 mirrored = vec4(0.0);
    for (int i = -1; i <= 1; i++) {
      mirrored += texture2D(uMirror, clamp(muv + vec2(0.0, float(i) * 0.004 * near * uWaterDistortion), 0.001, 0.999));
    }
    mirrored /= 3.0;
    thing = smoothstep(0.0, 0.3, mirrored.a + dot(mirrored.rgb, vec3(1.0)));
    seen = mix(seen, mirrored.rgb * vec3(0.88, 0.93, 0.95), thing);
  }
  float reflection = max(fresnel, 0.42 * thing) * uWaterReflection;
  outgoingLight = mix(outgoingLight, seen, clamp(reflection, 0.0, 1.0));
}
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `navara-city-ground-v6-${fixedLayer}`;
  return material;
}
