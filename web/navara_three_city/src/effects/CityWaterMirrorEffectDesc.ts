import type ThreeView from "@navaramap/three";
import {
  EffectDesc,
  Pass,
  type EffectConfig,
  type EffectUpdate,
  type ViewContext,
} from "@navaramap/three";
import { Pass as PostProcessingPass } from "postprocessing";
import {
  Color,
  Frustum,
  HalfFloatType,
  InstancedMesh,
  Line,
  LinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from "three";

import type { CityMeshDesc } from "../CityMeshDesc";
import type { CityMirrorTile } from "../runtime/geometry";

export type CityWaterMirrorOptions = {
  enabled?: boolean;
  resolutionScale?: number;
  frameInterval?: number;
};
export type CityWaterMirrorDescription = {
  cityMirror?: Partial<CityWaterMirrorOptions>;
};
export type CityWaterMirrorConfig = EffectConfig & CityWaterMirrorDescription;
export type CityWaterMirrorUpdate = EffectUpdate & CityWaterMirrorDescription;

class MirrorAuxiliaryPass extends PostProcessingPass {
  override render(): void {}
}

type MirrorPass = Pass<MirrorAuxiliaryPass, null>;

const DEFAULTS: CityWaterMirrorOptions = {
  enabled: true,
  resolutionScale: 0.5,
  frameInterval: 1,
};

class WaterMirror {
  /** Draw calls / triangles of the most recent mirror re-render pass. */
  pass = { calls: 0, triangles: 0 };
  private target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  private camera = new PerspectiveCamera();
  private frustum = new Frustum();
  private mirrorFrustum = new Frustum();
  private viewProjection = new Matrix4();
  private mirrorPosition = new Vector3();
  private forward = new Vector3();
  private cameraUp = new Vector3();
  private lookAt = new Vector3();
  private plane = new Plane();
  private clip = new Vector4();
  private q = new Vector4();
  private projected = new Vector4();
  private crop = new Matrix4();
  private size = new Vector2();
  private previousClear = new Color();
  private objectVisibility = new Map<Object3D, boolean>();
  private scratchSphere = new Sphere();

  render(
    renderer: WebGLRenderer,
    view: ThreeView,
    ctx: ViewContext,
    state: NonNullable<ReturnType<CityMeshDesc["mirrorState"]>>,
    resolutionScale: number,
  ): void {
    this.pass.calls = 0;
    this.pass.triangles = 0;
    const { uniforms, tiles, objects, enabled } = state;
    uniforms.uMirror.value = this.target.texture;
    if (!enabled || tiles.size === 0) {
      uniforms.uMirrorOn.value = 0;
      return;
    }
    renderer.getDrawingBufferSize(this.size);
    const scale = Math.max(0.25, Math.min(1, resolutionScale));
    const width = Math.max(1, Math.round(this.size.x * scale));
    const height = Math.max(1, Math.round(this.size.y * scale));
    if (this.target.width !== width || this.target.height !== height)
      this.target.setSize(width, height);

    const camera = view.camera.raw;
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    let selected: CityMirrorTile["water"];
    let bestDistance = Infinity;
    const visibleWater: NonNullable<CityMirrorTile["water"]>[] = [];
    for (const tile of tiles.values()) {
      const water = tile.water;
      const visible = Boolean(
        water && this.frustum.intersectsSphere(water.sphere),
      );
      if (!visible || !water) continue;
      visibleWater.push(water);
      const distance = camera.position.distanceTo(water.sphere.center);
      const above = this.cameraUp
        .copy(camera.position)
        .sub(water.sphere.center)
        .dot(water.up);
      if (above > 0.01 && distance < bestDistance) {
        bestDistance = distance;
        selected = water;
      }
    }
    if (!selected) {
      uniforms.uMirrorOn.value = 0;
      return;
    }

    const up = selected.up;
    const center = selected.sphere.center;
    const signedDistance = this.cameraUp
      .copy(camera.position)
      .sub(center)
      .dot(up);
    this.mirrorPosition
      .copy(camera.position)
      .addScaledVector(up, -2 * signedDistance);
    camera.getWorldDirection(this.forward);
    this.forward.addScaledVector(up, -2 * this.forward.dot(up));
    this.cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.cameraUp.addScaledVector(up, -2 * this.cameraUp.dot(up));
    this.camera.copy(camera);
    this.camera.position.copy(this.mirrorPosition);
    this.camera.up.copy(this.cameraUp);
    this.lookAt.copy(this.mirrorPosition).add(this.forward);
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld(true);
    this.cropToWater(visibleWater);
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert();

    this.plane.setFromNormalAndCoplanarPoint(up, center);
    this.plane.applyMatrix4(this.camera.matrixWorldInverse);
    this.clip.set(
      this.plane.normal.x,
      this.plane.normal.y,
      this.plane.normal.z,
      this.plane.constant + 0.3,
    );
    this.q.set(Math.sign(this.clip.x), Math.sign(this.clip.y), 1, 1);
    this.q.applyMatrix4(this.camera.projectionMatrixInverse);
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    const projection = this.camera.projectionMatrix.elements;
    projection[2] = this.clip.x;
    projection[6] = this.clip.y;
    projection[10] = this.clip.z + 1;
    projection[14] = this.clip.w;
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert();
    uniforms.uMirrorMatrix.value.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    this.mirrorFrustum.setFromProjectionMatrix(uniforms.uMirrorMatrix.value);
    const visibility = new Map<CityMirrorTile, boolean>();
    for (const tile of tiles.values()) {
      if (!tile.sphere) continue;
      visibility.set(tile, tile.group.visible);
      tile.group.visible =
        tile.group.visible && this.mirrorFrustum.intersectsSphere(tile.sphere);
    }
    this.objectVisibility.clear();
    for (const object of objects) this.cullObjectLeaves(object);

    // The city renders into the MRT scene whenever the G-buffer is active;
    // mirroring only the opaque scene would reflect an empty city.
    const scene =
      ctx.scenes.mrt.children.length > 0 ? ctx.scenes.mrt : ctx.scenes.opaque;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    const previousShadows = renderer.shadowMap.autoUpdate;
    const previousBackground = scene.background;
    const hadLights = scene.children.includes(ctx.scenes.light);
    renderer.getClearColor(this.previousClear);
    try {
      renderer.shadowMap.autoUpdate = false;
      uniforms.uMirrorOn.value = 0;
      if (!hadLights) scene.add(ctx.scenes.light);
      // Clear to transparent black like the Tokyo reference: the water shader's
      // `thing` mask then separates real geometry from empty sky, instead of an
      // opaque sky background faking a reflection everywhere.
      scene.background = null;
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      const before = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
      renderer.render(scene, this.camera);
      const after = renderer.info.render;
      this.pass.calls =
        after.calls < before.calls ? after.calls : after.calls - before.calls;
      this.pass.triangles =
        after.triangles < before.triangles
          ? after.triangles
          : after.triangles - before.triangles;
      uniforms.uMirrorOn.value = 1;
    } finally {
      this.objectVisibility.forEach((visible, object) => {
        object.visible = visible;
      });
      this.objectVisibility.clear();
      visibility.forEach((visible, tile) => {
        tile.group.visible = visible;
      });
      scene.background = previousBackground;
      if (!hadLights) scene.remove(ctx.scenes.light);
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(this.previousClear, previousAlpha);
      renderer.shadowMap.autoUpdate = previousShadows;
    }
  }

  private cullObjectLeaves(root: Object3D): void {
    root.updateMatrixWorld(false);
    root.traverse((child) => {
      if (child instanceof InstancedMesh) {
        if (!child.boundingSphere) child.computeBoundingSphere();
        if (child.boundingSphere) this.cullLeaf(child, child.boundingSphere);
      } else if (child instanceof Mesh || child instanceof Line) {
        if (!child.geometry.boundingSphere)
          child.geometry.computeBoundingSphere();
        if (child.geometry.boundingSphere)
          this.cullLeaf(child, child.geometry.boundingSphere);
      }
    });
  }

  private cullLeaf(object: Object3D, sphere: Sphere): void {
    this.objectVisibility.set(object, object.visible);
    this.scratchSphere.copy(sphere).applyMatrix4(object.matrixWorld);
    object.visible =
      object.visible && this.mirrorFrustum.intersectsSphere(this.scratchSphere);
  }

  private cropToWater(waters: NonNullable<CityMirrorTile["water"]>[]): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const water of waters) {
      const { center, radius } = water.sphere;
      for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
          for (const z of [-1, 1]) {
            this.projected
              .set(
                center.x + x * radius,
                center.y + y * radius,
                center.z + z * radius,
                1,
              )
              .applyMatrix4(this.camera.matrixWorldInverse)
              .applyMatrix4(this.camera.projectionMatrix);
            if (this.projected.w <= 0.01) return;
            const inverseW = 1 / this.projected.w;
            const projectedX = this.projected.x * inverseW;
            const projectedY = this.projected.y * inverseW;
            minX = Math.min(minX, projectedX);
            minY = Math.min(minY, projectedY);
            maxX = Math.max(maxX, projectedX);
            maxY = Math.max(maxY, projectedY);
          }
        }
      }
    }
    minX = Math.max(-1, minX - 0.3);
    minY = Math.max(-1, minY - 0.3);
    maxX = Math.min(1, maxX + 0.3);
    maxY = Math.min(1, maxY + 0.3);
    if (maxX <= minX || maxY <= minY) return;
    const scaleX = 2 / (maxX - minX);
    const scaleY = 2 / (maxY - minY);
    this.crop.set(
      scaleX,
      0,
      0,
      -0.5 * (maxX + minX) * scaleX,
      0,
      scaleY,
      0,
      -0.5 * (maxY + minY) * scaleY,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    );
    this.camera.projectionMatrix.premultiply(this.crop);
  }

  dispose(): void {
    this.target.dispose();
  }
}

