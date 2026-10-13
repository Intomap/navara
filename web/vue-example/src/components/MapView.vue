<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { disposeNavaraView, mountNavaraView } from "../composables/useNavaraView";

const container = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (container.value) await mountNavaraView(container.value);
});

onBeforeUnmount(() => {
  disposeNavaraView();
});
</script>

<template>
  <div class="map-view">
    <div ref="container" class="map-view__canvas"></div>
  </div>
</template>

<style scoped>
.map-view {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.map-view__canvas {
  width: 100%;
  height: 100%;
}

.map-view__canvas :deep(canvas) {
  display: block;
}
</style>
