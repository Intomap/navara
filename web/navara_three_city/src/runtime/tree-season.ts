import type { MeshStandardMaterial } from "three";

import type { CityUniforms } from "../materials/programs";

const NIGHT_FILL_PARS_VERT = /* glsl */ `
varying vec3 vFillWorld;
`;
const NIGHT_FILL_VERT = /* glsl */ `
#ifdef USE_INSTANCING
  vFillWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vFillWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;
const NIGHT_FILL_PARS_FRAG = /* glsl */ `
uniform float uFillStrength;
uniform sampler2D uLampMap;
uniform mat4 uLampMatrix;
uniform float uLampOn;
varying vec3 vFillWorld;
vec3 cityNightFill(vec3 albedo) {
  vec3 fill = albedo * vec3(1.0, 0.88, 0.66) * (uFillStrength * uNight);
  if (uLampOn > 0.01) {
    vec4 lampClip = uLampMatrix * vec4(vFillWorld, 1.0);
    vec2 lampUv = lampClip.xy / lampClip.w * 0.5 + 0.5;
    if (all(greaterThan(lampUv, vec2(0.0))) && all(lessThan(lampUv, vec2(1.0)))) {
      fill += albedo * texture2D(uLampMap, lampUv).rgb * uLampOn * 1.3;
    }
  }
  return fill;
}
`;

/**
 * Keeps foliage readable at night: a warm city-glow floor replaces the blue
 * moon/sky ambient, and street-lamp pools from the shared lamp light map land
 * on leaves and crowns like the Tokyo reference.
 */
export function applyCityNightFill(
  material: MeshStandardMaterial,
  uniforms: CityUniforms,
  strength: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uLampMap = uniforms.uLampMap;
    shader.uniforms.uLampMatrix = uniforms.uLampMatrix;
    shader.uniforms.uLampOn = uniforms.uLampOn;
    shader.uniforms.uFillStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${NIGHT_FILL_PARS_VERT}`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n${NIGHT_FILL_VERT}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uNight;\n${NIGHT_FILL_PARS_FRAG}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += cityNightFill(diffuseColor.rgb);`,
      );
  };
  material.customProgramCacheKey = () =>
    `navara-city-night-fill-v1-${strength}`;
}

const SEASON_VERT_PARS = /* glsl */ `
attribute float aTreeSeed;
varying float vTreeSeed;
varying vec3 vLeafAt;
`;
const SEASON_VERT = /* glsl */ `
  vLeafAt = position;
  #ifdef USE_INSTANCING
    vTreeSeed = aTreeSeed;
  #else
    vTreeSeed = 0.5;
  #endif
