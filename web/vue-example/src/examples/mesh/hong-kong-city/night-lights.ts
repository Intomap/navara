import type { CityNightLightOptions } from "@navaramap/three-city";
import type { Pane } from "tweakpane";

import {
  createNightLightControlState,
  type CityControlActions,
  type CityControlState,
  type NightLightControlState,
} from "./control-state";

const FIELDS: {
  key: keyof NightLightControlState;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "streetLights", label: "street lights", min: 0, max: 3, step: 0.05 },
  { key: "parkLights", label: "park lights", min: 0, max: 3, step: 0.05 },
  { key: "headlights", label: "car headlights", min: 0, max: 20, step: 0.5 },
  { key: "windowLight", label: "window light", min: 0, max: 4, step: 0.05 },
  {
    key: "windowSoftness",
    label: "window light softness",
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "windowSpareRate",
    label: "rooms that change",
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "windowSparePace",
    label: "pace of the change",
    min: 0,
    max: 60,
    step: 0.5,
  },
  {
    key: "nightCityGlass",
    label: "city lights in tower glass",
    min: 0,
    max: 3,
    step: 0.05,
  },
  { key: "blueLights", label: "blue lights", min: 0, max: 1, step: 0.05 },
];

export function addNightLightControls(
  pane: Pane,
  state: CityControlState,
  actions: CityControlActions,
): void {
  const options = (): CityNightLightOptions => ({
    streetLights: state.streetLights,
    parkLights: state.parkLights,
    headlights: state.headlights,
    windowLight: state.windowLight,
    windowSoftness: state.windowSoftness,
    windowSpareRate: state.windowSpareRate,
    windowSparePace: state.windowSparePace,
    nightCityGlass: state.nightCityGlass,
    blueLights: state.blueLights,
  });
  const update = () => actions.setCity({ nightLights: options() });
  const folder = pane.addFolder({ title: "Night lights", expanded: false });
  for (const { key, label, min, max, step } of FIELDS) {
    folder
      .addBinding(state, key, { label, min, max, step })
      .on("change", update);
  }
  folder.addButton({ title: "Back to defaults" }).on("click", () => {
    Object.assign(state, createNightLightControlState());
    update();
    pane.refresh();
  });
}
