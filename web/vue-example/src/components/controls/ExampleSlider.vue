<script setup lang="ts">
import type { SliderControl } from "../../examples/types";

const props = defineProps<{ control: SliderControl }>();

function onInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  props.control.value = value;
  props.control.onInput(value);
}
</script>

<template>
  <label class="ctl-slider" :class="{ 'is-disabled': control.disabled }">
    <span class="ctl-slider__label">{{ control.label }}</span>
    <input
      type="range"
      :min="control.min"
      :max="control.max"
      :step="control.step"
      :value="control.value"
      :disabled="control.disabled"
      @input="onInput"
    />
    <span class="ctl-slider__value">{{ control.value }}{{ control.unit }}</span>
  </label>
</template>

<style scoped>
.ctl-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.ctl-slider.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ctl-slider__label {
  color: var(--text-dim);
  white-space: nowrap;
}
.ctl-slider input[type="range"] {
  flex: 1;
  accent-color: var(--primary);
  cursor: pointer;
  min-width: 90px;
}
.ctl-slider__value {
  min-width: 3.5em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
