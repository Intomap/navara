import type { ExampleEntry } from "../examples/types";
import { store } from "./store";
import { createUiRegistry } from "../lib/ui";

/**
 * View lifecycle for the gallery: one container, one running example at a
 * time, rebuilt from scratch on every switch.
 *
 * Engine invariants carried over from the original harness (violating these
 * throws or leaks):
 *   1. The engine is a process-level singleton — `view.dispose()` internally
 *      terminates the worker pool, so a new example may only init AFTER the
 *      previous view finished disposing (ordering inside `detachActiveExample`).
 *   2. `dispose()` only removes DOM the engine itself created. A canvas
 *      mounted into a host container survives it; `releaseContainer` must
 *      force-release its GL context (`WEBGL_lose_context`) and remove it, or
 *      switching examples ~16 times exhausts the browser's context budget.
 *   3. The example's own `dispose` hook runs BEFORE `view.dispose()` so it can
 *      stop plugins and loops that reference the still-alive view.
 */

/** Base URL for example-local assets (models, GeoJSON, credit images). */
export const ASSETS_URL: string = import.meta.env.BASE_URL;

function updateCameraReadout(): void {
  const v = store.active.view;
  if (!v) return;
  try {
    const { lng, lat, height } = v.camera.positionGeographic;
    store.cameraReadout.value = { lng, lat, height };
  } catch {
    // The camera entity is only established after the first ECS update;
    // reading earlier hits `positionGeographic`'s invariant. The next "move"
    // event (setCamera / interaction) refreshes the readout.
  }
}

/**
 * Restores the container to a clean state: force-release the GL context of
 * every canvas the engine left behind and remove it. See module docstring.
 */
function releaseContainer(container: HTMLElement | null): void {
  if (!container) return;
  for (const canvas of container.querySelectorAll("canvas")) {
    try {
      const gl =
        canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // Context already gone with the engine: ignore.
    }
    canvas.remove();
  }
}

/** Detaches the running example: dispose hook → view.dispose → GL cleanup. */
export function detachActiveExample(): void {
  // Invalidate any in-flight run first so its result gets discarded.
  store.initEpoch++;
  store.initializing = null;

  const { view, dispose } = store.active;
  store.active = { view: null, dispose: undefined };
  store.controls.value = [];
  store.currentId.value = null;

  if (dispose) {
    try {
      dispose();
    } catch (err) {
      console.error("[gallery] example dispose hook failed:", err);
    }
  }
  // Must complete (terminating the worker pool) before the next init.
  view?.dispose();
  releaseContainer(store.containerEl);

  store.state.value = "idle";
  store.errorMessage.value = "";
}

/** Runs an example in the given container, replacing whatever is active. */
export function runExample(
  example: ExampleEntry,
  container: HTMLElement,
): Promise<void> {
  detachActiveExample();
  store.containerEl = container;
  store.state.value = "loading";

  const epoch = store.initEpoch;
  const ui = createUiRegistry();

  // Declare before assignment: the finally clause compares against
  // `store.initializing`; referencing `const run` inside would be a
  // use-before-assign TS error.
  let run: Promise<void> | undefined;
  run = (async () => {
    try {
      const result = await example.run({ assetsUrl: ASSETS_URL, ui });

      // The example was switched away while its view was initializing:
      // throw the whole engine away instead of adopting it.
      if (epoch !== store.initEpoch) {
        result.view.dispose();
        releaseContainer(container);
        return;
      }

      store.active = { view: result.view, dispose: result.dispose };
      result.view.camera.on("move", updateCameraReadout);
      updateCameraReadout();
      requestAnimationFrame(updateCameraReadout);

      store.currentId.value = example.id;
      store.state.value = "ready";
    } catch (err) {
      if (epoch !== store.initEpoch) return;
      console.error(`[gallery] example "${example.id}" failed:`, err);
      store.errorMessage.value = err instanceof Error ? err.message : String(err);
      store.state.value = "error";
    } finally {
      // Only clear the promise that belongs to this run, never one from a
      // newer run started after a detach.
      if (store.initializing === run) {
        store.initializing = null;
      }
    }
  })();
  store.initializing = run;
  return run;
}

/**
 * Called by MapView on mount: registers the container and starts the default
 * example (first registry entry) if none is running.
 */
export async function mountGallery(
  container: HTMLElement,
  initial: ExampleEntry,
): Promise<void> {
  store.containerEl = container;
  if (store.currentId.value || store.active.view) return;
  await runExample(initial, container);
}

// The engine captures this module's functions in closures; hot-swapping it
// cannot make the old engine pick up new code — force a full reload instead.
if (import.meta.hot) import.meta.hot.invalidate();
