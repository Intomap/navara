import type { CityStats, CityWaterOptions } from "@navaramap/three-city";
import { Pane } from "tweakpane";

import type {
  CityControlActions,
  CityControlState,
  CityPerformance,
} from "./control-state";
import { addNightLightControls } from "./night-lights";

export function createCityControls(
  container: HTMLElement,
  state: CityControlState,
  actions: CityControlActions,
) {
  const host = document.createElement("div");
  host.className = "hk-city-lab";
  const style = document.createElement("style");
  style.textContent = STYLE;
  host.append(style);
  container.append(host);
  const pane = new Pane({ title: "Hong Kong · City Lab", container: host });
  const water = (): CityWaterOptions => ({
    amplitude: state.waterAmplitude,
    speed: state.waterSpeed,
    distortion: state.waterDistortion,
    reflection: state.waterReflection,
    roughness: state.waterRoughness,
  });
  const commit = (callback: () => void) => (event: { last?: boolean }) => {
    if (event.last !== false) callback();
  };

  const picture = pane.addFolder({ title: "Time / Picture", expanded: true });
  picture
    .addBinding(state, "time", { label: "HKT", min: 0, max: 24, step: 0.25 })
    .on("change", (event) => actions.setTime(event.value));
  picture
    .addBinding(state, "exposure", { min: 0.4, max: 5, step: 0.05 })
    .on("change", (event) => actions.setExposure(event.value));
  picture
    .addBinding(state, "bloom", { min: 0, max: 1, step: 0.01 })
    .on("change", (event) => actions.setBloom(event.value));

  const light = pane.addFolder({ title: "Light / Shadows", expanded: false });
  light
    .addBinding(state, "sun", { min: 0, max: 3, step: 0.05 })
    .on("change", (event) => actions.setSun(event.value));
  light
    .addBinding(state, "sky", { min: 0, max: 8, step: 0.1 })
    .on("change", (event) => actions.setSky(event.value));
  light
    .addBinding(state, "ambient", { min: 0, max: 2.5, step: 0.05 })
    .on("change", (event) => actions.setAmbient(event.value));
  light
    .addBinding(state, "shadowIntensity", {
      label: "shadow",
      min: 0,
      max: 1,
      step: 0.05,
    })
    .on("change", (event) =>
      actions.setShadow({ shadowIntensity: event.value }),
    );
  light
    .addBinding(state, "shadowFar", {
      label: "shadow far",
      min: 500,
      max: 10000,
      step: 250,
    })
    .on(
      "change",
      commit(() => actions.setShadow({ shadowFar: state.shadowFar })),
    );
  light
    .addBinding(state, "shadowMapSize", {
      label: "shadow map",
      options: { "1K": 1024, "2K": 2048, "4K": 4096 },
    })
    .on(
      "change",
      commit(() => actions.setShadow({ shadowMapSize: state.shadowMapSize })),
    );
  light
    .addBinding(state, "shadowRadius", {
      label: "softness",
      min: 0,
      max: 4,
      step: 0.1,
    })
    .on("change", (event) => actions.setShadow({ shadowRadius: event.value }));
  light
    .addBinding(state, "shadowNormalBias", {
      label: "normal bias",
      min: 0,
      max: 3,
      step: 0.05,
    })
    .on("change", (event) =>
      actions.setShadow({ shadowNormalBias: event.value }),
    );
  light
    .addBinding(state, "shadowBias", {
      label: "depth bias",
      min: -0.0005,
      max: 0.0005,
      step: 0.00001,
    })
    .on("change", (event) => actions.setShadow({ shadowBias: event.value }));

  const city = pane.addFolder({ title: "City / Dynamics", expanded: false });
  city
    .addBinding(state, "quality", {
      options: { High: "high", Performance: "low" },
    })
    .on("change", (event) => actions.setQuality(event.value));
  city.addBinding(state, "radius", { min: 500, max: 3000, step: 50 }).on(
    "change",
    commit(() => actions.setCity({ radius: state.radius })),
  );
  city.addBinding(state, "concurrency", { min: 1, max: 8, step: 1 }).on(
    "change",
    commit(() => actions.setCity({ concurrency: state.concurrency })),
  );
  city
    .addBinding(state, "ortho", { label: "orthophoto" })
    .on("change", (event) => actions.setCity({ ortho: event.value }));
  city
    .addBinding(state, "googleMap", { label: "google map" })
    .on("change", (event) => actions.setGoogleMap(event.value));
  city
    .addBinding(state, "traffic")
    .on("change", (event) => actions.setCity({ traffic: event.value }));
  city.addBinding(state, "cars", { min: 0, max: 600, step: 20 }).on(
    "change",
    commit(() => actions.setCity({ cars: state.cars })),
  );
  city
    .addBinding(state, "trains")
    .on("change", (event) => actions.setCity({ trains: event.value }));
  city.addBinding(state, "birds", { min: 0, max: 200, step: 10 }).on(
    "change",
    commit(() => actions.setCity({ birds: state.birds })),
  );

  addNightLightControls(pane, state, actions);

  const waterFolder = pane.addFolder({ title: "Water / Sky", expanded: true });
  waterFolder
    .addBinding(state, "mirror")
    .on("change", (event) =>
      actions.setMirror(event.value, state.mirrorScale, state.mirrorInterval),
    );
  waterFolder
    .addBinding(state, "mirrorScale", {
      label: "mirror scale",
      min: 0.25,
      max: 1,
      step: 0.05,
    })
    .on(
      "change",
      commit(() =>
        actions.setMirror(
          state.mirror,
          state.mirrorScale,
          state.mirrorInterval,
        ),
      ),
    );
  waterFolder
    .addBinding(state, "mirrorInterval", {
      label: "mirror interval",
      options: { "Every frame": 1, "Every 2 frames": 2, "Every 3 frames": 3 },
    })
    .on(
      "change",
      commit(() =>
        actions.setMirror(
          state.mirror,
          state.mirrorScale,
          state.mirrorInterval,
        ),
      ),
    );
  for (const [key, label, min, max, step] of [
    ["waterAmplitude", "amplitude", 0, 0.2, 0.005],
    ["waterSpeed", "speed", 0, 3, 0.05],
    ["waterDistortion", "distortion", 0, 3, 0.05],
    ["waterReflection", "reflection", 0, 2, 0.05],
    ["waterRoughness", "roughness", 0.01, 0.5, 0.01],
  ] as const) {
    waterFolder
      .addBinding(state, key, { label, min, max, step })
      .on("change", () => actions.setCity({ water: water() }));
  }
  waterFolder
    .addBinding(state, "cloudCoverage", {
      label: "cloud cover",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (event) => actions.setClouds({ coverage: event.value }));
  waterFolder
    .addBinding(state, "cloudQuality", {
      label: "cloud quality",
      options: { Low: "low", Medium: "medium", High: "high", Ultra: "ultra" },
    })
    .on("change", (event) => actions.setClouds({ qualityPreset: event.value }));
  waterFolder
    .addBinding(state, "cloudShadows", { label: "cloud shadows" })
    .on("change", (event) => actions.setClouds({ shadows: event.value }));

  const monitor = {
    city: "Loading…",
    fps: "—",
    frame: "—",
    draws: "—",
    triangles: "—",
    resources: "—",
    mirror: "—",
    lamp: "—",
    heap: "—",
  };
  const performance = pane.addFolder({ title: "Performance", expanded: true });
  for (const key of [
    "fps",
    "frame",
    "draws",
    "triangles",
    "resources",
    "mirror",
    "lamp",
    "city",
    "heap",
  ] as const) {
    performance.addBinding(monitor, key, { readonly: true, interval: 500 });
  }
  return {
    refresh: () => pane.refresh(),
    updateCityStats: (stats: CityStats) => {
      monitor.city = `${stats.loaded}/${stats.total} tiles · ${stats.pending} pending · ${(stats.bytes / 1048576).toFixed(0)} MB`;
    },
    updatePerformance: (stats: CityPerformance) => {
      monitor.fps = `${stats.fps.toFixed(1)} fps`;
      monitor.frame = `${stats.frameMs.toFixed(1)} ms`;
      monitor.draws = `${stats.calls.toFixed(0)} calls`;
      monitor.triangles = `${(stats.triangles / 1000).toFixed(0)}k tris`;
      monitor.resources = `${stats.geometries} geo · ${stats.textures} tex`;
      monitor.mirror = `mirror ${(stats.mirrorTriangles / 1000).toFixed(0)}k tris · ${stats.mirrorCalls.toFixed(0)} calls`;
      monitor.lamp = `lamp ${(stats.lampTriangles / 1000).toFixed(0)}k tris · ${stats.lampCalls.toFixed(0)} calls`;
      monitor.heap =
        stats.heapMb === undefined
          ? "Heap unavailable"
          : `${stats.heapMb.toFixed(0)} MB JS heap`;
    },
    dispose: () => {
      pane.dispose();
      host.remove();
    },
  };
}

export type CityControls = ReturnType<typeof createCityControls>;

const STYLE = `
.hk-city-lab{position:absolute;top:16px;right:16px;z-index:12;width:304px;max-height:calc(100% - 32px);overflow:auto;border:1px solid rgba(125,211,252,.18);border-radius:12px;background:rgba(17,24,39,.92);box-shadow:0 16px 44px rgba(0,0,0,.38);backdrop-filter:blur(18px);font-family:Roboto,Inter,system-ui,sans-serif;color:#e5e7eb}
.hk-city-lab .tp-rotv{--tp-base-background-color:rgba(17,24,39,.96);--tp-base-shadow-color:transparent;--tp-button-background-color:#1f2937;--tp-button-foreground-color:#7dd3fc;--tp-container-background-color:#1f2937;--tp-container-foreground-color:#e5e7eb;--tp-groove-foreground-color:rgba(125,211,252,.15);--tp-input-background-color:#111827;--tp-input-foreground-color:#e5e7eb;--tp-label-foreground-color:#9ca3af;--tp-monitor-background-color:#111827;--tp-monitor-foreground-color:#7dd3fc;font-size:11px}
.hk-city-lab .tp-rotv_title{font-size:13px;font-weight:600;letter-spacing:.01em}
.hk-city-lab .tp-fldv_title{font-size:12px;font-weight:500;color:#7dd3fc}
.hk-city-lab .tp-lblv_l,.hk-city-lab .tp-mllv_l{font-size:11px}
@media(max-width:700px){.hk-city-lab{right:8px;top:8px;width:min(280px,calc(100% - 16px));max-height:70%}}
`;
