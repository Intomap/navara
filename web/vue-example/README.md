# vue-example

精简的 Vue 3 + Vite + TypeScript 验证环境，作为 `@navaramap/three`（`ThreeView`）SDK 功能的开发调试宿主。目标是让"改 SDK → 写 demo → 验证"这个循环跑在你熟悉的技术栈上。

## 快速开始

前置条件（一次性，仓库级）：`cargo make prepare`（先编 WASM 再 `pnpm i`，顺序不能反——`@navaramap/engine` 等 workspace 包指向 `web/wasm/*` 的 wasm-bindgen 产物）。

```bash
# 仓库根执行
pnpm i                      # 新增/修改依赖后
pnpm --filter @navaramap/vue-example dev
# 或
pnpm -C web/vue-example dev
```

打开终端输出的地址（默认 `http://localhost:5173/`，端口被占时 Vite 自动顺延）。

## 开发循环：改了什么，要做什么

| 改动位置                                 | 需要做什么                                     | 生效方式                               |
| ---------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `web/vue-example/src/**`（本包）         | 什么都不用做                                   | Vite HMR 即时生效                      |
| `web/navara_*` 各包 TS 源码              | 什么都不用做                                   | vite alias 直连各包 `src/`，保存即 HMR |
| `crates/**`（Rust）                      | `cargo make build-dev-all`，然后**刷新页面**   | WASM 是二进制产物，Vite 无法热更       |
| `shaders/**`（被 Rust/SDK 引用的 .glsl） | 同上（Rust 侧）或刷新（SDK 侧 alias 直连源码） | 视引用方而定                           |

Rust 改动想全自动重编：在仓库根另开一个终端跑 `cargo make dev`（cargo-watch 监听 `crates/` 自动 build-dev-all + Vite dev server）。注意本包的 dev server 端口与 `cargo make dev` 内起的 Vite 不同，二选一即可。

常用命令（本包目录内）：

```bash
pnpm type-check   # vue-tsc 类型检查
pnpm build        # vite build（生产构建，供根级 pnpm build 纳管）
pnpm test         # vitest（当前无测试文件，--passWithNoTests）
```

## 示例场景：MapLibre Style / MVT / 栅格

控制面板「场景」一栏可在三种场景间切换（切换 = 销毁当前 `ThreeView` 后在原容器重建）：

| 模式               | 内容                                                                                                                                          | 关键代码                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `maplibre`（默认） | `openfreemap-dark-simple.json`（精简版 style）交给 `MapLibreStylePlugin`（矢量源 openmaptiles，28 个图层、属性只留 supported.json 的 ✅）     | `useNavaraView.ts` `createScene` / `buildMapLibreScene` |
| `mvt`              | 深色栅格底图（TileJSON）+ 一个全球 `vector-tile` 源（OpenFreeMap / OpenMapTiles schema）+ 手写的 water / building / transportation 三个子图层 | `useNavaraView.ts` `buildMvtScene`                      |
| `raster`           | OSM 栅格瓦片底图 + 写实天空（原验证场景）                                                                                                     | `useNavaraView.ts` `buildRasterScene`                   |

### style 精简版：`openfreemap-dark-simple.json`

原始的全球暗色 style 里有大量依赖插件**不支持**能力的配置，直接渲染出来是残缺的（图标加载失败、虚线变实线、图案丢失）。`openfreemap-dark-simple.json` 是手工挑过图层、并按 `docs/src/content/docs/maplibre_style/supported.json` 逐项过滤属性的版本，当前 **28 个图层**。

**根属性**：去掉 `sprite`（❌，`icon-image` 会被当成 URL 去加载，必然 404）、`glyphs`（❌，文本改由 `overrides["font-faces"]` 注入），以及没有任何图层引用的死源。

**因能力缺失而整体删掉的图层**：`road_oneway`、`road_oneway_opposite` —— 它们只由 `icon-image`（sprite 图标）+ `icon-opacity` 构成，剥掉图标后 `toLayerDescription` 会判定 "no icon-image or text-field" 而跳过，只剩一条加载警告。

**从保留图层上剥掉的属性**（❌ 或在 `supported.json` 中未列出 → 配了也不生效）

| 属性                                                                            | 影响                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `fill-antialias`、`fill-outline-color`（`building` / `road_area_pier`）         | 楼块只剩单色填充，没有描边                                      |
| `line-dasharray`（`highway_path`、*_casing、`railway_*_dashline`）              | 虚线变实线；`railway_*_dashline` 变成压深色实线，仍能当"描芯"用 |
| `line-cap`、`line-join`（所有 line 图层）                                       | 端点一律按默认处理                                              |
| `symbol-placement`、`symbol-spacing`、`text-rotation-alignment`（`water_name`） | 不支持线排布；标注退化为「落在线串首顶点」的点标注              |
| `icon-image`、`icon-rotate`、`icon-opacity`、`symbol-spacing`                   | 见上：相关图层已整体删除                                        |

保留属性全部是 `supported.json` 里的 ✅（`background-color` / `fill-color` / `fill-opacity` / `line-color` / `line-opacity` / `line-width` / `text-field` / `text-font` / `text-size` / `text-color`）。

需要注意的取舍：

- 唯一保留的非 ✅ 属性是 `water_name` 的 `text-halo-color`，状态为 ⚠️「**只在图层构造时求值一次**」。本案是常量，结果与预期一致，所以保留；要彻底只留 ✅ 可以把它也删掉。
- `text-font: ["Noto Sans Regular"]` 在 `font-faces` 里找不到同名字体，插件会回退到注入的第一个字体（"Open Sans"）。

