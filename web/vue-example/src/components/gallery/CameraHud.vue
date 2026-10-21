<script setup lang="ts">
import { computed } from "vue";
import { useExampleGallery } from "../../composables/useExampleGallery";

const { cameraReadout, state } = useExampleGallery();

const ready = computed(() => state.value === "ready");

const heightLabel = computed(() => {
  const h = cameraReadout.value.height;
  return h >= 1000 ? `${(h / 1000).toFixed(1)} km` : `${Math.round(h)} m`;
});
</script>

<template>
  <div v-if="ready" class="hud">
    <span>lng {{ cameraReadout.lng.toFixed(5) }}</span>
    <span>lat {{ cameraReadout.lat.toFixed(5) }}</span>
    <span>height {{ heightLabel }}</span>
  </div>
</template>

<style scoped>
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
</style>
