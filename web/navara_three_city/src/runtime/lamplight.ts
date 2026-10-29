import {
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  MaxEquation,
  MeshBasicMaterial,
  OneFactor,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

import type { CityUniforms } from "../materials/programs";

import type { CityDynamicFrame, CityDynamicSystem } from "./dynamics";
import { localBasisEcef, localToGeographic } from "./projection";
import type { CityRtcFrame } from "./rtc";

const SIZE = 1024;

/** Top-down light map shared by vehicle and train headlight footprints. */
export class CityLampLight implements CityDynamicSystem {
  private scene = new Scene();
  private root: Group;
  private camera = new OrthographicCamera();
  private target = new WebGLRenderTarget(SIZE, SIZE, {
    type: HalfFloatType,
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  private materials = new Set<MeshBasicMaterial>();
  private center = new Vector3();
  private previousClear = new Color();
  private black = new Color(0, 0, 0);
  private frame?: CityDynamicFrame;
  private up = new Vector3();

  constructor(
    private rtc: CityRtcFrame,
    private uniforms: CityUniforms,
  ) {
    this.root = rtc.createRoot("city-lamp-footprints");
    this.scene.add(this.root);
    this.uniforms.uLampMap.value = this.target.texture;
  }

  add(group: Group): void {
    this.root.add(group);
  }

  createMaterial(map: Texture, vertexColors = false): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      map,
      vertexColors,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      forceSinglePass: true,
      blending: CustomBlending,
      blendEquation: MaxEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    this.materials.add(material);
    return material;
  }

  update(frame: CityDynamicFrame): void {
    this.frame = frame;
  }

  render(renderer: WebGLRenderer): void {
    const frame = this.frame;
    if (!frame || frame.night <= 0.02 || this.root.children.length === 0) {
      this.uniforms.uLampOn.value = 0;
      return;
    }
    const basis = localBasisEcef(
      localToGeographic(frame.focus.x, frame.focus.z),
    );
    this.up.fromArray(basis.up);
    this.rtc.position(frame.focus.x, 0, frame.focus.z, this.center);
    this.center.add(this.rtc.origin);
    const extent = MathUtils.clamp(frame.viewDistance * 0.7, 350, 1800);
    this.camera.left = -extent;
    this.camera.right = extent;
    this.camera.top = extent;
    this.camera.bottom = -extent;
    this.camera.near = 1;
    this.camera.far = 4000;
    this.camera.position.copy(this.center).addScaledVector(this.up, 2000);
    this.camera.up.fromArray(basis.north).negate();
    this.camera.lookAt(this.center);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.uniforms.uLampMatrix.value.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );

    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    const previousShadows = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(this.previousClear);
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(this.black, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.previousClear, previousAlpha);
    renderer.shadowMap.autoUpdate = previousShadows;
    this.uniforms.uLampOn.value = frame.night;
  }

  dispose(): void {
    this.target.dispose();
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
    this.scene.clear();
    this.uniforms.uLampOn.value = 0;
  }
}
