import ThreeView, { type Layer } from "@navaramap/three";
import {
  CityBloomEffectDesc,
  CityMeshDesc,
  CityPlugin,
  CityWaterMirrorEffectDesc,
  type CityBloomConfig,
  type CityWaterMirrorConfig,
  type CityConfig,
  type CityOptions,
  type CityStats,
} from "@navaramap/three-city";
import {
  ToneMappingMode,
  SSREffectDesc,
  type CloudsEffectDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Vector2 } from "three";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";

import { createCityControlState } from "./control-state";
import { createCityControls } from "./controls";

export const meta: ExampleMeta = {
  section: "3d",
  order: 10,
  title: { en: "Hong Kong Real-time City", ja: "香港リアルタイム都市" },
  description: {
    en: "Stream prebuilt Hong Kong meshes with Rust/WASM meshing and ellipsoid RTC rendering.",
    ja: "Rust/WASM メッシュ生成と楕円体 RTC 描画で香港の都市データをストリーミングする。",
  },
  docs: "three/core/custom-desc",
  signature: true,
};

type CityViewDescriptions = DefaultDescriptions & {
  mesh: CityConfig;
  effect: CityBloomConfig & CityWaterMirrorConfig;
};

const INITIAL_HOUR_HKT = 12;
const HKT_OFFSET_HOURS = 8;

