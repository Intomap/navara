import { createConcurrencyManager } from "@navaramap/worker";

/** Maximum workers on mobile: limits thermal throttling AND peak memory —
 * every busy worker's WASM heap ratchets to its decode working set, so a
 * camera-move burst costs up to `workers × maxWorkerHeapBytes`. Two workers
 * halve that peak versus four at the cost of decode throughput. */
const MOBILE_MAX_WORKERS = 2;
/** Desktop cap: decode throughput saturates well below `hardwareConcurrency`,
 * while every extra worker pins another WASM heap, so the default trades a
 * little burst throughput for a bounded memory floor. */
const DESKTOP_MAX_WORKERS = 4;

export const createDefaultConcurrencyManager = (mobileOptimized: boolean) => {
  const hardwareConcurrency = Math.max(navigator.hardwareConcurrency, 1);
  const totalConcurrency = mobileOptimized
    ? Math.min(hardwareConcurrency, MOBILE_MAX_WORKERS)
    : Math.min(hardwareConcurrency, DESKTOP_MAX_WORKERS);
  return createConcurrencyManager(totalConcurrency);
};
