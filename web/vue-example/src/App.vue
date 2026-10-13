<script setup lang="ts">
import {
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Palette,
  Trash2,
} from "lucide-vue-next";
import { computed } from "vue";
import MapView from "./components/MapView.vue";
import {
  addOverlay,
  flyToDemo,
  recolorOverlay,
  removeOverlay,
  useNavaraView,
} from "./composables/useNavaraView";

const { state, errorMessage, cameraReadout, overlayAdded } = useNavaraView();

const ready = computed(() => state.value === "ready");
const statusLabel = computed(
  () =>
    ({
      pending: "初始化中",
      ready: "就绪",
      error: "错误",
    })[state.value],
);

const heightLabel = computed(() => {
  const h = cameraReadout.value.height;
  return h >= 1000 ? `${(h / 1000).toFixed(1)} km` : `${Math.round(h)} m`;
});
</script>

<template>
  <div class="app-shell">
    <MapView />

    <!-- 加载遮罩 -->
    <Transition name="fade">
      <div v-if="state === 'pending'" class="loading-overlay">
        <Loader2 class="loading-overlay__icon" :size="28" />
        <p>正在初始化 WASM 引擎与渲染管线…</p>
      </div>
    </Transition>

    <!-- 控制面板 -->
    <aside class="panel">
      <header class="panel__header">
        <h1>Navara SDK · Vue 验证环境</h1>
        <span class="panel__status" :data-state="state">
          <span class="panel__dot"></span>{{ statusLabel }}
        </span>
      </header>

      <p v-if="state === 'error'" class="panel__error" role="alert">
        初始化失败：{{ errorMessage }}
      </p>

      <div class="panel__section">
        <h2>相机</h2>
        <button
          class="panel__btn"
          :disabled="!ready"
          @click="flyToDemo"
        >
          <Navigation :size="14" />
          飞行到东京站
        </button>
      </div>

      <div class="panel__section">
        <h2>图层</h2>
        <button class="panel__btn" :disabled="!ready || overlayAdded" @click="addOverlay">
          <MapPin :size="14" />
          添加 GeoJSON 拉伸多边形
        </button>
        <button class="panel__btn" :disabled="!overlayAdded" @click="recolorOverlay">
          <Palette :size="14" />
          重着色（update 合并语义）
        </button>
        <button class="panel__btn panel__btn--danger" :disabled="!overlayAdded" @click="removeOverlay">
          <Trash2 :size="14" />
          删除图层与数据源
        </button>
      </div>

      <div class="panel__section panel__section--hint">
        <Layers :size="12" />
        <span>在此追加你的验证项：新增按钮 → 在 useNavaraView.ts 中补一个 action。</span>
      </div>
    </aside>

    <!-- 相机只读信息 -->
    <div v-if="ready" class="hud">
      <span>lng {{ cameraReadout.lng.toFixed(5) }}</span>
      <span>lat {{ cameraReadout.lat.toFixed(5) }}</span>
      <span>height {{ heightLabel }}</span>
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

.loading-overlay__icon {
  color: var(--primary);
  animation: spin 1.1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 控制面板 */
.panel {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  width: 264px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel__header h1 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.panel__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(230, 237, 243, 0.06);
  color: var(--text-dim);
  font-size: 11px;
}

.panel__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warn);
}

.panel__status[data-state="ready"] .panel__dot {
  background: var(--ok);
}

.panel__status[data-state="error"] .panel__dot {
  background: var(--error);
}

.panel__error {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(248, 81, 73, 0.12);
  color: var(--error);
  word-break: break-all;
}

.panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.panel__section h2 {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.panel__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}

.panel__btn:hover:not(:disabled) {
  background: rgba(0, 145, 255, 0.14);
  border-color: rgba(0, 145, 255, 0.5);
}

.panel__btn:active:not(:disabled) {
  transform: scale(0.98);
}

.panel__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.panel__btn--danger:hover:not(:disabled) {
  background: rgba(248, 81, 73, 0.14);
  border-color: rgba(248, 81, 73, 0.5);
}

.panel__section--hint {
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 11px;
}

.panel__section--hint svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* 相机 HUD */
.hud {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  display: flex;
  gap: 14px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  color: var(--text-dim);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
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