export async function run(ctx: ExampleContext): Promise<ExampleRunResult> {
  const view = new ThreeView<CityViewDescriptions>({
    animation: true,
    shadow: true,
    memoryBudget: {
      maxWorkerHeapBytes: 128 * 1024 * 1024,
    },
  });
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  view.addPlugin(new CityPlugin());
  await view.init();

  const satellite = view.addSource({
    type: "raster-tile",
    url: "https://mt2.google.com/vt/lyrs=s&hl=en-US&x={x}&y={y}&z={z}",
    maxZoom: 20,
  });
  let satelliteLayer: Layer | undefined;

  const scene = defaultPlugin.addDefaultPhotorealScene({
    deferredLighting: true,
    shadow: true,
  });
  scene.aerialPerspective.update({
    aerialPerspective: { sun: true, sky: true, ambientIntensity: 0.9 },
  });
  scene.toneMapping.update({ toneMapping: { mode: ToneMappingMode.NEUTRAL } });
  // The deferred sun light only casts the cascaded shadow map into the shadow
  // G-buffer; its intensity no longer lights the scene (view.lit is false).
  scene.sun.update({
    sun: {
      castShadow: true,
      shadowFar: 2000,
      shadowMargin: 500,
      shadowCascadeCount: 1,
      shadowMapSize: 4096,
      shadowNormalBias: 0.55,
      shadowBias: 0.00008,
    },
  });
  view.toneMappingExposure = 3.5;
  view.atmosphere.date = new Date(
    Date.UTC(2026, 6, 16, INITIAL_HOUR_HKT - HKT_OFFSET_HOURS),
  );
  const bloom = view.addEffect<CityBloomEffectDesc>({
    cityBloom: { intensity: 0.06, threshold: 1.1, smoothing: 0.2 },
  });
  const mirror = view.addEffect<CityWaterMirrorEffectDesc>({
    cityMirror: { enabled: true, resolutionScale: 0.5, frameInterval: 2 },
  });
  view.addEffect<SSREffectDesc>({
    ssr: { resolutionScale: 0.5 },
  });
  view.setCamera({
    lng: 114.1682,
    lat: 22.28145,
    heading: 148,
    pitch: -31,
    distance: 5200,
    roll: 0,
  });
  view.camera.fov = 58;

  const clouds = view.addEffect<CloudsEffectDesc>({
    clouds: {
      qualityPreset: "high",
      coverage: 0.05,
      localWeatherVelocity: new Vector2(0.001, 0),
      shadows: true,
      haze: true,
    },
  });

  const controlState = createCityControlState();
  const cityOptions: CityOptions = {
    url: `${ctx.assetsUrl}city/hk4d`,
    radius: controlState.radius,
    concurrency: controlState.concurrency,
    quality: controlState.quality,
    ortho: controlState.ortho,
    night: 0,
    traffic: controlState.traffic,
    cars: controlState.cars,
    trains: controlState.trains,
    birds: controlState.birds,
    mirror: controlState.mirror,
    water: {
      amplitude: controlState.waterAmplitude,
      speed: controlState.waterSpeed,
      distortion: controlState.waterDistortion,
      reflection: controlState.waterReflection,
      roughness: controlState.waterRoughness,
    },
  };
  const city = view.addMesh<CityMeshDesc>({ city: cityOptions });
  const updateCity = (updates: Partial<CityOptions>) => {
    Object.assign(cityOptions, updates);
    city.update({ city: { ...cityOptions } });
  };
  const updateMirror = (
    enabled: boolean,
    resolutionScale: number,
    frameInterval: number,
  ) => {
    updateCity({ mirror: enabled });
    mirror.update({
      cityMirror: { enabled, resolutionScale, frameInterval },
    });
  };
  const applyTime = (hour: number) => {
    const night = Math.min(
      Math.max(Math.max((7 - hour) / 2, (hour - 17) / 5), 0),
      1,
    );
    controlState.exposure = 3.5 - night * 1.5;
    controlState.ambient = 0.9 - night * 0.5;
    controlState.bloom = 0.06 + night * 0.28;
    view.atmosphere.date = new Date(
      Date.UTC(2026, 6, 16, -HKT_OFFSET_HOURS) + hour * 3_600_000,
    );
    view.toneMappingExposure = controlState.exposure;
    scene.aerialPerspective.update({
      aerialPerspective: { ambientIntensity: controlState.ambient },
    });
    bloom.update({ cityBloom: { intensity: controlState.bloom } });
    updateCity({ night });
    controls?.refresh();
  };
  const controls = createCityControls(
    view.canvas.parentElement ?? document.body,
    controlState,
    {
      setTime: applyTime,
      setExposure: (value) => {
        view.toneMappingExposure = value;
      },
      setBloom: (value) => bloom.update({ cityBloom: { intensity: value } }),
      setAmbient: (value) =>
        scene.aerialPerspective.update({
          aerialPerspective: { ambientIntensity: value },
        }),
      setShadow: (value) => {
        const { shadowIntensity, ...sunShadow } = value;
        if (shadowIntensity !== undefined) {
          scene.aerialPerspective.update({
            aerialPerspective: { shadowIntensity },
          });
        }
        scene.sun.update({ sun: sunShadow });
      },
      setCity: updateCity,
      setQuality: (value) => {
        updateCity({ quality: value });
        controlState.shadowMapSize = value === "high" ? 4096 : 2048;
        controlState.cloudQuality = value === "high" ? "high" : "low";
        controlState.mirrorScale = value === "high" ? 0.5 : 0.35;
        controlState.mirrorInterval = value === "high" ? 2 : 3;
        scene.sun.update({
          sun: { shadowMapSize: controlState.shadowMapSize },
        });
        clouds.update({
          clouds: { qualityPreset: controlState.cloudQuality },
        });
        updateMirror(
          controlState.mirror,
          controlState.mirrorScale,
          controlState.mirrorInterval,
        );
        controls?.refresh();
      },
      setMirror: updateMirror,
      setGoogleMap: (value) => {
        if (value && !satelliteLayer) {
          satelliteLayer = view.addLayer({ type: "raster", source: satellite });
        } else if (!value && satelliteLayer) {
          satelliteLayer.delete();
          satelliteLayer = undefined;
        }
      },
      setClouds: (value) => clouds.update({ clouds: value }),
    },
  );
  cityOptions.onStats = (stats: CityStats) => controls.updateCityStats(stats);
  updateCity({});

  let frameHandle = 0;
  let sampleStart = performance.now();
  let sampleFrames = 0;
  let previousCalls = 0;
  let previousTriangles = 0;
  let previousMirrorCalls = 0;
  let previousMirrorTriangles = 0;
  let previousLampCalls = 0;
  let previousLampTriangles = 0;
  const samplePerformance = (now: number) => {
    sampleFrames += 1;
    const elapsed = now - sampleStart;
    if (elapsed >= 500) {
      const memory = (
        performance as Performance & {
          memory?: { usedJSHeapSize: number };
        }
      ).memory;
      const renderStats = city.ref.renderStats();
      const sampledFrames = Math.max(1, sampleFrames);
      controls?.updatePerformance({
        ...renderStats,
        calls: (renderStats.calls - previousCalls) / sampledFrames,
        triangles: (renderStats.triangles - previousTriangles) / sampledFrames,
        mirrorCalls: (renderStats.mirrorCalls - previousMirrorCalls) / sampledFrames,
        mirrorTriangles:
          (renderStats.mirrorTriangles - previousMirrorTriangles) / sampledFrames,
        lampCalls: (renderStats.lampCalls - previousLampCalls) / sampledFrames,
        lampTriangles:
          (renderStats.lampTriangles - previousLampTriangles) / sampledFrames,
        fps: (sampleFrames * 1000) / elapsed,
        frameMs: elapsed / sampleFrames,
        heapMb: memory ? memory.usedJSHeapSize / 1048576 : undefined,
      });
      previousCalls = renderStats.calls;
      previousTriangles = renderStats.triangles;
      previousMirrorCalls = renderStats.mirrorCalls;
      previousMirrorTriangles = renderStats.mirrorTriangles;
      previousLampCalls = renderStats.lampCalls;
      previousLampTriangles = renderStats.lampTriangles;
      sampleStart = now;
      sampleFrames = 0;
    }
    frameHandle = requestAnimationFrame(samplePerformance);
  };
  frameHandle = requestAnimationFrame(samplePerformance);
  view.attribution?.add([
    {
      attribution: "Google Satellite",
      attributionUrl: "https://www.google.com/maps",
    },
    {
      attribution:
        "Hong Kong SAR Government open data · OpenStreetMap contributors",
      attributionUrl: "https://data.gov.hk/",
    },
    {
      attribution: "Orthophoto: Lands Department, HKSAR (TDOP)",
      attributionUrl: "https://www.landsd.gov.hk/",
    },
  ]);
  return {
    view,
    dispose: () => {
      cancelAnimationFrame(frameHandle);
      controls?.dispose();
    },
  };
}
