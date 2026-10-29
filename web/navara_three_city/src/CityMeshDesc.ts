import ThreeView, {
  MeshDesc,
  setupMaterialForMRT,
  type ViewContext,
} from "@navaramap/three";
import {
  queueTask,
  type CityGridData,
  type CityTileData,
} from "@navaramap/worker";
import {
  Box3,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Sphere,
  Texture,
  TextureLoader,
  Vector3,
  type WebGLRenderer,
} from "three";

import { createCityMaterials, type CityMaterials } from "./materials";
import { createFacadeMaterial } from "./materials/facade";
import { DEFAULT_CITY_NIGHT_LIGHTS } from "./materials/programs";
import { createCityBackdrop, type CityBackdrop } from "./runtime/backdrop";
import { CityBirds } from "./runtime/birds";
import { CityStreamer } from "./runtime/CityStreamer";
import { CityDynamics } from "./runtime/dynamics";
import { buildFlyovers } from "./runtime/flyovers";
import {
  createTileVisual,
  createStructureGeometry,
  type CityMirrorTile,
  type CityTileVisual,
} from "./runtime/geometry";
import { CityLampLight } from "./runtime/lamplight";
import { ecefToLocal, localBasisEcef, localToEcef } from "./runtime/projection";
import { PropLibrary } from "./runtime/props";
import { CityRailways } from "./runtime/rails";
import { CityRtcFrame } from "./runtime/rtc";
import { updateSignJobs } from "./runtime/signs";
import { buildStructures } from "./runtime/structures";
import {
  loadCityTextures,
  loadOrthophoto,
  type CityTextures,
  type Orthophoto,
} from "./runtime/textures";
import { CityTraffic } from "./runtime/traffic";
import type {
  CityConfig,
  CityManifest,
  CityOptions,
  CityRailLine,
  CityRenderStats,
  CityRoads,
  CityStructures,
  CityManifestTile,
  CityStats,
  CityTileKey,
  CityUpdate,
} from "./types";

type CityTilePhotoAtlas = {
  key: string;
  file: string;
  dist: number;
  apply: (texture: Texture) => void;
  dispose: () => void;
  small?: Texture;
  full?: Texture;
  loading?: boolean;
};

export class CityMeshDesc extends MeshDesc<CityConfig, CityUpdate, Group> {
  private options: CityOptions;
  private streamer?: CityStreamer;
  private materials?: CityMaterials;
  private textures?: CityTextures;
  private props?: PropLibrary;
  private orthophoto?: Orthophoto;
  private dynamics?: CityDynamics;
  private dynamicsLoad: Promise<void> = Promise.resolve();
  private traffic?: CityTraffic;
  private railways?: CityRailways;
  private lampLight?: CityLampLight;
  private structuresMesh?: Mesh;
  private flyoversMesh?: Mesh;
  private birds?: CityBirds;
  private backdrop?: CityBackdrop;
  private rtc = new CityRtcFrame();
  private tiles = new Map<string, CityTileVisual>();
  private photoAtlases = new Map<string, CityTilePhotoAtlas[]>();
  private mirrorTiles = new Map<string, CityMirrorTile>();
  private focus = { x: 0, z: 0 };
  private viewDistance = 0;
  private tileSize = 256;
  private baseUrl = "";
  private manifestTiles: CityManifestTile[] = [];
  private lastUpdate = -Infinity;
  private mirrorPass = { calls: 0, triangles: 0 };
  private lampPass = { calls: 0, triangles: 0 };

  constructor(view: ThreeView, ctx: ViewContext, config: CityConfig) {
    super(view, ctx, config);
    if (!config.city?.url) throw new Error("city.url is required");
    this.options = config.city;
  }

  createMesh(): Group {
    const group = new Group();
    group.name = "navara-city";
    return group;
  }

  protected override getPassKey() {
    // City glass, car windows and water take part in Navara's existing
    // screen-space reflections whenever the normal G-buffer is allocated.
    return Object.values(this.view.buffers).some(Boolean) ? "mrt" : "opaque";
  }

