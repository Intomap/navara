import {
  Color,
  DoubleSide,
  LineBasicMaterial,
  MathUtils,
  MeshStandardMaterial,
  Vector4,
  type Material,
  type Texture,
} from "three";

import type { CityTextures } from "../runtime/textures";
import type { CityNightLightOptions, CityWaterOptions } from "../types";

import { createDecalMaterial, createDecalTexture } from "./decals";
import { createFacadeMaterial } from "./facade";
import { createGroundMaterial } from "./ground";
import {
  createCityUniforms,
  DEFAULT_CITY_NIGHT_LIGHTS,
  DEFAULT_CITY_WATER,
  type CityUniforms,
} from "./programs";
import { createShellMaterial } from "./shell";

export type CityMaterialsOptions = {
  /** True when the manifest's prefab meshes are a city's real 3D shells. */
  shells?: boolean;
};

export type CityMaterials = {
  uniforms: CityUniforms;
  terrain: MeshStandardMaterial;
  ground: MeshStandardMaterial;
  paint: MeshStandardMaterial;
  buildings: MeshStandardMaterial;
  photo: MeshStandardMaterial;
  prefab: MeshStandardMaterial;
  decals: MeshStandardMaterial;
  wire: LineBasicMaterial;
  props: MeshStandardMaterial;
  setNight: (value: number) => void;
  setSeason: (value: number) => void;
  setTime: (value: number) => void;
  setNightLights: (options?: CityNightLightOptions) => void;
  setWater: (options?: CityWaterOptions) => void;
  setOrtho: (enabled: boolean, texture?: Texture, rect?: Vector4) => void;
  dispose: () => void;
};

export function createCityMaterials(
  textures: CityTextures,
  options: CityMaterialsOptions = {},
): CityMaterials {
  const uniforms = createCityUniforms();
  const terrain = createGroundMaterial(uniforms, textures.ground, 3, false, {
    color: new Color().setRGB(0.2, 0.2, 0.185),
  });
  const ground = createGroundMaterial(uniforms, textures.ground, -1, true, {
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const paint = createGroundMaterial(uniforms, textures.ground, -1, true, {
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -8,
  });
  const buildings = createFacadeMaterial(uniforms, textures.wall);
  const photo = new MeshStandardMaterial({
    color: 0x777776,
    roughness: 0.9,
    metalness: 0,
  });
  const models = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    side: DoubleSide,
  });
  const shell = createShellMaterial(uniforms);
  const prefab = options.shells ? shell : models;
  const decalTexture = createDecalTexture();
  const decals = createDecalMaterial(decalTexture);
  const wire = new LineBasicMaterial({ color: 0x14161a });
  const props = new MeshStandardMaterial({ color: 0x58705a, roughness: 0.9 });
  const all: Material[] = [
    terrain,
    ground,
    paint,
    buildings,
    photo,
    models,
    shell,
    decals,
    wire,
    props,
  ];
  return {
    uniforms,
    terrain,
    ground,
    paint,
    buildings,
    photo,
    prefab,
    decals,
    wire,
    props,
    setNight: (value) => {
      uniforms.uNight.value = value;
      uniforms.uTreeGlow.value
        .setRGB(0.006, 0.06, 0.058)
        .multiplyScalar(MathUtils.clamp(value, 0, 1));
    },
    setSeason: (value) => {
      uniforms.uSeason.value = MathUtils.clamp(value, 0, 2);
    },
    setTime: (value) => {
      uniforms.uTime.value = value;
    },
    setNightLights: (options) => {
      const lights = { ...DEFAULT_CITY_NIGHT_LIGHTS, ...options };
      uniforms.uStreetLights.value = MathUtils.clamp(lights.streetLights, 0, 3);
      uniforms.uParkLights.value = MathUtils.clamp(lights.parkLights, 0, 3);
      uniforms.uRoomLight.value = MathUtils.clamp(lights.windowLight, 0, 4);
      uniforms.uSoft.value = MathUtils.clamp(lights.windowSoftness, 0, 1);
      uniforms.uWindowLife.value.x = MathUtils.clamp(
        lights.windowSpareRate,
        0,
        1,
      );
      uniforms.uNightCityGlass.value = MathUtils.clamp(
        lights.nightCityGlass,
        0,
        3,
      );
      uniforms.uNightBlue.value = MathUtils.clamp(lights.blueLights, 0, 1);
    },
    setWater: (options) => {
      const water = { ...DEFAULT_CITY_WATER, ...options };
      uniforms.uWaterAmplitude.value = Math.max(0, water.amplitude);
      uniforms.uWaterSpeed.value = Math.max(0, water.speed);
      uniforms.uWaterDistortion.value = Math.max(0, water.distortion);
      uniforms.uWaterReflection.value = Math.max(0, water.reflection);
      uniforms.uWaterRoughness.value = Math.min(
        1,
        Math.max(0.01, water.roughness),
      );
    },
    setOrtho: (enabled, texture, rect) => {
      uniforms.uOrtho.value = enabled && texture ? texture : null;
      uniforms.uOrthoOn.value = enabled && texture ? 1 : 0;
      if (rect) uniforms.uOrthoRect.value.copy(rect);
    },
    dispose: () => {
      uniforms.uOrtho.value?.dispose();
      uniforms.uBlank.value.dispose();
      all.forEach((material) => material.dispose());
      decalTexture.dispose();
    },
  };
}
