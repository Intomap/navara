<script setup lang="ts">
import { Pause, Play } from "lucide-vue-next";
import type { PlayerControl } from "../../examples/types";

const props = defineProps<{ control: PlayerControl }>();

function toggle(): void {
  props.control.playing = !props.control.playing;
  props.control.onToggle(props.control.playing);
}

function onScrub(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  props.control.value = value;
  props.control.onScrub(value);
}
</script>

<template>
  <div class="ctl-player">
    <button
      type="button"
      class="ctl-player__toggle"
      :aria-label="control.playing ? '暂停' : '播放'"
      @click="toggle"
    >
      <Pause v-if="control.playing" :size="14" />
      <Play v-else :size="14" />
    </button>
    <input
      type="range"
      :min="control.min"
      :max="control.max"
      :step="control.step"
      :value="control.value"
      @input="onScrub"
    />
    <span class="ctl-player__value">{{ control.value }}</span>
  </div>
</template>

<style scoped>
.ctl-player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
}
.ctl-player__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: rgba(0, 145, 255, 0.14);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease;
}
.ctl-player__toggle:hover {
  background: rgba(0, 145, 255, 0.28);
}
.ctl-player input[type="range"] {
  flex: 1;
  accent-color: var(--primary);
  cursor: pointer;
  min-width: 100px;
}
.ctl-player__value {
  min-width: 3.5em;
  text-align: right;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}
</style>
