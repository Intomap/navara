import { ref, type Ref } from "vue";

import type { ControlSpec, ExampleView } from "../examples/types";

export type GalleryState = "idle" | "loading" | "ready" | "error";

export type CameraReadout = {
  lng: number;
  lat: number;
  height: number;
};

/** The currently-running example's artifacts (one at a time). */
export type ActiveExample = {
  view: ExampleView | null;
  dispose?: () => void;
};

/**
 * All mutable gallery state lives in one object that **survives HMR** (see the
 * bottom of this file). The engine is a process-level singleton: only
 * `dispose()` → `terminateWorkerPool()` frees the worker pool, so "old engine
 * still alive / new module thinks nothing is initialized" mismatches would
 * crash the host (`Worker pool has already been initialized.`). Keeping the
 * state here makes both mismatches impossible.
 */
export type GalleryStore = {
  /** Mount container, used to rebuild the view in place across switches. */
  containerEl: HTMLElement | null;
  /** Registry id of the running example, e.g. "getting-started/hello-world". */
  currentId: Ref<string | null>;
  state: Ref<GalleryState>;
  errorMessage: Ref<string>;
  cameraReadout: Ref<CameraReadout>;
  /** Declarative controls registered by the running example (`ctx.ui`). */
  controls: Ref<ControlSpec[]>;
  /**
   * Monotonic epoch. Incremented on every detach so an in-flight `run` whose
   * example has been switched away from discards its view instead of adopting
   * an engine bound to a stale example (debug WASM init takes seconds — the
   * window is wide).
   */
  initEpoch: number;
  active: ActiveExample;
  initializing: Promise<void> | null;
};

function createStore(): GalleryStore {
  return {
    containerEl: null,
    currentId: ref<string | null>(null),
    state: ref<GalleryState>("idle"),
    errorMessage: ref(""),
    cameraReadout: ref<CameraReadout>({ lng: 0, lat: 0, height: 0 }),
    controls: ref<ControlSpec[]>([]),
    initEpoch: 0,
    active: { view: null, dispose: undefined },
    initializing: null,
  };
}

/**
 * Singleton across HMR: on first load `import.meta.hot.data` is empty and
 * `createStore()` runs; afterwards `import.meta.hot.dispose` hands the same
 * object back so engine handles survive hot updates.
 */
export const store: GalleryStore =
  (import.meta.hot?.data.store as GalleryStore | undefined) ?? createStore();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.store = store;
  });
}
