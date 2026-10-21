<script setup lang="ts">
import { AlertTriangle, Globe2, Loader2 } from "lucide-vue-next";
import CameraHud from "./components/gallery/CameraHud.vue";
import ExampleControlPanel from "./components/gallery/ExampleControlPanel.vue";
import ExampleSidebar from "./components/gallery/ExampleSidebar.vue";
import MapView from "./components/MapView.vue";
import { useExampleGallery } from "./composables/useExampleGallery";
import { localize } from "./examples/sections";

const { state, errorMessage, current } = useExampleGallery();

const loadingTitle = () =>
  current.value ? localize(current.value.meta.title, "en") : "";
</script>

<template>
  <div class="app-shell">
    <MapView />

    <ExampleSidebar />
    <ExampleControlPanel />
    <CameraHud />

    <!-- 加载遮罩：示例切换 / 首次初始化 -->
    <Transition name="fade">
      <div v-if="state === 'loading' || state === 'idle'" class="loading-overlay">
        <Loader2 class="loading-overlay__icon" :size="28" />
        <p>
          {{ state === "idle" ? "等待选择示例…" : `正在初始化「${loadingTitle()}」…` }}
        </p>
        <span class="loading-overlay__hint">WASM 引擎 + 渲染管线</span>
      </div>
    </Transition>

    <!-- 初始化失败提示 -->
    <Transition name="fade">
      <div v-if="state === 'error'" class="error-banner" role="alert">
        <AlertTriangle :size="16" />
        <div>
          <strong>示例运行失败</strong>
          <p>{{ errorMessage }}</p>
          <span>请从左侧画廊选择其他示例重试。</span>
        </div>
      </div>
    </Transition>

    <!-- 品牌角标 -->
    <div class="brand">
      <Globe2 :size="13" />
      <span>@navaramap/three · Vue Example Gallery</span>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(13, 17, 23, 0.7);
  backdrop-filter: blur(4px);
  color: var(--text-dim);
  font-size: 13px;
}
.loading-overlay p {
  margin: 0;
  color: var(--text);
}
.loading-overlay__icon {
  color: var(--primary);
  animation: spin 1.1s linear infinite;
}
.loading-overlay__hint {
  color: var(--text-dim);
  font-size: 11px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误横幅 */
.error-banner {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 21;
  display: flex;
  gap: 10px;
  max-width: 520px;
  padding: 12px 16px;
  border: 1px solid rgba(248, 81, 73, 0.5);
  border-radius: 10px;
  background: rgba(248, 81, 73, 0.1);
  backdrop-filter: blur(8px);
  color: var(--error);
}
.error-banner strong {
  font-size: 12px;
}
.error-banner p {
  margin: 3px 0;
  color: var(--text);
  font-size: 11px;
  word-break: break-all;
}
.error-banner span {
  color: var(--text-dim);
  font-size: 11px;
}

/* 品牌角标 */
.brand {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  color: var(--text-dim);
  font-size: 10px;
  letter-spacing: 0.03em;
  pointer-events: none;
}
.brand svg {
  color: var(--primary);
}

/* 过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