  async onCreate(): Promise<void> {
    super.onCreate();
    const baseUrl = this.options.url.replace(/\/$/, "");
    this.baseUrl = baseUrl;
    this.report({
      loaded: 0,
      pending: 0,
      total: 0,
      bytes: 0,
      state: "loading",
    });
    const [manifest, terrain] = await Promise.all([
      this.fetchManifest(`${baseUrl}/manifest.json`),
      fetch(`${baseUrl}/terrain.bin`).then(async (response) => {
        if (!response.ok)
          throw new Error(`City terrain failed (${response.status})`);
        return new Uint8Array(await response.arrayBuffer());
      }),
    ]);
    if (this.destroyed) return;
    this.tileSize = manifest.tileSize;
    this.manifestTiles = manifest.tiles;
    this.textures = await loadCityTextures(baseUrl);
    if (this.destroyed) {
      this.textures.dispose();
      this.textures = undefined;
      return;
    }
    this.materials = createCityMaterials(this.textures, {
      shells: manifest.shells === true,
    });
    this.lampLight = new CityLampLight(this.rtc, this.materials.uniforms);
    this.props = new PropLibrary(this.materials.uniforms, this.lampLight);
    if (this._instance) this.props.attach(this._instance);
    // Custom ShaderMaterials bypass ShaderLib, so the G-buffer outputs the
    // deferred pass requires must be opted in or the draw is rejected.
    this.props.applyMrtSetup((material) => setupMaterialForMRT(material));
    for (const value of Object.values(this.materials)) {
      if (value instanceof Material) this.ctx.applyShadowMaterial(value);
    }
    this.props.applyShadowMaterials((material) =>
      this.ctx.applyShadowMaterial(material),
    );
    this.materials.setNight(this.options.night ?? 0);
    this.materials.setSeason(this.options.season ?? 0);
    this.materials.setNightLights(this.options.nightLights);
    this.materials.setWater(this.options.water);
    this.streamer = new CityStreamer(
      manifest,
      terrain,
      baseUrl,
      {
        onLoad: (tile, data) => this.addTile(tile, data),
        onUnload: (key) => this.removeTile(key),
        onStats: (stats) => this.report(stats),
      },
      this.options.radius,
      this.options.concurrency,
    );
    this.backdrop = createCityBackdrop(
      this.rtc,
      this.materials,
      this.textures.ground,
      manifest.sea === true || String(manifest.sea) === "True",
    );
    if (this.backdrop) {
      this.backdrop.group.traverse((object) => {
        if (object instanceof Mesh && object.material instanceof Material)
          this.ctx.applyShadowMaterial(object.material);
      });
      this._instance?.add(this.backdrop.group);
      this.mirrorTiles.set("__sea__", {
        group: this.backdrop.group,
        water: this.backdrop.water,
      });
    }
    this.dynamics = new CityDynamics(this.rtc);
    this.dynamics.add(this.lampLight);
    this._instance?.add(this.dynamics.root);
    this.dynamicsLoad = this.loadDynamics(baseUrl, manifest, terrain).catch(
      (error: unknown) => {
        console.warn(
          "City dynamics are unavailable; static city remains active",
          error,
        );
      },
    );
    this.update(0);
    if (this.options.ortho !== false) void this.loadOrtho(baseUrl, manifest);
  }

