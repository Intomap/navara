import type ThreeView from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";

import type { ExampleMeta } from "./sections";

/**
 * The example contract: each migrated example lives in
 * `src/examples/<category>/<name>/index.ts` and exports
 *
 * ```ts
 * export const meta: ExampleMeta = { section: "gis", title: "...", ... };
 * export async function run(ctx: ExampleContext): Promise<ExampleRunResult>;
 * ```
 *
 * The original examples were module-level top-level-await scripts that built
 * their own `ThreeView`; `run` wraps exactly that body, with the DOM control
 * helpers (`addButton` & co.) replaced by the declarative `ctx.ui` registry
 * that the Vue control panel renders.
 */

/** A view created by an example. All examples use the default descriptors. */
export type ExampleView = ThreeView<DefaultDescriptions>;

/** Returned by `run`; `dispose` cleans up anything outliving the view. */
export type ExampleRunResult = {
  view: ExampleView;
  /**
   * Called before `view.dispose()` on example switch / unmount. Remove
   * window/document listeners, cancel rAF loops, stop plugins
   * (`personView.stop()`), etc. View-bound listeners die with the view and
   * need no cleanup here.
   */
  dispose?: () => void;
};

/** Controls the Vue control panel can render. Created via `ctx.ui`. */
export type ControlSpec = ButtonControl | SwitchControl | SliderControl | CheckboxControl | HelpControl | PlayerControl;

export type ButtonControl = {
  kind: "button";
  id: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
};

export type SwitchControl = {
  kind: "switch";
  id: string;
  labels: string[];
  selected: number;
  onChange: (index: number) => void;
};

export type SliderControl = {
  kind: "slider";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onInput: (value: number) => void;
  disabled: boolean;
};

export type CheckboxControl = {
  kind: "checkbox";
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** Collapsible key/pointer-binding help card (replaces `controlsHelp`). */
export type HelpControl = {
  kind: "help";
  id: string;
  title: string;
  /** `[binding, description]` pairs, rendered as a definition list. */
  bindings: [string, string][];
  /** Collapse the card to just its header (mutable from the example). */
  collapsed: boolean;
};

/** Playback timeline (replaces `helpers/player`). */
export type PlayerControl = {
  kind: "player";
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  playing: boolean;
  onToggle: (playing: boolean) => void;
  onScrub: (value: number) => void;
};

/** Handles examples use to reflect state back into their controls. */
export type ButtonHandle = {
  setDisabled(disabled: boolean): void;
  setLabel(label: string): void;
};

export type SliderHandle = {
  setDisabled(disabled: boolean): void;
  /** Programmatic value update (does NOT fire `onInput`). */
  setValue(value: number): void;
};

export type PlayerHandle = {
  /** Programmatic playhead update (does NOT fire `onScrub`). */
  setValue(value: number): void;
  setPlaying(playing: boolean): void;
};

/**
 * Declarative replacement for the original `helpers/button.ts`. Controls are
 * appended in call order and rendered by `ExampleControlPanel.vue`; every
 * control is cleared when the example is switched.
 */
export type ExampleUi = {
  addButton(label: string, onClick?: () => void): ButtonHandle;
  addSwitch(
    labels: string[],
    selectedIndex: number,
    onChange: (index: number) => void,
  ): void;
  addSlider(
    label: string,
    options: { min: number; max: number; value: number; step?: number; unit?: string },
    onInput: (value: number) => void,
  ): SliderHandle;
  addCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): void;
  addHelpCard(title: string, bindings: [string, string][]): HelpControl;
  addPlayer(options: {
    min: number;
    max: number;
    step?: number;
    value: number;
    playing: boolean;
    onToggle: (playing: boolean) => void;
    onScrub: (value: number) => void;
  }): PlayerHandle;
};

/** Handed to every example's `run`. */
export type ExampleContext = {
  /**
   * Base URL for the example's local assets (glTF models, GeoJSON, credit
   * images) — replaces the original `import.meta.env.BASE_URL` usage.
   */
  assetsUrl: string;
  ui: ExampleUi;
};

/** A gallery entry: meta enriched with its registry path. */
export type ExampleEntry = {
  /** Registry path, e.g. "getting-started/hello-world". */
  id: string;
  meta: ExampleMeta;
  run(ctx: ExampleContext): Promise<ExampleRunResult>;
};
