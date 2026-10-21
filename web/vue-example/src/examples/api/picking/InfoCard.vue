<script setup lang="ts">
/**
 * Floating info card for the picking example, rendered by Vue. The
 * OverlayPlugin projects the picked point every frame and the example updates
 * the reactive state, so the card stays anchored to that geographic location
 * as the camera moves — presentation only, no Navara API lives here.
 */
export type InfoCardState = {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  kind: string;
  rows: { label: string; value: string }[];
};

defineProps<{ state: InfoCardState }>();
</script>

<template>
  <Teleport to="body">
    <div
      v-show="state.visible"
      class="picking-card"
      :style="{ transform: `translate(${state.x}px, ${state.y}px)` }"
    >
      <div class="picking-card__name">{{ state.name }}</div>
      <div class="picking-card__kind">{{ state.kind }}</div>
      <div
        v-for="row in state.rows"
        :key="row.label"
        class="picking-card__row"
      >
        <span>{{ row.label }}</span>
        <span>{{ row.value }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picking-card {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 15;
  min-width: 180px;
  max-width: 260px;
  padding: 12px 14px;
  color: #1b1f24;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e5e9;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
  pointer-events: none;
  will-change: transform;
}
.picking-card__name {
  margin-bottom: 2px;
  font-size: 15px;
  font-weight: 700;
}
.picking-card__kind {
  margin-bottom: 10px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ff6b2c;
}
.picking-card__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 12px;
  border-top: 1px solid #f0f2f4;
}
.picking-card__row span:first-child {
  color: #8a929b;
}
.picking-card__row span:last-child {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
