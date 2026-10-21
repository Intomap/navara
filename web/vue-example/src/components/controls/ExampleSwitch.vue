<script setup lang="ts">
import { ref, watch } from "vue";
import type { SwitchControl } from "../../examples/types";

const props = defineProps<{ control: SwitchControl }>();

const selected = ref(props.control.selected);
watch(
  () => props.control,
  (c) => {
    selected.value = c.selected;
  },
);

function pick(index: number): void {
  if (index === selected.value) return;
  selected.value = index;
  props.control.onChange(index);
}
</script>

<template>
  <div class="ctl-switch" role="group">
    <button
      v-for="(label, i) in control.labels"
      :key="label + i"
      type="button"
      :aria-pressed="i === selected"
      @click="pick(i)"
    >
      {{ label }}
    </button>
  </div>
</template>

<style scoped>
.ctl-switch {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
}
.ctl-switch button {
  flex: 1;
  padding: 7px 12px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.ctl-switch button:first-child {
  border-left: none;
}
.ctl-switch button:hover[aria-pressed="false"] {
  background: rgba(0, 145, 255, 0.1);
  color: var(--text);
}
.ctl-switch button[aria-pressed="true"] {
  background: var(--primary);
  color: #fff;
  cursor: default;
}
</style>
