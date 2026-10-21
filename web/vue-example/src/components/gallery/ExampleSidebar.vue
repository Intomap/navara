<script setup lang="ts">
import { ChevronLeft, ChevronRight, Search, Star } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useExampleGallery } from "../../composables/useExampleGallery";
import { SECTION_LABELS, localize } from "../../examples/sections";
import type { ExampleEntry } from "../../examples/types";

const { query, sections, featured, current, select } = useExampleGallery();

const collapsed = ref(false);

const resultCount = computed(
  () =>
    featured.value.length +
    sections.value.reduce((sum, s) => sum + s.count, 0),
);

function onPick(entry: ExampleEntry): void {
  select(entry);
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar__inner">
      <header class="sidebar__header">
        <h1>Navara 示例画廊</h1>
        <button
          type="button"
          class="sidebar__collapse"
          :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
          @click="collapsed = !collapsed"
        >
          <ChevronLeft v-if="!collapsed" :size="15" />
          <ChevronRight v-else :size="15" />
        </button>
      </header>

      <div class="sidebar__search">
        <Search class="sidebar__search-icon" :size="14" />
        <input
          v-model="query"
          type="search"
          placeholder="搜索示例…"
          spellcheck="false"
        />
      </div>

      <nav class="sidebar__scroll">
        <template v-if="resultCount === 0">
          <p class="sidebar__empty">没有匹配 “{{ query }}” 的示例。</p>
        </template>

        <template v-else>
          <section v-if="featured.length > 0" class="sidebar__section">
            <h2><Star :size="12" class="sidebar__star" /> 精选</h2>
            <ul>
              <li v-for="entry in featured" :key="entry.id">
                <button
                  type="button"
                  class="sidebar__item"
                  :class="{ 'is-active': current?.id === entry.id }"
                  @click="onPick(entry)"
                >
                  <span class="sidebar__item-title">
                    {{ localize(entry.meta.title, "en") }}
                  </span>
                  <span class="sidebar__item-desc">
                    {{ localize(entry.meta.description, "en") }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section
            v-for="section in sections"
            :key="section.key"
            class="sidebar__section"
          >
            <h2>{{ SECTION_LABELS[section.key].en }}</h2>
            <div v-for="group in section.groups" :key="group.label || section.key">
              <h3 v-if="group.label">{{ group.label }}</h3>
              <ul>
                <li v-for="entry in group.entries" :key="entry.id">
                  <button
                    type="button"
                    class="sidebar__item"
                    :class="{ 'is-active': current?.id === entry.id }"
                    @click="onPick(entry)"
                  >
                    <span class="sidebar__item-title">
                      {{ localize(entry.meta.title, "en") }}
                    </span>
                    <span class="sidebar__item-desc">
                      {{ localize(entry.meta.description, "en") }}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </section>
        </template>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: absolute;
  top: 16px;
  left: 16px;
  bottom: 16px;
  z-index: 10;
  width: 292px;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.sidebar--collapsed {
  transform: translateX(-308px);
  opacity: 0;
  pointer-events: none;
}
.sidebar__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 10px;
}
.sidebar__header h1 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.sidebar__collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: rgba(230, 237, 243, 0.04);
  color: var(--text-dim);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.sidebar__collapse:hover {
  background: rgba(0, 145, 255, 0.14);
  color: var(--text);
}
.sidebar__search {
  position: relative;
  margin-bottom: 10px;
}
.sidebar__search-icon {
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  color: var(--text-dim);
  pointer-events: none;
}
.sidebar__search input {
  width: 100%;
  padding: 7px 10px 7px 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(13, 17, 23, 0.5);
  color: var(--text);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}
.sidebar__search input::placeholder {
  color: var(--text-dim);
}
.sidebar__search input:focus {
  border-color: rgba(0, 145, 255, 0.55);
}
.sidebar__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2px 4px 4px;
}
.sidebar__scroll::-webkit-scrollbar {
  width: 6px;
}
.sidebar__scroll::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(230, 237, 243, 0.14);
}
.sidebar__empty {
  margin: 8px 4px;
  color: var(--text-dim);
  font-size: 12px;
}
.sidebar__section {
  margin-bottom: 14px;
}
.sidebar__section h2 {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 6px;
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.sidebar__star {
  color: var(--warn);
}
.sidebar__section h3 {
  margin: 8px 0 4px;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.sidebar__section ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sidebar__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.sidebar__item:hover {
  background: rgba(0, 145, 255, 0.1);
  border-color: rgba(0, 145, 255, 0.35);
}
.sidebar__item.is-active {
  background: rgba(0, 145, 255, 0.16);
  border-color: rgba(0, 145, 255, 0.6);
}
.sidebar__item-title {
  font-size: 12px;
  font-weight: 500;
}
.sidebar__item-desc {
  color: var(--text-dim);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