export class CityWaterMirrorEffectDesc extends EffectDesc<
  CityWaterMirrorConfig,
  CityWaterMirrorUpdate,
  MirrorPass
> {
  static override key = "cityMirror";
  static override insertBefore = ["toneMapping", "smaa", "fxaa", "final"];
  private options: CityWaterMirrorOptions;
  private mirror = new WaterMirror();
  private renderer?: WebGLRenderer;
  private frame = 0;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: CityWaterMirrorConfig = {},
  ) {
    const options = { ...DEFAULTS, ...config.cityMirror };
    super(view, ctx, { ...config, cityMirror: options });
    this.options = options;
  }

  override createPass(): MirrorPass {
    // `EffectDesc.onCreate()` invokes `createPass()` without arguments, so the
    // renderer must come from the view context, not from call-site args.
    this.renderer = this.ctx.getRenderer();
    const pass = new MirrorAuxiliaryPass();
    pass.name = "CityWaterMirrorAuxiliaryPass";
    return new Pass(pass, null, { enabled: true });
  }

  override update(_time: number): void {
    if (!this.renderer) return;
    const city = this.ctx.findMesh<CityMeshDesc>("city");
    const state = city?.mirrorState();
    if (state && this.options.enabled === false) {
      state.uniforms.uMirrorOn.value = 0;
      return;
    }
    this.frame += 1;
    const frameInterval = Math.max(
      1,
      Math.min(4, Math.round(this.options.frameInterval ?? 1)),
    );
    if (state && this.frame % frameInterval === 0) {
      this.mirror.render(
        this.renderer,
        this.view,
        this.ctx,
        state,
        this.options.resolutionScale ?? 0.5,
      );
      city?.recordMirrorPass(
        this.mirror.pass.calls,
        this.mirror.pass.triangles,
      );
    }
  }

  override onUpdateConfig(updates: CityWaterMirrorUpdate): void {
    super.onUpdateConfig(updates);
    if (updates.cityMirror) Object.assign(this.options, updates.cityMirror);
  }

  override onDestroy(): void {
    this.mirror.dispose();
    super.onDestroy();
  }
}
