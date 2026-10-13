import { ref, shallowRef } from "vue";
import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import type { FeatureCollection } from "geojson";
import type { Layer, Source } from "@navaramap/three";

/**
 * SDK 初始化不变式（违反会 throw 或渲染异常）：
 *   1. new ThreeView()
 *   2. addPlugin() —— 必须在 init() 之前
 *   3. await view.init()   —— WASM + workers + 管线
 *   4. addDefaultPhotorealScene() / setCamera / addSource / addLayer / addLight
 *
 * 注意：依赖 WASM 的数学函数（degreeToRadian 等）只能在 init() 之后调用，
 * 不能出现在模块顶层。
 */

export type NavaraViewState = "pending" | "ready" | "error";

export type CameraReadout = {
  lng: number;
  lat: number;
  height: number;
};

const view = shallowRef<ThreeView<DefaultDescriptions> | null>(null);
const state = ref<NavaraViewState>("pending");
const errorMessage = ref("");
const cameraReadout = ref<CameraReadout>({ lng: 0, lat: 0, height: 0 });
const overlayAdded = ref(false);

let initializing: Promise<void> | null = null;
let overlaySource: Source | null = null;
let overlayLayer: Layer | null = null;

// 内环（皇居一带）演示多边形，避免使用需要 API key 的数据集。
const DEMO_POLYGON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.763, 35.68],
            [139.776, 35.68],
            [139.776, 35.69],
            [139.763, 35.69],
            [139.763, 35.68],
          ],
        ],
      },
    },
  ],
};

function updateCameraReadout(): void {
  const v = view.value;
  if (!v) return;
  const { lng, lat, height } = v.camera.positionGeographic;
  cameraReadout.value = { lng, lat, height };
}

/** 由 MapView 在 onMounted 时调用；并发/重复调用只会初始化一次。 */
export function mountNavaraView(container: HTMLElement): Promise<void> {
  if (view.value) return Promise.resolve();
  if (initializing) return initializing;

  initializing = (async () => {
    state.value = "pending";
    errorMessage.value = "";
    try {
      const v = new ThreeView<DefaultDescriptions>({ container });
      const defaultPlugin = new DefaultPlugin();
      v.addPlugin(defaultPlugin);
      await v.init();
      defaultPlugin.addDefaultPhotorealScene();
      v.setCamera({
        lng: 139.745,
        lat: 35.658,
        height: 30000,
        heading: 0,
        pitch: -35,
        roll: 0,
      });

      const basemapSource = v.addSource({
        type: "raster-tile",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maxZoom: 18,
      });
      v.addLayer({ type: "raster", source: basemapSource });

      v.camera.on("move", updateCameraReadout);
      updateCameraReadout();

      view.value = v;
      state.value = "ready";
    } catch (err) {
      console.error("[vue-example] ThreeView init failed:", err);
      errorMessage.value = err instanceof Error ? err.message : String(err);
      state.value = "error";
    } finally {
      initializing = null;
    }
  })();
  return initializing;
}

/** 由 MapView 在 onBeforeUnmount 时调用（HMR 热重载也会走到这里）。 */
export function disposeNavaraView(): void {
  removeOverlay();
  view.value?.dispose();
  view.value = null;
  state.value = "pending";
  errorMessage.value = "";
}

export async function flyToDemo(): Promise<void> {
  const v = view.value;
  if (!v) return;
  try {
    await v.flyTo(
      { lng: 139.767, lat: 35.681, height: 2500, heading: 20, pitch: -50, roll: 0 },
      { duration: 2200 },
    );
  } catch (err) {
    console.error("[vue-example] flyTo failed:", err);
  }
}

export function addOverlay(): void {
  const v = view.value;
  if (!v || overlayAdded.value) return;
  overlaySource = v.addSource({ type: "geojson", data: DEMO_POLYGON });
  overlayLayer = v.addLayer({
    type: "vector",
    source: overlaySource,
    polygon: {
      show: true,
      color: new Color().setHex(0x0091ff),
      extrudedHeight: 500,
      clampToGround: false,
    },
  });
  overlayAdded.value = true;
}

/** 验证 handle.update 的部分合并语义：只改颜色，其余配置保留。 */
export function recolorOverlay(): void {
  if (!overlayLayer) return;
  overlayLayer.update({
    polygon: { color: new Color().setHex(0xff6b2c) },
  });
}

export function removeOverlay(): void {
  if (overlayLayer) {
    overlayLayer.delete();
    overlayLayer = null;
  }
  if (overlaySource) {
    overlaySource.delete();
    overlaySource = null;
  }
  overlayAdded.value = false;
}

export function useNavaraView() {
  return {
    view,
    state,
    errorMessage,
    cameraReadout,
    overlayAdded,
    flyToDemo,
    addOverlay,
    recolorOverlay,
    removeOverlay,
  };
}
