<script setup lang="ts">
import { ChevronDown, CircleHelp } from "lucide-vue-next";
import { ref, watch } from "vue";
import type { HelpControl } from "../../examples/types";

const props = defineProps<{ control: HelpControl }>();

const expanded = ref(!props.control.collapsed);
watch(
  () => props.control.collapsed,
  (collapsed) => {
    expanded.value = !collapsed;
  },
);
</script>

<template>
  <div class="ctl-help">
    <button
      type="button"
      class="ctl-help__header"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <CircleHelp :size="14" />
      <span>{{ control.title }}</span>
      <ChevronDown
        :size="14"
        class="ctl-help__chevron"
        :class="{ 'is-open': expanded }"
      />
    </button>
    <dl v-show="expanded" class="ctl-help__body">
      <div v-for="[binding, description] in control.bindings" :key="binding" class="ctl-help__row">
        <dt>{{ binding }}</dt>
        <dd>{{ description }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.ctl-help {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(230, 237, 243, 0.04);
  overflow: hidden;
}
.ctl-help__header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ctl-help__header svg:first-child {
  color: var(--primary);
}
.ctl-help__header span {
  flex: 1;
  text-align: left;
}
.ctl-help__chevron {
  color: var(--text-dim);
  transition: transform 0.15s ease;
}
.ctl-help__chevron.is-open {
  transform: rotate(180deg);
}
.ctl-help__body {
  margin: 0;
  padding: 4px 12px 10px;
  border-top: 1px solid var(--border);
}
.ctl-help__row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
}
.ctl-help__row dt {
  flex-shrink: 0;
  min-width: 84px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: rgba(230, 237, 243, 0.06);
  color: var(--text);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10px;
  text-align: center;
}
.ctl-help__row dd {
  margin: 0;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
