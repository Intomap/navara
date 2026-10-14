import { ref, shallowRef } from "vue";
import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import {
  MapLibreStylePlugin,
  fetchFontStyleOverrides,
  type StyleSpecification,
} from "@navaramap/maplibre-style";
import type { FeatureCollection } from "geojson";
import type { Layer, Source } from "@navaramap/three";

// openfreemap 暗色 MapLibre Style JSON 的精简版（标准 MapLibre Style Spec）：
// 矢量源 openmaptiles（MVT），由 MapLibreStylePlugin 翻译成 Navara 的
// source / layer / FeatureEvaluator。相对 openfreemap-dark.json 去掉了 27 个图层，
// 以及插件不支持的 `sprite` / `glyphs` / `icon-image` / `fill-pattern` /
// `line-dasharray` / `line-blur` / `fill-outline-color` / `text-halo-blur` 等。
import openFreeMapDark from "../../openfreemap-dark-simple.json";

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

/**
 * 场景模式：
 * - `maplibre` —— `openfreemap-dark.json` 整份 MapLibre Style JSON 交给
 *                 `MapLibreStylePlugin` 渲染（对照 docs `maplibre_style/maplibre-style-plugin`）。
 * - `mvt`      —— OpenFreeMap 全球矢量瓦片（OpenMapTiles schema），手写
 *                 water / building / transportation 三个子图层。
 *                 对照 `example/pages/styling/mvt-line-labels`。
 * - `raster`   —— OSM 栅格瓦片 + 写实天空（原验证场景）
 */
export type BasemapMode = "maplibre" | "mvt" | "raster";

export type CameraReadout = {
  lng: number;
  lat: number;
  height: number;
};

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * MapLibre Style 的 `glyphs` 不被 Navara 支持（插件会告警），文本标注改用
 * style overrides 注入 `font-faces` —— 见 md 的 “With Font Configuration”。
 * style 里 `text-font: ["Noto Sans Regular"]` 匹配不到时会回退到第一个可用字体。
 */
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap";

const MAPLIBRE_STYLE = openFreeMapDark as unknown as StyleSpecification;

/**
 * 全球矢量瓦片源（OpenMapTiles schema）。OpenFreeMap 每周重新发布一次构建产物，
 * 这个 TileJSON 端点始终指向当前构建；用法对照 navara 示例
 * `example/pages/styling/mvt-line-labels`。
 */
const OPEN_FREE_MAP_TILEJSON = "https://tiles.openfreemap.org/planet";

/** 深色栅格底图（与深色矢量图层同调），取自示例 `mvt-line-labels` 的同款 TileJSON。 */
const DARK_BASEMAP_TILEJSON =
  "https://papers.reearth.land/styles/papers-dark/tilejson.json";

/**
 * OpenMapTiles 子图层配色。
 *
 * 与 `maplibre` 场景的取舍：整份 MapLibre Style 的每个图层都会对每个 feature 跑一遍
 * 求值器，且瓦片覆盖整颗星球；这里只手写 3 个子图层，代价小得多。
 */
const MVT_LAYER_COLORS = {
  water: "#0e1626",
  building: "#23262c",
  transportation: "#4a5261",
} as const;

/** 取景中心：香港维多利亚港（中环—尖沙咀一带）。所有场景都以这里为准。 */
const HK_CAMERA = { lng: 114.1595, lat: 22.2895 } as const;

const view = shallowRef<ThreeView<DefaultDescriptions> | null>(null);
const state = ref<NavaraViewState>("pending");
const errorMessage = ref("");
const cameraReadout = ref<CameraReadout>({ lng: 0, lat: 0, height: 0 });
const overlayAdded = ref(false);
const basemapMode = ref<BasemapMode>("maplibre");

let initializing: Promise<void> | null = null;
/** 挂载容器，用于切换场景时原地重建视图。 */
let containerEl: HTMLElement | null = null;
let overlaySource: Source | null = null;
let overlayLayer: Layer | null = null;

// 演示多边形：香港中环—金钟一带（港岛北岸），避免使用需要 API key 的数据集。
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
            [114.1535, 22.279],
            [114.1665, 22.279],
            [114.1665, 22.287],
            [114.1535, 22.287],
            [114.1535, 22.279],
          ],
        ],
      },
    },
  ],
};

function updateCameraReadout(): void {
  const v = view.value;
  if (!v) return;
  try {
    const { lng, lat, height } = v.camera.positionGeographic;
    cameraReadout.value = { lng, lat, height };
  } catch {
    // 相机实体（CameraMarker）在首帧 ECS 更新后才建立，早于此时读取会命中
    // `positionGeographic` 的 invariant。setCamera 会触发 "move"，届时即可读到有效值。
  }
}

