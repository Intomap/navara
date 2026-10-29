import {
  Color,
  DataTexture,
  Matrix4,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Vector4,
  type Texture,
} from "three";

import type { CityNightLightOptions, CityWaterOptions } from "../types";

export type CityUniforms = {
  uBlank: { value: Texture };
  uNight: { value: number };
  uTime: { value: number };
  uOrtho: { value: Texture | null };
  uOrthoOn: { value: number };
  uOrthoRect: { value: Vector4 };
  uCityEast: { value: Vector3 };
  uCityNorth: { value: Vector3 };
  uCityUp: { value: Vector3 };
  uCitySunDirection: { value: Vector3 };
  uCityGlass: { value: number };
  uNightCityGlass: { value: number };
  uStreetLights: { value: number };
  uParkLights: { value: number };
  uRoomLight: { value: number };
  uSoft: { value: number };
  uNightBlue: { value: number };
  uSeason: { value: number };
  uTreeGlow: { value: Color };
  uPhotoRange: { value: Vector2 };
  uPhotoMix: { value: number };
  uWindowLife: { value: Vector2 };
  uLampMap: { value: Texture };
  uLampMatrix: { value: Matrix4 };
  uLampOn: { value: number };
  uMirror: { value: Texture };
  uMirrorMatrix: { value: Matrix4 };
  uMirrorOn: { value: number };
  uWaterAmplitude: { value: number };
  uWaterSpeed: { value: number };
  uWaterDistortion: { value: number };
  uWaterReflection: { value: number };
  uWaterRoughness: { value: number };
};

export const DEFAULT_CITY_WATER: Required<CityWaterOptions> = {
  amplitude: 0.045,
  speed: 1,
  distortion: 1,
  reflection: 1,
  roughness: 0.08,
};

export const DEFAULT_CITY_NIGHT_LIGHTS: Required<CityNightLightOptions> = {
  streetLights: 1,
  parkLights: 0.3,
  headlights: 5,
  windowLight: 1.75,
  windowSoftness: 1,
  windowSpareRate: 0.5,
  windowSparePace: 6,
  nightCityGlass: 0,
  blueLights: 0.55,
};

export function createCityUniforms(): CityUniforms {
  const lat = (22.2873954898065 * Math.PI) / 180;
  const lon = (114.170634833928 * Math.PI) / 180;
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  return {
    uBlank: { value: blank },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uOrtho: { value: null },
    uOrthoOn: { value: 0 },
    uOrthoRect: { value: new Vector4(-1875, -1500, 3840, 3072) },
    uCityEast: { value: new Vector3(-Math.sin(lon), Math.cos(lon), 0) },
    uCityNorth: {
      value: new Vector3(
        -Math.sin(lat) * Math.cos(lon),
        -Math.sin(lat) * Math.sin(lon),
        Math.cos(lat),
      ),
    },
    uCityUp: {
      value: new Vector3(
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat),
      ),
    },
    uCitySunDirection: { value: new Vector3(0, 1, 0) },
    uCityGlass: { value: 2 },
    uNightCityGlass: { value: DEFAULT_CITY_NIGHT_LIGHTS.nightCityGlass },
    uStreetLights: { value: DEFAULT_CITY_NIGHT_LIGHTS.streetLights },
    uParkLights: { value: DEFAULT_CITY_NIGHT_LIGHTS.parkLights },
    uRoomLight: { value: DEFAULT_CITY_NIGHT_LIGHTS.windowLight },
    uSoft: { value: DEFAULT_CITY_NIGHT_LIGHTS.windowSoftness },
    uNightBlue: { value: DEFAULT_CITY_NIGHT_LIGHTS.blueLights },
    uSeason: { value: 0 },
    uTreeGlow: { value: new Color(0, 0, 0) },
    uPhotoRange: { value: new Vector2(140, 420) },
    uPhotoMix: { value: 0 },
    uWindowLife: {
      value: new Vector2(DEFAULT_CITY_NIGHT_LIGHTS.windowSpareRate, 0),
    },
    uLampMap: { value: blank },
    uLampMatrix: { value: new Matrix4() },
    uLampOn: { value: 0 },
    uMirror: { value: blank },
    uMirrorMatrix: { value: new Matrix4() },
    uMirrorOn: { value: 0 },
    uWaterAmplitude: { value: DEFAULT_CITY_WATER.amplitude },
    uWaterSpeed: { value: DEFAULT_CITY_WATER.speed },
    uWaterDistortion: { value: DEFAULT_CITY_WATER.distortion },
    uWaterReflection: { value: DEFAULT_CITY_WATER.reflection },
    uWaterRoughness: { value: DEFAULT_CITY_WATER.roughness },
  };
}

