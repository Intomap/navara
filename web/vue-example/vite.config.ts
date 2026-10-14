import { normalizePath } from "vite";
import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfigPaths from "vite-tsconfig-paths";

// Sibling workspace packages resolve directly to their sources, in dev AND
// build, so editing web package sources hot-reloads without building their
// dist. Explicit aliases are used instead of tsconfig `paths` because the
// vite-tsconfig-paths plugin does not apply during production builds.
const pkgSrc = (name: string) =>
  normalizePath(path.resolve(__dirname, `../${name}/src`));

const alias = {
  "@shaders": normalizePath(path.resolve(__dirname, "../../shaders")),
  "@navaramap/three": pkgSrc("navara_three"),
  "@navaramap/core": pkgSrc("navara_core"),
  "@navaramap/font": pkgSrc("navara_font"),
  "@navaramap/three-api": pkgSrc("navara_three_api"),
  "@navaramap/three-csm": pkgSrc("navara_three_csm"),
  "@navaramap/three-default-descs": pkgSrc("navara_three_default_descs"),
  "@navaramap/three-default-plugin": pkgSrc("navara_three_default_plugin"),
  "@navaramap/three-plugins": pkgSrc("navara_three_plugins"),
  "@navaramap/maplibre-style": pkgSrc("navara_maplibre_style"),
  "@navaramap/worker": pkgSrc("navara_worker"),
};

// Minimal dev-focused config:
// - `wasm()` + `topLevelAwait()` are required in dev: the wasm-bindgen modules
//   under web/wasm/* use top-level await and would fail to load without them.
//   They are excluded from production builds exactly like
//   web/vite.config.common.ts / vite.config.example.ts do (topLevelAwait's
//   esbuild pass is incompatible with Vite 8's bundle; modern targets support
//   top-level await natively).
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    glsl(),
    tsconfigPaths(),
    ...(mode !== "production" ? [wasm(), topLevelAwait()] : []),
  ],
  resolve: {
    alias,
    dedupe: ["three"],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  server: {
    host: true,
    fs: {
      // Allow serving sibling workspace package sources.
      allow: ["../.."],
    },
  },
  worker: {
    plugins: () => [tsconfigPaths()],
  },
  build: {
    outDir: "dist",
  },
}));
