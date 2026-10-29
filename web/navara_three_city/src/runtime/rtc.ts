import { Group, Matrix4, Quaternion, Vector3 } from "three";

import { localBasisEcef, localToEcef } from "./projection";

/** Converts city-local ENU transforms into one city-level RTC frame. */
export class CityRtcFrame {
  readonly origin: Vector3;
  private rotation = new Matrix4();
  private basis = new Matrix4();

  constructor() {
    this.origin = new Vector3().fromArray(localToEcef(0, 0, 0).ecef);
  }

  createRoot(name: string): Group {
    const root = new Group();
    root.name = name;
    root.position.copy(this.origin);
    root.updateMatrix();
    root.matrixAutoUpdate = false;
    return root;
  }

  position(x: number, y: number, z: number, target: Vector3): Vector3 {
    return target.fromArray(localToEcef(x, y, z).ecef).sub(this.origin);
  }

  matrix(
    position: Vector3,
    quaternion: Quaternion,
    scale: Vector3,
    target: Matrix4,
  ): Matrix4 {
    const projected = localToEcef(position.x, position.y, position.z);
    const { east, north, up } = localBasisEcef(projected.geographic);
    this.basis.set(
      east[0],
      up[0],
      -north[0],
      0,
      east[1],
      up[1],
      -north[1],
      0,
      east[2],
      up[2],
      -north[2],
      0,
      0,
      0,
      0,
      1,
    );
    this.rotation.makeRotationFromQuaternion(quaternion);
    this.rotation.scale(scale);
    target.multiplyMatrices(this.basis, this.rotation);
    target.setPosition(
      projected.ecef[0] - this.origin.x,
      projected.ecef[1] - this.origin.y,
      projected.ecef[2] - this.origin.z,
    );
    return target;
  }
}