const declarations = `
uniform float uNight;
uniform float uOrthoOn;
uniform sampler2D uOrtho;
uniform vec4 uOrthoRect;
uniform vec3 uCityEast;
uniform vec3 uCityNorth;
uniform vec3 uCityUp;
varying vec3 vCityLocal;
float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 cityPhoto() {
  vec2 uv = (vCityLocal.xz - uOrthoRect.xy) / uOrthoRect.zw;
  return texture2D(uOrtho, vec2(uv.x, 1.0 - uv.y)).rgb;
}
`;

export function attachCityProgram(
  material: MeshStandardMaterial,
  uniforms: CityUniforms,
  mode: "terrain" | "building" | "prefab",
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aLocal;
${mode === "building" ? "attribute vec4 aFacade; attribute vec4 aBldg;" : ""}
varying vec3 vCityLocal;
varying vec3 vCityNormal;
${mode === "building" ? "varying vec4 vCityFacade; varying vec4 vCityBldg;" : ""}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCityLocal = aLocal;
vCityNormal = normal;
${mode === "building" ? "vCityFacade = aFacade; vCityBldg = aBldg;" : ""}`,
      );
    let fragment = declarations + "\nvarying vec3 vCityNormal;\n";
    if (mode === "building")
      fragment += "varying vec4 vCityFacade; varying vec4 vCityBldg;\n";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${fragment}`,
    );
    let colorCode: string;
    const lightCode = "float cityLight = 0.0;\n";
    if (mode === "terrain") {
      colorCode = `if (uOrthoOn > 0.5) diffuseColor.rgb = cityPhoto();`;
    } else if (mode === "building") {
      colorCode = `
vec2 cell = vec2(vCityFacade.x, vCityFacade.y / max(vCityFacade.z, 0.1));
vec2 f = fract(cell);
float bayCount = max(vCityBldg.z, 1.0);
float windowX = step(0.2, fract(vCityFacade.x * bayCount)) * (1.0 - step(0.8, fract(vCityFacade.x * bayCount)));
float windowY = step(0.22, f.y) * (1.0 - step(0.78, f.y));
float window = windowX * windowY * (1.0 - step(1.5, vCityBldg.y));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.075, 0.095), window * 0.82);
cityLight = window * step(0.72, cityHash(floor(cell) + vCityFacade.w));`;
    } else {
      colorCode = `
vec3 localN = normalize(vec3(dot(normalize(vCityNormal), uCityEast), dot(normalize(vCityNormal), uCityUp), -dot(normalize(vCityNormal), uCityNorth)));
float wall = 1.0 - smoothstep(0.45, 0.65, abs(localN.y));
vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), localN) + vec3(0.0001, 0.0, 0.0));
vec2 cell = vec2(dot(vCityLocal, tangent) / 3.4, (vCityLocal.y - 3.0) / 3.35);
vec2 f = fract(cell);
float window = wall * step(0.22, f.x) * (1.0 - step(0.78, f.x)) * step(0.2, f.y) * (1.0 - step(0.8, f.y));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.085, 0.105), window * 0.8);
if (wall < 0.5 && localN.y > 0.5 && uOrthoOn > 0.5) diffuseColor.rgb = cityPhoto();
cityLight = window * step(0.75, cityHash(floor(cell)));`;
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>\n${lightCode}\n${colorCode}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityLight * uNight * vec3(0.95, 0.78, 0.48) * 0.8;`,
      );
  };
  material.customProgramCacheKey = () => `navara-city-${mode}-v1`;
}

export function createSignMaterial(
  uniforms: CityUniforms,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    emissive: new Color(0xffffff),
    emissiveIntensity: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uNight;",
      );
  };
  material.customProgramCacheKey = () => "navara-city-sign-v1";
  return material;
}