/** 加载 Google Fonts 覆盖；失败时降级为「无文本标注」而非中断整个场景。 */
async function loadFontOverrides(): Promise<
  Partial<StyleSpecification> | undefined
> {
  try {
    return await fetchFontStyleOverrides("Open Sans", FONT_CSS_URL);
  } catch (err) {
    console.warn(
      "[vue-example] 字体覆盖加载失败，MapLibre style 的文本标注将不会渲染：",
      err,
    );
    return undefined;
  }
}

/**
 * MapLibre Style 场景：`openfreemap-dark.json` 由 `MapLibreStylePlugin` 全量渲染。
 *
 * 插件在 `init()` 阶段就把 style 里的 sources / layers / background / terrain 建好，
 * 这里只补 style 没有覆盖到的部分（基础椭球面、光源、相机、署名）。
 */
function buildMapLibreScene(
  v: ThreeView<DefaultDescriptions>,
  defaultPlugin: DefaultPlugin,
): void {
  // 矢量图层多为 clampToGround，需要一层基础椭球面来贴合。
  v.addLayer({ type: "terrain", ellipsoid: {} });

  // 诊断：非 draped 要素是否需要一层栅格瓦片承载合成
  const probeBasemap = v.addSource({
    type: "raster-tile",
    url: OSM_TILE_URL,
    maxZoom: 19,
  });
  v.addLayer({ type: "raster", source: probeBasemap });

  // 插件以 `clampToGround: false` 建层（见 createScene 的说明），那些图层是 lit
  // 材质：没有光源会整片渲染成黑色。
  defaultPlugin.addDefaultPhotorealScene();
  v.addLight({ ambient: { intensity: 1 } });

  // 精简版 style 没有 center/zoom 根属性（有的话插件会自动套用），手动给个香港近景。
  v.setCamera({
    lng: HK_CAMERA.lng,
    lat: HK_CAMERA.lat,
    height: 3000,
    heading: 20,
    pitch: -50,
    roll: 0,
  });

  // TileJSON 里带的 attribution 会由内置署名 UI 自动展示；这里按 md 示例补上手写的信用。
  v.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
    {
      attribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap",
      attributionUrl: "https://openfreemap.org/",
    },
  ]);
}

/**
 * MVT 场景：深色栅格底图 + OpenFreeMap 全球矢量瓦片（OpenMapTiles schema）。
 *
 * 一个 `vector-tile` 源支撑多个子图层，这里只建 water / building / transportation
 * 三层；代价 = 视口内的少量瓦片 × 3 次求值，与 `maplibre` 场景（20 个图层）形成对照。
 */
async function buildMvtScene(
  v: ThreeView<DefaultDescriptions>,
  tileJsonPlugin: TileJsonPlugin,
): Promise<void> {
  v.setCamera({
    lng: HK_CAMERA.lng,
    lat: HK_CAMERA.lat,
    height: 6000,
    heading: 0,
    pitch: -50,
    roll: 0,
  });

  // clampToGround 的矢量图层需要一层基础椭球面来贴合。
  v.addLayer({ type: "terrain", ellipsoid: {} });

  // TileJSON 是「文档」而不是 `{z}/{x}/{y}` 模板，必须走 TileJsonPlugin.addSource：
  // 插件会取文档里的模板 / 缩放范围，并把文档的 attribution 注册到内置署名 UI。
  const basemap = await tileJsonPlugin.addSource({
    type: "raster-tile",
    id: "mvt-basemap",
    url: DARK_BASEMAP_TILEJSON,
  });
  v.addLayer({ type: "raster", source: basemap });

  // OpenFreeMap 每周重新发布，TileJSON 端点始终指向当前构建，避免钉死的日期路径失效。
  const planet = await tileJsonPlugin.addSource({
    type: "vector-tile",
    id: "openfreemap-planet",
    url: OPEN_FREE_MAP_TILEJSON,
  });

  v.addLayer({
    type: "vector",
    source: planet,
    sourceLayers: ["water"],
    polygon: {
      color: new Color().setStyle(MVT_LAYER_COLORS.water),
      clampToGround: true,
    },
  });
  v.addLayer({
    type: "vector",
    source: planet,
    sourceLayers: ["building"],
    polygon: {
      color: new Color().setStyle(MVT_LAYER_COLORS.building),
      clampToGround: true,
    },
  });
  v.addLayer({
    type: "vector",
    source: planet,
    sourceLayers: ["transportation"],
    polyline: {
      color: new Color().setStyle(MVT_LAYER_COLORS.transportation),
      width: 2,
      clampToGround: true,
    },
  });

  // 署名条目只认 attribution / attributionUrl（`url` 是数据源的字段，不是署名字段）。
  v.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    },
  ]);
}