`;
const SEASON_FRAG_PARS = /* glsl */ `
uniform float uSeason;
varying float vTreeSeed;
varying vec3 vLeafAt;
vec3 seasonColor(float s);
float leafHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec4 blossom(vec2 uv, float seed) {
  vec2 g = uv * 5.0, id = floor(g), f = fract(g) - 0.5;
  float h = leafHash(vec3(id, seed * 91.0)), h2 = leafHash(vec3(id.yx + 3.0, seed * 37.0));
  f += (vec2(h2, fract(h2 * 7.7)) - 0.5) * 0.35;
  float r = length(f), a = atan(f.y, f.x) + h * 6.2832;
  float flower = step(r, 0.3 + 0.13 * cos(5.0 * a)) * step(0.18, h);
  vec3 c = mix(vec3(0.82, 0.5, 0.6), vec3(0.92, 0.78, 0.82), h2);
  c = mix(vec3(0.7, 0.25, 0.38), c, smoothstep(0.02, 0.16, r));
  return vec4(c, flower);
}
vec3 foliage(float seed, float light) {
  vec3 at = vLeafAt * 13.0 + seed * 31.0, cell = floor(at);
  float n = leafHash(cell), m = leafHash(cell + 7.3), fine = 1.0 - smoothstep(0.25, 0.9, fwidth(at.x) + fwidth(at.y) + fwidth(at.z));
  vec3 c = mix(seasonColor(seed), seasonColor(fract(seed + 0.13 + 0.2 * m)), step(0.62, n) * 0.75 * fine);
  float gap = smoothstep(0.0, 0.22, n);
  return c * light * mix(1.0, mix(0.28, 1.0, gap) * (0.75 + 0.55 * m), fine);
}
vec3 seasonColor(float s) {
  float t = fract(s * 7.31 + 0.13);
  if (uSeason < 1.5) {
    if (s < 0.34) return mix(vec3(0.035, 0.085, 0.03), vec3(0.06, 0.11, 0.035), t);
    if (s < 0.42) return mix(vec3(0.16, 0.15, 0.04), vec3(0.2, 0.13, 0.035), t);
    if (s < 0.72) return mix(vec3(0.4, 0.15, 0.03), vec3(0.3, 0.1, 0.025), t);
    if (s < 0.86) return mix(vec3(0.24, 0.085, 0.03), vec3(0.3, 0.06, 0.03), t);
    return mix(vec3(0.46, 0.27, 0.05), vec3(0.38, 0.2, 0.04), t);
  }
  if (s < 0.38) return mix(mix(vec3(0.86, 0.6, 0.68), vec3(0.78, 0.45, 0.56), t), vec3(0.9, 0.8, 0.82), step(0.75, t));
  return mix(vec3(0.2, 0.36, 0.09), vec3(0.3, 0.42, 0.12), t);
}
`;

export type SeasonalTreeDefinition = {
  recolor?: boolean;
  blossom?: boolean;
};

export function applySeasonToLeaf(
  material: MeshStandardMaterial,
  definition: SeasonalTreeDefinition,
  uniforms: CityUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSeason = uniforms.uSeason;
    shader.uniforms.uLampMap = uniforms.uLampMap;
    shader.uniforms.uLampMatrix = uniforms.uLampMatrix;
    shader.uniforms.uLampOn = uniforms.uLampOn;
    shader.uniforms.uFillStrength = { value: 0.24 };
    if (definition.recolor)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
      vec4 leaf = texture2D(map, vMapUv);
      diffuseColor.rgb *= 0.55 + 0.7 * dot(leaf.rgb, vec3(0.3, 0.6, 0.1));
      diffuseColor.a *= leaf.a;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uNight;\n${SEASON_FRAG_PARS}${NIGHT_FILL_PARS_FRAG}`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `if (uSeason > 0.5) diffuseColor.rgb = seasonColor(vTreeSeed) * (0.45 + 1.0 * dot(texture2D(map, vMapUv).rgb, vec3(0.3, 0.6, 0.1)));
      if (${
        definition.blossom ? "true" : "uSeason > 1.5 && vTreeSeed < 0.38"
      }) { vec4 bloom = blossom(vMapUv, vTreeSeed); diffuseColor = vec4(bloom.rgb * (0.85 + 0.3 * vTreeSeed), bloom.a); }
      #include <alphatest_fragment>`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += cityNightFill(diffuseColor.rgb);`,
      );
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uTime;${SEASON_VERT_PARS}${NIGHT_FILL_PARS_VERT}`,
      )
      .replace(
        "#include <project_vertex>",
        `${SEASON_VERT}\n#include <project_vertex>\n${NIGHT_FILL_VERT}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayAt = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vec3 swayAt = transformed;
        #endif
        float sway = 0.6 * sin(uTime * 1.3 + swayAt.x * 0.35 + swayAt.z * 0.27) + 0.3 * sin(uTime * 2.9 + swayAt.x * 1.1 + swayAt.y);
        transformed.xz += uv.y * sway * 0.07;`,
      );
  };
  material.customProgramCacheKey = () =>
    `leaves-v8-${definition.recolor ? "recolor" : "base"}${
      definition.blossom ? "-blossom" : ""
    }`;
}

export function applySeasonToDistant(
  material: MeshStandardMaterial,
  uniforms: CityUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeason = uniforms.uSeason;
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uLampMap = uniforms.uLampMap;
    shader.uniforms.uLampMatrix = uniforms.uLampMatrix;
    shader.uniforms.uLampOn = uniforms.uLampOn;
    shader.uniforms.uFillStrength = { value: 0.24 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>${SEASON_VERT_PARS}${NIGHT_FILL_PARS_VERT}`,
      )
      .replace(
        "#include <project_vertex>",
        `${SEASON_VERT}\n#include <project_vertex>\n${NIGHT_FILL_VERT}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uNight;\n${SEASON_FRAG_PARS}${NIGHT_FILL_PARS_FRAG}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += cityNightFill(diffuseColor.rgb);`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (uSeason > 0.5 && vColor.g > vColor.r) diffuseColor.rgb = foliage(vTreeSeed, 0.22 + 0.85 * clamp(vColor.g / 0.1, 0.0, 1.0));`,
      );
  };
  material.customProgramCacheKey = () => "blob-season-v9";
}