  private async loadDynamics(
    baseUrl: string,
    manifest: CityManifest,
    terrain: Uint8Array,
  ): Promise<void> {
    const loadJson = async <T>(
      file: string | undefined,
    ): Promise<T | undefined> => {
      if (!file) return undefined;
      try {
        const response = await fetch(`${baseUrl}/${file}`);
        if (!response.ok) throw new Error(`${file}: ${response.status}`);
        return (await response.json()) as T;
      } catch (error) {
        console.warn(`Optional city resource ${file} was not loaded`, error);
        return undefined;
      }
    };
    const [roads, rails, structures] = await Promise.all([
      loadJson<CityRoads>(manifest.roads),
      loadJson<CityRailLine[]>(manifest.rails),
      loadJson<CityStructures>(manifest.structures),
    ]);
    const birdCount = this.options.birds ?? 150;
    if (this.destroyed || (!roads && !rails && !structures && birdCount <= 0))
      return;
    const dynamics = this.dynamics;
    const streamer = this.streamer;
    const materials = this.materials;
    if (!dynamics || !streamer || !materials || !this._instance) return;
    const ctx = this.ctx;
    const lampLight = this.lampLight;
    if (!lampLight) return;
    const applyShadow = (material: Material) =>
      ctx.applyShadowMaterial(material);
    const applyMeshShadow = (mesh: Mesh) => {
      if (mesh.material instanceof Material) applyShadow(mesh.material);
    };
    const grid: CityGridData = {
      x0: manifest.terrain.x0,
      z0: manifest.terrain.z0,
      step: manifest.terrain.step,
      width: manifest.terrain.w,
      height: manifest.terrain.h,
    };
    if (
      structures &&
      (structures.footbridges?.length || 0) +
        (structures.platforms?.length || 0) +
        (structures.canopies?.length || 0) >
        0
    ) {
      this.structuresMesh = await this.buildStructureMesh(
        "structures",
        structures,
        terrain,
        grid,
        () =>
          buildStructures(
            structures,
            (x, z) => streamer.ground(x, z),
            this.rtc,
          ),
      );
      if (this.destroyed || !this._instance) return;
      applyMeshShadow(this.structuresMesh);
      this._instance.add(this.structuresMesh);
    }
    if (roads) {
      this.flyoversMesh = await this.buildStructureMesh(
        "flyovers",
        roads,
        terrain,
        grid,
        () => buildFlyovers(roads, (x, z) => streamer.ground(x, z), this.rtc),
      );
      if (this.destroyed || !this._instance) return;
      applyMeshShadow(this.flyoversMesh);
      this._instance.add(this.flyoversMesh);
      this.traffic = new CityTraffic(
        roads,
        (x, z) => streamer.surface(x, z),
        this.rtc,
        materials.uniforms,
        lampLight,
        applyShadow,
        this.options.cars,
      );
      this.traffic.setEnabled(this.options.traffic !== false);
      this.traffic.setHeadlights(this.options.nightLights?.headlights);
      dynamics.add(this.traffic);
    }
    if (rails) {
      this.railways = new CityRailways(
        rails,
        (x, z) => streamer.ground(x, z),
        (x, z) => streamer.cover(x, z),
        manifest.gauge ?? 1.435,
        this.rtc,
        lampLight,
        applyShadow,
      );
      this.railways.setEnabled(this.options.trains !== false);
      dynamics.add(this.railways);
    }
    if (birdCount > 0) {
      this.birds = new CityBirds(
        materials.uniforms,
        (x, z) => streamer.ground(x, z),
        () => [...this.tiles.values()].map((tile) => tile.roosts),
        birdCount,
      );
      setupMaterialForMRT(this.birds.material);
      dynamics.add(this.birds);
    }
    this.updateDynamicCounts();
    this.requestUpdate();
  }

  /**
   * Builds a dynamic structure mesh (structures or flyovers) in the worker,
   * falling back to the main-thread triangulation if the worker path fails.
   * Both paths produce the same city-level RTC positions and flat-shaded
   * vertex colors, so the picture is unchanged.
   */
  private async buildStructureMesh(
    kind: "structures" | "flyovers",
    data: CityStructures | CityRoads,
    terrain: Uint8Array,
    grid: CityGridData,
    fallback: () => Mesh,
  ): Promise<Mesh> {
    const task =
      kind === "structures"
        ? "constructStructuresMesh"
        : "constructFlyoversMesh";
    try {
      const { result } = await queueTask(task, [
        JSON.stringify(data),
        terrain,
        grid,
      ]);
      const material = new MeshStandardMaterial({
        vertexColors: true,
        roughness: kind === "flyovers" ? 0.85 : 0.8,
        metalness: kind === "flyovers" ? 0.02 : 0.05,
        side: DoubleSide,
      });
      const mesh = new Mesh(createStructureGeometry(result), material);
      mesh.name = kind;
      return mesh;
    } catch (error) {
      console.warn(
        `City ${kind} worker build failed; using main-thread fallback`,
        error,
      );
      return fallback();
    }
  }

