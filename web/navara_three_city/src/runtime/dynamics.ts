import type { Group, WebGLRenderer } from "three";

import type { CityFocus } from "./CityStreamer";
import type { CityRtcFrame } from "./rtc";

export type CityDynamicFrame = {
  dt: number;
  time: number;
  focus: CityFocus;
  viewDistance: number;
  night: number;
  quality: "low" | "high";
};

export type CityDynamicSystem = {
  group?: Group;
  update(frame: CityDynamicFrame): void;
  render?(renderer: WebGLRenderer): void;
  dispose(): void;
};

export class CityDynamics {
  readonly root: Group;
  private systems: CityDynamicSystem[] = [];
  private lastTime?: number;

  constructor(rtc: CityRtcFrame) {
    this.root = rtc.createRoot("city-dynamics");
  }

  add(system: CityDynamicSystem): void {
    this.systems.push(system);
    if (system.group) this.root.add(system.group);
  }

  update(
    time: number,
    focus: CityFocus,
    viewDistance: number,
    night: number,
    quality: "low" | "high",
  ): void {
    const dt =
      this.lastTime === undefined
        ? 0
        : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    const frame = {
      dt,
      time: time / 1000,
      focus,
      viewDistance,
      night,
      quality,
    };
    for (const system of this.systems) system.update(frame);
  }

  render(renderer: WebGLRenderer): void {
    for (const system of this.systems) system.render?.(renderer);
  }

  dispose(): void {
    for (const system of this.systems) system.dispose();
    this.systems = [];
    this.root.removeFromParent();
    this.root.clear();
  }
}
