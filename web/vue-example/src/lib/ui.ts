import { reactive } from "vue";

import type {
  ButtonControl,
  ButtonHandle,
  CheckboxControl,
  ControlSpec,
  ExampleUi,
  HelpControl,
  PlayerControl,
  PlayerHandle,
  SliderControl,
  SliderHandle,
  SwitchControl,
} from "../examples/types";
import { store } from "../composables/store";

/**
 * Vue-rendered replacement for the original `helpers/button.ts`.
 *
 * Examples call the same `addButton` / `addSwitch` / `addSlider` /
 * `addCheckbox` surface, but instead of appending DOM nodes to a shared button
 * bar, each call appends a reactive {@link ControlSpec} to the gallery store;
 * `ExampleControlPanel.vue` renders them. Handles let examples reflect state
 * back (`button.disabled = x` in the originals becomes
 * `handle.setDisabled(x)`).
 *
 * Controls are cleared when the example is switched (`detachActiveExample`).
 */

let seq = 0;

function pushSpec<T extends ControlSpec>(spec: T): T {
  const proxy = reactive(spec) as T;
  store.controls.value.push(proxy);
  return proxy;
}

/** Creates a fresh control registry for one example run. */
export function createUiRegistry(): ExampleUi {
  // Sequence numbers are global so ids stay unique even across rapid
  // example switches (old controls are cleared asynchronously with the run).
  const nextId = () => `ctl-${++seq}`;

  return {
    addButton(label, onClick) {
      const spec: ButtonControl = {
        kind: "button",
        id: nextId(),
        label,
        onClick: onClick ?? (() => {}),
        disabled: false,
      };
      const proxy = pushSpec(spec);
      const handle: ButtonHandle = {
        setDisabled(disabled) {
          proxy.disabled = disabled;
        },
        setLabel(next) {
          proxy.label = next;
        },
      };
      return handle;
    },

    addSwitch(labels, selectedIndex, onChange) {
      const spec: SwitchControl = {
        kind: "switch",
        id: nextId(),
        labels,
        selected: selectedIndex,
        onChange,
      };
      pushSpec(spec);
    },

    addSlider(label, options, onInput) {
      const spec: SliderControl = {
        kind: "slider",
        id: nextId(),
        label,
        min: options.min,
        max: options.max,
        step: options.step ?? 1,
        unit: options.unit ?? "",
        value: options.value,
        onInput,
        disabled: false,
      };
      const proxy = pushSpec(spec);
      const handle: SliderHandle = {
        setDisabled(disabled) {
          proxy.disabled = disabled;
        },
        setValue(value) {
          proxy.value = value;
        },
      };
      return handle;
    },

    addCheckbox(label, checked, onChange) {
      const spec: CheckboxControl = {
        kind: "checkbox",
        id: nextId(),
        label,
        checked,
        onChange,
      };
      pushSpec(spec);
    },

    addHelpCard(title, bindings) {
      const spec: HelpControl = {
        kind: "help",
        id: nextId(),
        title,
        bindings,
        collapsed: false,
      };
      return pushSpec(spec);
    },

    addPlayer(options) {
      const spec: PlayerControl = {
        kind: "player",
        id: nextId(),
        min: options.min,
        max: options.max,
        step: options.step ?? 1,
        value: options.value,
        playing: options.playing,
        onToggle: options.onToggle,
        onScrub: options.onScrub,
      };
      const proxy = pushSpec(spec);
      const handle: PlayerHandle = {
        setValue(value) {
          proxy.value = value;
        },
        setPlaying(playing) {
          proxy.playing = playing;
        },
      };
      return handle;
    },
  };
}
