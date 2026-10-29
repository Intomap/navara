import type { CityOptions, CityRenderStats } from "@navaramap/three-city";

export type ShadowControlSettings = {
  shadowIntensity: number;
  shadowFar: number;
  shadowMapSize: number;
  shadowNormalBias: number;
  shadowBias: number;
  shadowRadius: number;
};

export type CloudControlSettings = {
  coverage: number;
  qualityPreset: "low" | "medium" | "high" | "ultra";
  shadows: boolean;
};

export type NightLightControlState = {
  streetLights: number;
  parkLights: number;
  headlights: number;
  windowLight: number;
  windowSoftness: number;
  windowSpareRate: number;
  windowSparePace: number;
  nightCityGlass: number;
  blueLights: number;
};

export type CityControlState = {
  time: number;
  exposure: number;
  bloom: number;
  sun: number;
  sky: number;
  ambient: number;
  radius: number;
  concurrency: number;
  quality: "high" | "low";
  ortho: boolean;
  googleMap: boolean;
  traffic: boolean;
  cars: number;
  trains: boolean;
  birds: number;
  mirror: boolean;
  mirrorScale: number;
  mirrorInterval: number;
  waterAmplitude: number;
  waterSpeed: number;
  waterDistortion: number;
  waterReflection: number;
  waterRoughness: number;
  cloudCoverage: number;
  cloudQuality: CloudControlSettings["qualityPreset"];
  cloudShadows: boolean;
} & ShadowControlSettings &
  NightLightControlState;

export type CityControlActions = {
  setTime: (value: number) => void;
  setExposure: (value: number) => void;
  setBloom: (value: number) => void;
  setSun: (value: number) => void;
  setSky: (value: number) => void;
  setAmbient: (value: number) => void;
  setShadow: (value: Partial<ShadowControlSettings>) => void;
  setCity: (value: Partial<CityOptions>) => void;
  setQuality: (value: "high" | "low") => void;
  setMirror: (
    enabled: boolean,
    resolutionScale: number,
    frameInterval: number,
  ) => void;
  setGoogleMap: (value: boolean) => void;
  setClouds: (value: Partial<CloudControlSettings>) => void;
};

export type CityPerformance = CityRenderStats & {
  fps: number;
  frameMs: number;
  heapMb?: number;
};

export function createNightLightControlState(): NightLightControlState {
  return {
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
}

export function createCityControlState(): CityControlState {
  return {
    ...createNightLightControlState(),
    time: 12,
    exposure: 2.2,
    bloom: 0.06,
    sun: 1.2,
    sky: 3,
    ambient: 0.65,
    shadowIntensity: 0.72,
    shadowFar: 2000,
    shadowMapSize: 4096,
    shadowNormalBias: 0.55,
    shadowBias: 0.00008,
    shadowRadius: 1,
    radius: 1150,
    concurrency: 4,
    quality: "high",
    ortho: true,
    googleMap: true,
    traffic: true,
    cars: 260,
    trains: true,
    birds: 150,
    mirror: true,
    mirrorScale: 0.5,
    mirrorInterval: 2,
    waterAmplitude: 0.065,
    waterSpeed: 1,
    waterDistortion: 1,
    waterReflection: 1.1,
    waterRoughness: 0.06,
    cloudCoverage: 0.05,
    cloudQuality: "high",
    cloudShadows: true,
  };
}
