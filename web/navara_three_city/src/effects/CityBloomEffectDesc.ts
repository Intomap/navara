import type ThreeView from "@navaramap/three";
import {
  Effect,
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navaramap/three";
import { BloomEffect } from "postprocessing";

export type CityBloomOptions = {
  intensity: number;
  threshold: number;
  smoothing: number;
  enabled?: boolean;
};

export type CityBloomDescription = {
  cityBloom?: Partial<CityBloomOptions>;
};

export type CityBloomConfig = EffectConfig & CityBloomDescription;
export type CityBloomUpdate = EffectUpdate & CityBloomDescription;

const DEFAULTS: CityBloomOptions = {
  intensity: 0.25,
  threshold: 0.9,
  smoothing: 0.2,
};

export class CityBloomEffectDesc extends EffectDesc<
  CityBloomConfig,
  CityBloomUpdate,
  Effect<BloomEffect, CityBloomOptions>
> {
  static override key = "cityBloom";
  static override insertBefore = ["toneMapping", "smaa", "fxaa", "final"];
  private options: CityBloomOptions;
  private bloom?: BloomEffect;

  constructor(view: ThreeView, ctx: ViewContext, config: CityBloomConfig = {}) {
    const options = { ...DEFAULTS, ...config.cityBloom };
    super(view, ctx, { ...config, cityBloom: options });
    this.options = options;
  }

  override createPass(): Effect<BloomEffect, CityBloomOptions> {
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: this.options.intensity,
      luminanceThreshold: this.options.threshold,
      luminanceSmoothing: this.options.smoothing,
    });
    return new Effect(this.view.camera.raw, this.bloom, this.options);
  }

  override update(_time: number): void {}

  override onUpdateConfig(updates: CityBloomUpdate): void {
    super.onUpdateConfig(updates);
    if (!updates.cityBloom) return;
    Object.assign(this.options, updates.cityBloom);
    if (this.bloom) {
      this.bloom.intensity = this.options.intensity;
      this.bloom.luminanceMaterial.threshold = this.options.threshold;
      this.bloom.luminanceMaterial.smoothing = this.options.smoothing;
    }
    if (updates.cityBloom.enabled !== undefined && this._instance) {
      this._instance.enabled = updates.cityBloom.enabled;
    }
  }
}
