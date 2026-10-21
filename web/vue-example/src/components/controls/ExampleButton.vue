<script setup lang="ts">
import type { ButtonControl } from "../../examples/types";

defineProps<{ control: ButtonControl }>();
</script>

<template>
  <button
    type="button"
    class="ctl-btn"
    :disabled="control.disabled"
    @click="control.onClick"
  >
    {{ control.label }}
  </button>
</template>

<style scoped>
.ctl-btn {
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}
.ctl-btn:hover:not(:disabled) {
  background: rgba(0, 145, 255, 0.14);
  border-color: rgba(0, 145, 255, 0.5);
}
.ctl-btn:active:not(:disabled) {
  transform: scale(0.98);
}
.ctl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