/** 栅格场景：OSM 瓦片 + 写实天空。 */
function buildRasterScene(
  v: ThreeView<DefaultDescriptions>,
  defaultPlugin: DefaultPlugin,
): void {
  defaultPlugin.addDefaultPhotorealScene();
  v.setCamera({
    lng: HK_CAMERA.lng,
    lat: HK_CAMERA.lat,
    height: 30000,
    heading: 0,
    pitch: -35,
    roll: 0,
  });

  const basemapSource = v.addSource({
    type: "raster-tile",
    url: OSM_TILE_URL,
    maxZoom: 18,
  });
  v.addLayer({ type: "raster", source: basemapSource });
}

/** 按场景模式构建视图（含插件注册、init 与初始图层）。 */
async function createScene(
  mode: BasemapMode,
  container: HTMLElement,
): Promise<ThreeView<DefaultDescriptions>> {
  const v = new ThreeView<DefaultDescriptions>({ container });
  const defaultPlugin = new DefaultPlugin();
  v.addPlugin(defaultPlugin);

  // `maplibre` 与 `mvt` 两个场景都要解析 TileJSON 文档，各自注册一个 TileJsonPlugin。
  // 所有插件都必须在 init() 之前注册。
  if (mode === "maplibre") {
    // 对照 md 的 Complete Example：TileJsonPlugin 显式注册、并通过 `tileJsonPlugin`
    // 选项注入给 MapLibreStylePlugin（style 里矢量源的 TileJSON 由它解析）。
    const tileJsonPlugin = new TileJsonPlugin();
    v.addPlugin(tileJsonPlugin);
    v.addPlugin(
      new MapLibreStylePlugin(MAPLIBRE_STYLE, {
        overrides: await loadFontOverrides(),
        tileJsonPlugin,
        // style 里存在依赖 zoom 的表达式，用 MapLibre 的固定 FOV 才能算出一致的 zoom。
        forceMapLibreFov: true,
        // 默认 true 会把每个图层都做成 clamp-to-ground（烘焙进 tile 纹理），而每个
        // tile 的 drape 槽位只有 floor(maxTextures / 2) 个（16 纹理单元的设备上是 5，
        // 32 的是 13）。这份 style 有 28 个图层，超出预算的会被静默丢弃 —— 表现就是
        // 控制台刷 `[TileMesh] Exceeded maximum MVT texture slots`、道路整片不见。
        // 关掉 draped 走 MRT 场景的 mesh 路径，不占槽位；代价是这些图层变成 lit 材质
        // （所以要补光源）且不再跟随地形（本场景是椭球面，正好贴得平）。
        clampToGround: false,
      }),
    );

    await v.init();
    buildMapLibreScene(v, defaultPlugin);
  } else if (mode === "mvt") {
    const tileJsonPlugin = new TileJsonPlugin();
    v.addPlugin(tileJsonPlugin);

    await v.init();
    await buildMvtScene(v, tileJsonPlugin);
  } else {
    await v.init();
    buildRasterScene(v, defaultPlugin);
  }

  return v;
}

/** 由 MapView 在 onMounted 时调用；并发/重复调用只会初始化一次。 */
export function mountNavaraView(
  container: HTMLElement,
  mode: BasemapMode = basemapMode.value,
): Promise<void> {
  if (view.value) return Promise.resolve();
  if (initializing) return initializing;

  containerEl = container;
  basemapMode.value = mode;

  initializing = (async () => {
    state.value = "pending";
    errorMessage.value = "";
    try {
      const v = await createScene(mode, container);

      view.value = v;
      // setCamera 产生的 "move" 是首屏读数的主来源；同步调用 + 下一帧兜底，
      // 覆盖相机实体已/尚未建立两种情况。
      v.camera.on("move", updateCameraReadout);
      updateCameraReadout();
      requestAnimationFrame(updateCameraReadout);

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

/** 切换场景：销毁当前视图后在原容器重建（图层没法在同一视图上整体热替换）。 */
export async function setBasemapMode(mode: BasemapMode): Promise<void> {
  if (mode === basemapMode.value && view.value) return;

  const container = containerEl;
  disposeNavaraView();
  basemapMode.value = mode;
  if (container) await mountNavaraView(container, mode);
}

export async function flyToDemo(): Promise<void> {
  const v = view.value;
  if (!v) return;
  try {
    // 香港中环（皇后像广场一带）近景。
    await v.flyTo(
      {
        lng: 114.16,
        lat: 22.281,
        height: 2500,
        heading: 20,
        pitch: -50,
        roll: 0,
      },
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
    basemapMode,
    flyToDemo,
    setBasemapMode,
    addOverlay,
    recolorOverlay,
    removeOverlay,
  };
}
