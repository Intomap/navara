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

| 改动位置 | 需要做什么 | 生效方式 |
| --- | --- | --- |
| `web/vue-example/src/**`（本包） | 什么都不用做 | Vite HMR 即时生效 |
| `web/navara_*` 各包 TS 源码 | 什么都不用做 | vite alias 直连各包 `src/`，保存即 HMR |
| `crates/**`（Rust） | `cargo make build-dev-all`，然后**刷新页面** | WASM 是二进制产物，Vite 无法热更 |
| `shaders/**`（被 Rust/SDK 引用的 .glsl） | 同上（Rust 侧）或刷新（SDK 侧 alias 直连源码） | 视引用方而定 |

Rust 改动想全自动重编：在仓库根另开一个终端跑 `cargo make dev`（cargo-watch 监听 `crates/` 自动 build-dev-all + Vite dev server）。注意本包的 dev server 端口与 `cargo make dev` 内起的 Vite 不同，二选一即可。

常用命令（本包目录内）：

```bash
pnpm type-check   # vue-tsc 类型检查
pnpm build        # vite build（生产构建，供根级 pnpm build 纳管）
pnpm test         # vitest（当前无测试文件，--passWithNoTests）
```

## 写验证 demo 的姿势

1. **加验证动作**：在 `src/composables/useNavaraView.ts` 里加一个 action（拿到 `view.value` 句柄直接调 SDK API），在 `src/App.vue` 控制面板加对应按钮。
2. **复用 MapView**：`src/components/MapView.vue` 已封装完整生命周期（挂载创建 / 卸载 `dispose()` / HMR 安全），一般不需要动。
3. SDK 的 API 细节查 https://navara.world/docs/ 或各包 `.d.ts`；仓库内的提炼规则见 `skills/navara-usage/SKILL.md`。

## SDK 初始化不变式（违反会 throw 或渲染异常）

```ts
const view = new ThreeView<DefaultDescriptions>({ container });
view.addPlugin(new DefaultPlugin());  // 1. 必须在 init() 之前
await view.init();                    // 2. WASM + workers + 管线
defaultPlugin.addDefaultPhotorealScene();  // 3. init 之后才能 addSource/addLayer/addLight
view.setCamera({ lng, lat, height, heading, pitch, roll });  // 度数/米
```

其他易踩点：

- 依赖 WASM 的数学函数（`degreeToRadian` 等）只能在 `init()` 之后调用，不能放模块顶层。
- 相机事件监听在 `view.camera` 上（`move` / `moveend`），不是 view 本身。
- `layer.update()` 是整配置替换，`source.update()` 是部分合并。
- 页面每个 `navara_wasm_*` 模块都报 `does not provide an export named ...` ⇒ WASM 产物比 TS 源码旧，重跑 `cargo make build-dev-all`。

## 本包 vite 配置要点（排障备忘）

- `wasm()` + `topLevelAwait()` 仅 dev 启用（生产构建下 topLevelAwait 的 esbuild 转换与 Vite 8 不兼容；现代浏览器原生支持 TLA，与仓库其他包做法一致）。
- `@navaramap/*` 与 `@shaders` 用显式 `resolve.alias` 指向源码（tsconfig paths 插件在生产构建阶段不生效，故不能只靠它）。
- `server.fs.allow` 放开仓库根，允许服务兄弟包源码。
