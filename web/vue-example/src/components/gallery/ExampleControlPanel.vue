<script setup lang="ts">
import { computed } from "vue";
import ExampleButton from "../controls/ExampleButton.vue";
import ExampleCheckbox from "../controls/ExampleCheckbox.vue";
import ExampleHelpCard from "../controls/ExampleHelpCard.vue";
import ExamplePlayer from "../controls/ExamplePlayer.vue";
import ExampleSlider from "../controls/ExampleSlider.vue";
import ExampleSwitch from "../controls/ExampleSwitch.vue";
import { useExampleGallery } from "../../composables/useExampleGallery";
import { localize } from "../../examples/sections";

const { controls, current, state } = useExampleGallery();

const ready = computed(() => state.value === "ready");

const title = computed(() =>
  current.value ? localize(current.value.meta.title, "en") : "",
);
const description = computed(() =>
  current.value ? localize(current.value.meta.description, "en") : "",
);
</script>

<template>
  <Transition name="panel">
    <aside v-if="ready && controls.length > 0" class="panel">
      <header class="panel__header">
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </header>
      <div class="panel__controls">
        <template v-for="control in controls" :key="control.id">
          <ExampleButton v-if="control.kind === 'button'" :control="control" />
          <ExampleSwitch v-else-if="control.kind === 'switch'" :control="control" />
          <ExampleSlider v-else-if="control.kind === 'slider'" :control="control" />
          <ExampleCheckbox v-else-if="control.kind === 'checkbox'" :control="control" />
          <ExampleHelpCard v-else-if="control.kind === 'help'" :control="control" />
          <ExamplePlayer v-else-if="control.kind === 'player'" :control="control" />
        </template>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 272px;
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.panel__header {
  padding: 0 2px 10px;
  border-bottom: 1px solid var(--border);
}
.panel__header h1 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.panel__header p {
  margin: 3px 0 0;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.45;
}
.panel__controls {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10px;
  overflow-y: auto;
}
.panel__controls::-webkit-scrollbar {
  width: 6px;
}
.panel__controls::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(230, 237, 243, 0.14);
}

.panel-enter-active,
.panel-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