  private updateDynamicCounts(): void {
    const scale = this.options.quality === "low" ? 0.5 : 1;
    this.traffic?.setCount(Math.round((this.options.cars ?? 260) * scale));
    this.birds?.setCount(Math.round((this.options.birds ?? 150) * scale));
  }

  private async loadOrtho(
    baseUrl: string,
    manifest: CityManifest,
  ): Promise<void> {
    const photo = await loadOrthophoto(baseUrl, manifest);
    if (!photo) return;
    if (this.destroyed || !this.materials) {
      photo.texture.dispose();
      return;
    }
    this.orthophoto = photo;
    this.materials.setOrtho(true, photo.texture, photo.rect);
    this.requestUpdate();
  }

  private async fetchManifest(url: string): Promise<CityManifest> {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`City manifest failed (${response.status})`);
    const manifest = (await response.json()) as CityManifest;
    if (manifest.format !== 7)
      throw new Error(`Unsupported city format ${manifest.format}`);
    return manifest;
  }

  private addTile(tile: CityTileKey, data: CityTileData): void {
    if (
      !this._instance ||
      !this.materials ||
      !this.props ||
      this.tiles.has(tile.key)
    )
      return;
    const visual = createTileVisual(data, this.materials, this.props);
    visual.group.name = `city-tile-${tile.key}`;
    this.attachTilePhotos(tile, visual);
    this.tiles.set(tile.key, visual);
    let mirrorWater: CityMirrorTile["water"];
    if (visual.water) {
      const local = visual.water.sphere.center;
      const projected = localToEcef(local.x, local.y, local.z);
      const basis = localBasisEcef(projected.geographic);
      mirrorWater = {
        sphere: new Sphere(
          new Vector3().fromArray(projected.ecef),
          visual.water.sphere.radius,
        ),
        up: new Vector3().fromArray(basis.up),
      };
    }
    this.mirrorTiles.set(tile.key, {
      group: visual.group,
      sphere: new Box3()
        .setFromObject(visual.group)
        .getBoundingSphere(new Sphere()),
      water: mirrorWater,
    });
    this._instance.add(visual.group);
    this.requestUpdate();
  }

  private removeTile(key: string): void {
    const visual = this.tiles.get(key);
    if (!visual) return;
    this.tiles.delete(key);
    this.mirrorTiles.delete(key);
    this.disposeTilePhotos(key);
    visual.dispose();
    this.requestUpdate();
  }

  private attachTilePhotos(tile: CityTileKey, visual: CityTileVisual): void {
    const materials = this.materials;
    const textures = this.textures;
    if (!materials || !textures) return;
    const manifestTile = this.manifestTiles.find(
      (candidate) => candidate.x === tile.tx && candidate.z === tile.tz,
    );
    if (!manifestTile) return;
    const states: CityTilePhotoAtlas[] = [];
    const buildings = visual.group.getObjectByName("buildings");
    if (manifestTile.walls && buildings instanceof Mesh) {
      const facade = createFacadeMaterial(materials.uniforms, textures.wall);
      const userData = facade.userData as {
        photo?: { value: Texture };
        photoOn?: { value: number };
      };
      this.ctx.applyShadowMaterial(facade);
      buildings.material = facade;
      states.push({
        key: tile.key,
        file: manifestTile.walls,
        dist: 900,
        apply: (texture) => {
          if (userData.photo) userData.photo.value = texture;
          if (userData.photoOn) userData.photoOn.value = 1;
        },
        dispose: () => facade.dispose(),
      });
    }
    const photoMesh = visual.group.getObjectByName("photo");
    if (manifestTile.atlas && photoMesh instanceof Mesh) {
      const material = new MeshStandardMaterial({
        color: 0x777776,
        roughness: 0.9,
        metalness: 0,
      });
      this.ctx.applyShadowMaterial(material);
      photoMesh.material = material;
      states.push({
        key: tile.key,
        file: manifestTile.atlas,
        dist: 600,
        apply: (texture) => {
          const first = material.map === null;
          material.map = texture;
          material.color.set(0xffffff);
          if (first) material.needsUpdate = true;
        },
        dispose: () => material.dispose(),
      });
    }
    if (states.length === 0) return;
    this.photoAtlases.set(tile.key, states);
    states.forEach((state) => void this.loadPhotoAtlas(state, true));
  }

  private loadPhotoAtlas(state: CityTilePhotoAtlas, small: boolean): void {
    const file = small ? state.file.replace(/\.jpg$/, "_s.jpg") : state.file;
    new TextureLoader().load(
      `${this.baseUrl}/${file}`,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        if (!this.photoAtlases.get(state.key)?.includes(state)) {
          texture.dispose();
          return;
        }
        if (small) {
          state.small = texture;
          if (!state.full) state.apply(texture);
        } else {
          state.loading = false;
          state.full = texture;
          state.apply(texture);
        }
      },
      undefined,
      (error) => {
        if (!small) state.loading = false;
        console.warn(`City photo atlas ${file} was not loaded`, error);
      },
    );
  }

  private updateTilePhotos(key: string, distance: number): void {
    for (const state of this.photoAtlases.get(key) ?? []) {
      if (distance < state.dist * 1.3 && !state.full && !state.loading) {
        state.loading = true;
        this.loadPhotoAtlas(state, false);
      } else if (distance > state.dist * 1.3 && state.full) {
        state.full.dispose();
        state.full = undefined;
        if (state.small) state.apply(state.small);
      }
    }
  }

  private disposeTilePhotos(key: string): void {
    const states = this.photoAtlases.get(key);
    if (!states) return;
    this.photoAtlases.delete(key);
    states.forEach((state) => {
      state.small?.dispose();
      state.full?.dispose();
      state.dispose();
    });
  }

  update(time: number): void {
    this.props?.update();
    this.materials?.setTime(time * 0.001);
    if (this.materials) {
      const pace =
        this.options.nightLights?.windowSparePace ??
        DEFAULT_CITY_NIGHT_LIGHTS.windowSparePace;
      this.materials.uniforms.uWindowLife.value.y =
        (time * 0.001 * Math.min(Math.max(pace, 0), 60)) % 100000;
    }
    this.materials?.uniforms.uCitySunDirection.value.copy(
      this.view.atmosphere.sunDirection,
    );
    updateSignJobs(this.options.night ?? 0);
    this.dynamics?.update(
      time,
      this.focus,
      this.viewDistance,
      this.options.night ?? 0,
      this.options.quality ?? "high",
    );
    if (!this.streamer || time - this.lastUpdate < 250) return;
    this.lastUpdate = time;
    const rect = this.view.canvas.getBoundingClientRect();
    const target = this.view.pickDepthPosition(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    if (target) {
      this.focus = ecefToLocal(target.x, target.y, target.z);
      this.viewDistance = this.view.camera.raw.position.distanceTo(target);
    }
    const focus = this.focus;
    this.backdrop?.update(focus);
    this.streamer.update(focus, this.options.radius, this.options.concurrency);
    const nearDistance = 160;
    const eyeHeight = this.view.camera.positionGeographic.height;
    for (const [key, visual] of this.tiles) {
      const [tx, tz] = key.split("_").map(Number);
      const half = this.tileSize / 2;
      const dx = Math.max(
        0,
        Math.abs((tx + 0.5) * this.tileSize - focus.x) - half,
      );
      const dz = Math.max(
        0,
        Math.abs((tz + 0.5) * this.tileSize - focus.z) - half,
      );
      const dy = Math.max(
        0,
        eyeHeight -
          this.streamer.ground(
            (tx + 0.5) * this.tileSize,
            (tz + 0.5) * this.tileSize,
          ) -
          25,
      );
      const distance = Math.hypot(dx, dz, dy);
      visual.setDistance(
        distance,
        visual.treeCount > 120 ? nearDistance * 0.5 : nearDistance,
      );
      this.updateTilePhotos(key, distance);
    }
    this.renderDynamics(this.ctx.getRenderer());
  }

  renderDynamics(renderer: WebGLRenderer): void {
    const before = this.renderPassSnapshot(renderer);
    this.dynamics?.render(renderer);
    const pass = this.renderPassDelta(before, renderer);
    this.lampPass.calls += pass.calls;
    this.lampPass.triangles += pass.triangles;
  }

  /** Record a water-mirror re-render pass (called by CityWaterMirrorEffectDesc). */
  recordMirrorPass(calls: number, triangles: number): void {
    this.mirrorPass.calls += calls;
    this.mirrorPass.triangles += triangles;
  }

  private renderPassSnapshot(renderer: WebGLRenderer): {
    calls: number;
    triangles: number;
  } {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }

  private renderPassDelta(
    before: { calls: number; triangles: number },
    renderer: WebGLRenderer,
  ): { calls: number; triangles: number } {
    const after = renderer.info.render;
    // `renderer.info` resets at the start of each render() call, so a lower
    // value after the pass means the pass's own count is simply `after`.
    return {
      calls:
        after.calls < before.calls ? after.calls : after.calls - before.calls,
      triangles:
        after.triangles < before.triangles
          ? after.triangles
          : after.triangles - before.triangles,
    };
  }

  renderStats(): CityRenderStats {
    const renderer = this.ctx.getRenderer();
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      mirrorCalls: this.mirrorPass.calls,
      mirrorTriangles: this.mirrorPass.triangles,
      lampCalls: this.lampPass.calls,
      lampTriangles: this.lampPass.triangles,
    };
  }

  mirrorState() {
    if (!this.materials) return undefined;
    return {
      uniforms: this.materials.uniforms,
      tiles: this.mirrorTiles as ReadonlyMap<string, CityMirrorTile>,
      objects: [
        this.props?.mirrorGroup,
        this.dynamics?.root,
        this.structuresMesh,
        this.flyoversMesh,
      ].filter((object): object is NonNullable<typeof object> =>
        Boolean(object),
      ),
      enabled: this.options.mirror !== false,
    };
  }

  onUpdateConfig(updates: CityUpdate): void {
    if (updates.city) {
      this.options = { ...this.options, ...updates.city };
      this.materials?.setNight(this.options.night ?? 0);
      this.materials?.setSeason(this.options.season ?? 0);
      this.materials?.setNightLights(this.options.nightLights);
      this.materials?.setWater(this.options.water);
      this.traffic?.setHeadlights(this.options.nightLights?.headlights);
      this.updateDynamicCounts();
      this.traffic?.setEnabled(this.options.traffic !== false);
      this.railways?.setEnabled(this.options.trains !== false);
      if (this.orthophoto) {
        this.materials?.setOrtho(
          this.options.ortho !== false,
          this.orthophoto.texture,
          this.orthophoto.rect,
        );
      }
    }
    super.onUpdateConfig(updates);
  }

  private report(stats: CityStats): void {
    this.options.onStats?.(stats);
  }

  async onDestroy(): Promise<void> {
    await this.dynamicsLoad;
    this.dynamics?.dispose();
    this.dynamics = undefined;
    this.traffic = undefined;
    this.railways = undefined;
    this.lampLight = undefined;
    this.birds = undefined;
    this.structuresMesh?.removeFromParent();
    this.structuresMesh?.geometry.dispose();
    if (this.structuresMesh?.material instanceof Material)
      this.structuresMesh.material.dispose();
    this.structuresMesh = undefined;
    this.flyoversMesh?.removeFromParent();
    this.flyoversMesh?.geometry.dispose();
    if (this.flyoversMesh?.material instanceof Material)
      this.flyoversMesh.material.dispose();
    this.flyoversMesh = undefined;
    this.backdrop?.dispose();
    this.backdrop = undefined;
    this.mirrorTiles.delete("__sea__");
    this.streamer?.dispose();
    this.streamer = undefined;
    for (const key of [...this.tiles.keys()]) this.removeTile(key);
    this.mirrorTiles.clear();
    this.props?.dispose();
    this.props = undefined;
    this.materials?.dispose();
    this.materials = undefined;
    this.textures?.dispose();
    this.textures = undefined;
    this.orthophoto = undefined;
    super.onDestroy();
  }
}
