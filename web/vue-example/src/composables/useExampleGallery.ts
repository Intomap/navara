import { computed, ref } from "vue";

import {
  DEFAULT_LANG,
  SECTION_KEYS,
  localize,
  type Lang,
  type SectionKey,
} from "../examples/sections";
import type { ExampleMeta } from "../examples/sections";
import type { ExampleEntry } from "../examples/types";
import { store } from "./store";
import { detachActiveExample, runExample } from "./scene";

/**
 * Gallery orchestration: auto-discovers every example module, exposes the
 * searchable/grouped listing, and drives example switching.
 *
 * Examples register via eager `import.meta.glob` like the original React
 * gallery. Migrated example modules have no top-level side effects (all code
 * lives in `run`), so eager import is safe.
 */

const modules = import.meta.glob<{
  meta: ExampleMeta;
  run: ExampleEntry["run"];
}>("../examples/**/index.ts", { eager: true });

const registry: ExampleEntry[] = Object.entries(modules)
  .map(([path, mod]) => ({
    // "../examples/getting-started/hello-world/index.ts"
    //   -> "getting-started/hello-world"
    id: path
      .replace(/^\.\.\/examples\//, "")
      .replace(/\/index\.ts$/, ""),
    meta: mod.meta,
    run: mod.run,
  }))
  .sort(
    (a, b) =>
      a.id.localeCompare(b.id),
  );

/** All discovered examples, in stable registry order. */
export const EXAMPLES: readonly ExampleEntry[] = registry;

/** Default example loaded on startup (first Getting Started entry). */
export const DEFAULT_EXAMPLE: ExampleEntry =
  registry.find((e) => e.meta.section === "getting-started") ?? registry[0];

const bySectionOrder = (a: ExampleEntry, b: ExampleEntry) =>
  (a.meta.order ?? Number.MAX_SAFE_INTEGER) -
    (b.meta.order ?? Number.MAX_SAFE_INTEGER) ||
  localize(a.meta.title, DEFAULT_LANG).localeCompare(
    localize(b.meta.title, DEFAULT_LANG),
  );

export function useExampleGallery() {
  const query = ref("");

  const current = computed(
    () => registry.find((e) => e.id === store.currentId.value) ?? null,
  );

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return registry;
    return registry.filter(
      (e) =>
        localize(e.meta.title, DEFAULT_LANG).toLowerCase().includes(q) ||
        localize(e.meta.description, DEFAULT_LANG).toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  });

  const featured = computed(() =>
    filtered.value.filter((e) => e.meta.signature).sort(bySectionOrder),
  );

  /** Sections (in gallery order) → sub-groups → sorted entries. */
  const sections = computed(() => {
    return SECTION_KEYS.map((key: SectionKey) => {
      const inSection = filtered.value
        .filter((e) => e.meta.section === key)
        .sort(bySectionOrder);
      const groups: { label: string; entries: ExampleEntry[] }[] = [];
      for (const entry of inSection) {
        const label = localize(entry.meta.group, DEFAULT_LANG);
        const existing = groups.find((g) => g.label === label);
        if (existing) existing.entries.push(entry);
        else groups.push({ label, entries: [entry] });
      }
      return { key, groups, count: inSection.length };
    }).filter((s) => s.count > 0);
  });

  function select(example: ExampleEntry): void {
    if (example.id === store.currentId.value && store.state.value !== "error") {
      return;
    }
    void runExample(example, store.containerEl ?? document.body);
  }

  return {
    query,
    current,
    sections,
    featured,
    state: store.state,
    errorMessage: store.errorMessage,
    cameraReadout: store.cameraReadout,
    controls: store.controls,
    select,
    detach: detachActiveExample,
  };
}