### `maplibre` 场景（对照 docs `maplibre_style/maplibre-style-plugin`）

按该页 **Complete Example** 的用法：

```ts
const tileJsonPlugin = new TileJsonPlugin();
view.addPlugin(tileJsonPlugin);
view.addPlugin(
  new MapLibreStylePlugin(style, {
    overrides: await fetchFontStyleOverrides("Open Sans", cssUrl),
    tileJsonPlugin,
    forceMapLibreFov: true,
  }),
);
await view.init();
view.attribution?.add([...]);
```

要点：

- 所有插件都必须在 `view.init()` **之前** `addPlugin()`；`TileJsonPlugin` 显式注册后通过 `tileJsonPlugin` 选项注入给 `MapLibreStylePlugin`（矢量源的 TileJSON 由它解析）。
- style 的 `glyphs` 不被支持（插件会告警），文本标注靠 `overrides["font-faces"]` 注入——即 md 的 “With Font Configuration”。
- `overrides` 目前**只合并 `font-faces`**，`layers` / `sources` 不会合并。
- `forceMapLibreFov: true` 用 MapLibre 的固定 FOV（≈36.87°）换算 zoom，style 里依赖 zoom 的表达式才会和 MapLibre 表现一致。
- 精简版没有 `center`/`zoom` 根属性（有的话插件会自动套用），相机由示例 `setCamera` 设定；`clampToGround` 的矢量图层额外加了一层 `{ type: "terrain", ellipsoid: {} }`。
- **性能**：28 个图层，每层都会对每个 feature 跑一遍求值器，且瓦片覆盖整颗星球——代价随视口瓦片数线性放大，缩放/平移时仍比 `mvt` 场景卡；两个场景的对比正是本 demo 的用途之一。

### `mvt` 场景

数据源与写法对照 navara 示例 `example/pages/styling/mvt-line-labels`：全球矢量瓦片走 `TileJsonPlugin.addSource({ type: "vector-tile", url: "https://tiles.openfreemap.org/planet" })`（OpenFreeMap 每周重新发布，TileJSON 端点始终指向当前构建，避免钉死的日期路径失效）。要点：

- 一个 `vector-tile` 源可支撑多个 `vector` 图层（`sourceLayers: ["..."]` 分别取各子图层）；这里建 water / building / transportation 三层，代价 = 视口内少量瓦片 × 3 次求值。
- `clampToGround` 的矢量图层需要一层基础椭球面（`{ type: "terrain", ellipsoid: {} }`）来贴合。
- 栅格底图也是 TileJSON 文档（不是 `{z}/{x}/{y}` 模板），必须走 `TileJsonPlugin.addSource`——`view.addSource` 会把整串 URL 当成模板去请求。插件同时会把文档里的 `attribution` 注册到内置署名 UI。

## 取景

三个场景都取景香港维多利亚港（`useNavaraView.ts` 的 `HK_CAMERA`，中环—尖沙咀一带），「飞行到香港中环」按钮与叠加演示多边形（港岛北岸中环—金钟）也在同一区域。

场景切换统一走「dispose → 重新 mount」：图层/插件配置没法在同一视图上整体热替换。

## 写验证 demo 的姿势

1. **加验证动作**：在 `src/composables/useNavaraView.ts` 里加一个 action（拿到 `view.value` 句柄直接调 SDK API），在 `src/App.vue` 控制面板加对应按钮。
2. **复用 MapView**：`src/components/MapView.vue` 已封装完整生命周期（挂载创建 / 卸载 `dispose()` / HMR 安全），一般不需要动。
3. SDK 的 API 细节查 https://navara.world/docs/ 或各包 `.d.ts`；仓库内的提炼规则见 `skills/navara-usage/SKILL.md`。

## SDK 初始化不变式（违反会 throw 或渲染异常）

```ts
const view = new ThreeView<DefaultDescriptions>({ container });
view.addPlugin(new DefaultPlugin()); // 1. 必须在 init() 之前
await view.init(); // 2. WASM + workers + 管线
defaultPlugin.addDefaultPhotorealScene(); // 3. init 之后才能 addSource/addLayer/addLight
view.setCamera({ lng, lat, height, heading, pitch, roll }); // 度数/米
```

其他易踩点：

- 依赖 WASM 的数学函数（`degreeToRadian` 等）只能在 `init()` 之后调用，不能放模块顶层。
- 相机事件监听在 `view.camera` 上（`move` / `moveend`），不是 view 本身。
- `layer.update()` 是整配置替换，`source.update()` 是部分合并。
- 页面每个 `navara_wasm_*` 模块都报 `does not provide an export named ...` ⇒ WASM 产物比 TS 源码旧，重跑 `cargo make build-dev-all`。

## 本包 vite 配置要点（排障备忘）

- `wasm()` + `topLevelAwait()` 仅 dev 启用（生产构建下 topLevelAwait 的 esbuild 转换与 Vite 8 不兼容；现代浏览器原生支持 TLA，与仓库其他包做法一致）。
- `@navaramap/*` 与 `@shaders` 用显式 `resolve.alias` 指向源码（tsconfig paths 插件在生产构建阶段不生效，故不能只靠它）。引入新的 workspace 包（例如 `@navaramap/maplibre-style`）时要同步补 alias 与 tsconfig `paths`；被引入包自己的 `@navaramap/*` 依赖（如 `@navaramap/three-plugins`）也要加，否则其内部 import 解析不到。
- `server.fs.allow` 放开仓库根，允许服务兄弟包源码。
