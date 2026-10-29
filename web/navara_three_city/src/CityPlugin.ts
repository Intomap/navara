import { Plugin } from "@navaramap/core";
import type ThreeView from "@navaramap/three";

import { CityMeshDesc } from "./CityMeshDesc";
import { CityBloomEffectDesc } from "./effects/CityBloomEffectDesc";
import { CityWaterMirrorEffectDesc } from "./effects/CityWaterMirrorEffectDesc";

export class CityPlugin extends Plugin {
  async init(view: ThreeView): Promise<void> {
    view.registerMesh("city", CityMeshDesc);
    view.registerEffect("cityBloom", CityBloomEffectDesc);
    view.registerEffect("cityMirror", CityWaterMirrorEffectDesc);
  }
}
