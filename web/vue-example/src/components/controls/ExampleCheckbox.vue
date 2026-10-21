<script setup lang="ts">
import type { CheckboxControl } from "../../examples/types";

const props = defineProps<{ control: CheckboxControl }>();

function onChange(event: Event): void {
  props.control.checked = (event.target as HTMLInputElement).checked;
  props.control.onChange(props.control.checked);
}
</script>

<template>
  <label class="ctl-check">
    <input
      type="checkbox"
      :checked="control.checked"
      @change="onChange"
    />
    <span>{{ control.label }}</span>
  </label>
</template>

<style scoped>
.ctl-check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.ctl-check:hover {
  background: rgba(0, 145, 255, 0.1);
  border-color: rgba(0, 145, 255, 0.4);
}
.ctl-check input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
}
</style>
