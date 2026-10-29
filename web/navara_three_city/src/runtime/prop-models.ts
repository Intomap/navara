import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
} from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";

import { PROP } from "../constants";

export type RGB = [number, number, number];

export const CONCRETE: RGB = [0.6, 0.6, 0.58];
export const STEEL: RGB = [0.36, 0.38, 0.4];
export const DARK: RGB = [0.16, 0.17, 0.18];
export const WOOD: RGB = [0.45, 0.32, 0.2];
export const STONE: RGB = [0.55, 0.54, 0.52];
export const BRONZE: RGB = [0.3, 0.24, 0.16];
export const RED: RGB = [0.78, 0.1, 0.1];

export const POLE_LAMP = { x: 1, y: 5.6 };
export const LAMP = { y: 8.5, z: 2.25 };
export const SIGNAL = { arm: 3.4, y: 5.6 };
export const VENDING_BODY: RGB[] = [
  [0.92, 0.92, 0.9],
  [0.75, 0.1, 0.12],
  [0.12, 0.3, 0.62],
  [0.9, 0.86, 0.72],
];

export function colored(geometry: BufferGeometry, rgb: RGB): BufferGeometry {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (result !== geometry) geometry.dispose();
  const color = new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
  const colors = new Float32Array(result.attributes.position.count * 3);
  for (let i = 0; i < result.attributes.position.count; i += 1)
    color.toArray(colors, i * 3);
  result.setAttribute("color", new BufferAttribute(colors, 3));
  result.deleteAttribute("uv");
  return result;
}

export function tube(
  r0: number,
  r1: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rgb: RGB,
  segments = 8,
): BufferGeometry {
  return colored(
    new CylinderGeometry(r1, r0, h, segments).translate(x, y + h / 2, z),
    rgb,
  );
}

export function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rgb: RGB,
): BufferGeometry {
  return colored(new BoxGeometry(w, h, d).translate(x, y, z), rgb);
}

function shape(
  geometry: BufferGeometry,
  rgb: RGB,
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): BufferGeometry {
  return colored(geometry.scale(sx, sy, sz).translate(x, y, z), rgb);
}

export function merged(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error("Prop geometry is empty");
  return geometry;
}

export function withLift(
  geometry: BufferGeometry,
  lift: number,
): BufferGeometry {
  return geometry.translate(0, lift, 0);
}

export function utilityPoleGeometry(transformer: boolean): BufferGeometry {
  const parts = [
    colored(
      new CylinderGeometry(0.03, 0.03, 0.9, 5)
        .rotateZ(Math.PI / 2)
        .translate(0.5, POLE_LAMP.y + 0.08, 0),
      STEEL,
    ),
    box(0.5, 0.09, 0.2, POLE_LAMP.x, POLE_LAMP.y + 0.04, 0, [0.7, 0.71, 0.72]),
    tube(0.17, 0.12, 10.2, 0, 0, 0, CONCRETE),
    box(1.9, 0.09, 0.09, 0, 9.6, 0, STEEL),
    box(1.5, 0.09, 0.09, 0, 8.9, 0, STEEL),
    box(0.5, 0.07, 0.07, 0.25, 7.1, 0, STEEL),
  ];
  for (const x of [-0.85, 0, 0.85])
    parts.push(tube(0.04, 0.03, 0.16, x, 9.64, 0, [0.85, 0.85, 0.82], 6));
  if (transformer)
    parts.push(
      tube(0.3, 0.3, 0.85, 0.42, 7.7, 0, [0.5, 0.52, 0.53], 10),
      box(0.5, 0.06, 0.4, 0.3, 7.66, 0, STEEL),
    );
  return merged(parts);
}

export function streetLightGeometry(): BufferGeometry {
  return withLift(
    merged([
      tube(0.11, 0.07, 8.6, 0, 0, 0, STEEL),
      colored(
        new CylinderGeometry(0.045, 0.045, 2.1, 6)
          .rotateX(Math.PI / 2)
          .translate(0, 8.6, 1),
        STEEL,
      ),
      box(0.3, 0.1, 0.75, 0, 8.58, 2.25, [0.7, 0.71, 0.72]),
    ]),
    0.15,
  );
}

export function signalGeometry(): BufferGeometry {
  const { arm, y } = SIGNAL;
  return withLift(
    merged([
      tube(0.12, 0.09, 6.3, 0, 0, 0, STEEL),
      colored(
        new CylinderGeometry(0.05, 0.05, arm, 6)
          .rotateZ(Math.PI / 2)
          .translate(-arm / 2, y + 0.45, 0),
        STEEL,
      ),
      box(1.3, 0.46, 0.22, -arm + 0.35, y, 0, [0.72, 0.73, 0.72]),
      box(1.34, 0.05, 0.3, -arm + 0.35, y + 0.25, 0.13, DARK),
    ]),
    0.15,
  );
}

export function signalLensGeometry(lens: number): BufferGeometry {
  const x = -SIGNAL.arm + 0.35 + (lens - 1) * -0.4;
  return new CircleGeometry(0.15, 16).translate(x, SIGNAL.y + 0.15, 0.115);
}

export function vendingGeometry(): BufferGeometry {
  return withLift(
    merged([
      box(1.02, 1.83, 0.72, 0, 0.915, 0, [1, 1, 1]),
      box(1.06, 0.1, 0.76, 0, 0.05, 0, DARK),
    ]),
    0.02,
  );
}

export function vendingPanelGeometry(): BufferGeometry {
  return new PlaneGeometry(0.94, 1.66).translate(0, 0.99, 0.365);
}

function busStopGeometry(shelter: boolean): BufferGeometry {
  const parts = [
    tube(0.045, 0.045, 2.75, 0, 0, 0, STEEL),
    box(0.34, 0.3, 0.34, 0, 0.15, 0, CONCRETE),
    colored(
      new CylinderGeometry(0.3, 0.3, 0.05, 20)
        .rotateX(Math.PI / 2)
        .translate(0, 2.5, 0),
      [0.93, 0.5, 0.1],
    ),
    colored(
      new CylinderGeometry(0.2, 0.2, 0.06, 16)
        .rotateX(Math.PI / 2)
        .translate(0, 2.5, 0),
      [0.95, 0.95, 0.92],
    ),
    box(0.5, 0.75, 0.06, 0, 1.35, 0, [0.9, 0.9, 0.88]),
  ];
  if (shelter) {
    parts.push(
      box(3.6, 0.08, 1.5, 1.2, 2.55, -0.9, [0.82, 0.84, 0.86]),
      box(3.4, 1.9, 0.04, 1.2, 1.3, -1.6, [0.78, 0.84, 0.86]),
      box(2.2, 0.06, 0.4, 1.2, 0.45, -1.3, WOOD),
    );
    for (const x of [-0.5, 2.9])
      parts.push(tube(0.04, 0.04, 2.55, x, 0, -1.5, STEEL));
  }
  return merged(parts);
}

function benchGeometry(): BufferGeometry {
  return merged([
    box(1.6, 0.06, 0.45, 0, 0.43, 0, WOOD),
    box(1.6, 0.42, 0.05, 0, 0.72, -0.21, WOOD),
    box(0.06, 0.43, 0.42, -0.7, 0.215, 0, STEEL),
    box(0.06, 0.43, 0.42, 0.7, 0.215, 0, STEEL),
  ]);
}

function bollardGeometry(): BufferGeometry {
  return merged([
    tube(0.075, 0.075, 0.85, 0, 0, 0, [0.3, 0.31, 0.33], 10),
    tube(0.08, 0.08, 0.1, 0, 0.62, 0, [0.9, 0.9, 0.86], 10),
  ]);
}

function postBoxGeometry(): BufferGeometry {
  return merged([
    box(0.3, 0.75, 0.28, 0, 0.375, 0, RED),
    box(0.52, 0.72, 0.46, 0, 1.11, 0, RED),
    box(0.56, 0.05, 0.5, 0, 1.49, 0, RED),
    box(0.3, 0.04, 0.02, 0, 1.3, 0.235, DARK),
  ]);
}

function phoneGeometry(): BufferGeometry {
  return merged([
    box(0.95, 0.12, 0.95, 0, 2.2, 0, [0.4, 0.45, 0.44]),
    box(0.95, 0.1, 0.95, 0, 0.05, 0, [0.4, 0.45, 0.44]),
    box(0.04, 2.1, 0.9, -0.45, 1.1, 0, [0.72, 0.82, 0.8]),
    box(0.04, 2.1, 0.9, 0.45, 1.1, 0, [0.72, 0.82, 0.8]),
    box(0.9, 2.1, 0.04, 0, 1.1, -0.45, [0.72, 0.82, 0.8]),
    box(0.3, 0.4, 0.2, 0, 1.2, -0.3, [0.25, 0.6, 0.35]),
  ]);
}

function subwayGeometry(): BufferGeometry {
  return merged([
    box(0.2, 1.1, 4.6, -1.1, 0.55, 0, CONCRETE),
    box(0.2, 1.1, 4.6, 1.1, 0.55, 0, CONCRETE),
    box(2.4, 1.1, 0.2, 0, 0.55, -2.3, CONCRETE),
    box(2.0, 0.04, 4.4, 0, 0.03, 0, [0.03, 0.03, 0.035]),
    ...(
      [
        [-1.1, 2.2],
        [1.1, 2.2],
        [-1.1, -2.2],
        [1.1, -2.2],
      ] as [number, number][]
    ).map(([x, z]) => tube(0.05, 0.05, 2.6, x, 0, z, STEEL)),
    box(2.6, 0.12, 5.0, 0, 2.66, 0, [0.85, 0.86, 0.87]),
    box(2.6, 0.42, 0.1, 0, 2.42, 2.5, [0.06, 0.4, 0.75]),
  ]);
}

function statueGeometry(variant: number): BufferGeometry {
  if (variant === 1)
    return merged([
      box(1.5, 1.35, 1.1, 0, 0.675, 0, STONE),
      box(1.7, 0.12, 1.3, 0, 0.06, 0, STONE),
      shape(
        new SphereGeometry(0.5, 12, 8),
        BRONZE,
        0,
        1.75,
        -0.12,
        0.62,
        0.75,
        0.85,
      ),
      shape(
        new SphereGeometry(0.5, 12, 8),
        BRONZE,
        0,
        2.05,
        0.12,
        0.5,
        0.8,
        0.5,
      ),
      shape(
        new SphereGeometry(0.5, 12, 8),
        BRONZE,
        0,
        2.55,
        0.2,
        0.42,
        0.42,
        0.46,
      ),
      shape(
        new SphereGeometry(0.5, 8, 6),
        BRONZE,
        0,
        2.5,
        0.42,
        0.2,
        0.18,
        0.3,
      ),
      shape(
        new ConeGeometry(0.5, 1, 6),
        BRONZE,
        -0.13,
        2.82,
        0.14,
        0.16,
        0.2,
        0.12,
      ),
      shape(
        new ConeGeometry(0.5, 1, 6),
        BRONZE,
        0.13,
        2.78,
        0.14,
        0.16,
        0.14,
        0.12,
      ),
      ...[-0.14, 0.14].map((x) =>
        shape(
          new CylinderGeometry(0.5, 0.5, 1, 8),
          BRONZE,
          x,
          1.72,
          0.3,
          0.13,
          0.75,
          0.13,
        ),
      ),
      shape(
        new TorusGeometry(0.5, 0.2, 6, 10, Math.PI * 1.4),
        BRONZE,
        0,
        1.75,
        -0.48,
        0.3,
        0.3,
        0.3,
      ),
    ]);
  if (variant === 2)
    return merged([
      shape(
        new SphereGeometry(0.5, 12, 10),
        [0.35, 0.34, 0.33],
        0,
        1.35,
        0,
        1.5,
        2.7,
        1.3,
      ),
      box(0.3, 0.9, 0.4, 0, 1.45, 0.62, [0.33, 0.32, 0.31]),
      box(1.0, 0.12, 0.2, 0, 1.95, 0.6, [0.28, 0.27, 0.26]),
    ]);
  return merged([
    box(0.9, 1.0, 0.9, 0, 0.5, 0, STONE),
    shape(new SphereGeometry(0.5, 10, 8), BRONZE, 0, 1.55, 0, 0.5, 1.1, 0.4),
    shape(new SphereGeometry(0.5, 8, 6), BRONZE, 0, 2.25, 0, 0.3, 0.32, 0.3),
  ]);
}

function bikesGeometry(): BufferGeometry {
  const bikeColors: RGB[] = [
    [0.12, 0.2, 0.5],
    [0.6, 0.1, 0.1],
    [0.75, 0.75, 0.75],
    [0.1, 0.1, 0.1],
    [0.2, 0.45, 0.25],
  ];
  const parts = [box(3.0, 0.05, 0.05, 0, 0.75, -0.6, STEEL)];
  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * 0.58;
    const c = bikeColors[i];
    for (const z of [-0.52, 0.52])
      parts.push(
        colored(
          new TorusGeometry(0.31, 0.022, 4, 12)
            .rotateY(Math.PI / 2)
            .translate(x, 0.33, z),
          DARK,
        ),
      );
    parts.push(
      box(0.04, 0.05, 1.0, x, 0.6, 0, c),
      box(0.04, 0.5, 0.05, x, 0.72, -0.3, c),
      box(0.04, 0.6, 0.05, x, 0.78, 0.45, c),
      box(0.42, 0.03, 0.03, x, 1.05, 0.45, DARK),
      box(0.12, 0.05, 0.24, x, 0.98, -0.3, DARK),
    );
  }
  return merged(parts);
}

function shrineGeometry(): BufferGeometry {
  return merged([
    tube(0.07, 0.06, 1.9, -0.6, 0, 0, RED),
    tube(0.07, 0.06, 1.9, 0.6, 0, 0, RED),
    box(1.7, 0.1, 0.12, 0, 1.92, 0, RED),
    box(1.4, 0.07, 0.08, 0, 1.6, 0, RED),
    box(0.3, 0.7, 0.3, 0, 0.35, -0.9, STONE),
    box(0.42, 0.3, 0.42, 0, 0.85, -0.9, STONE),
    box(0.56, 0.1, 0.56, 0, 1.05, -0.9, STONE),
  ]);
}

function hydrantGeometry(): BufferGeometry {
  return merged([
    tube(0.035, 0.035, 2.6, 0, 0, 0, [0.85, 0.85, 0.82]),
    colored(
      new CylinderGeometry(0.3, 0.3, 0.04, 18)
        .rotateX(Math.PI / 2)
        .translate(0, 2.4, 0),
      RED,
    ),
    colored(
      new CylinderGeometry(0.2, 0.2, 0.05, 16)
        .rotateX(Math.PI / 2)
        .translate(0, 2.4, 0),
      [0.95, 0.95, 0.92],
    ),
  ]);
}

function infoGeometry(): BufferGeometry {
  return merged([
    tube(0.04, 0.04, 1.9, -0.55, 0, 0, STEEL),
    tube(0.04, 0.04, 1.9, 0.55, 0, 0, STEEL),
    box(1.3, 0.95, 0.06, 0, 1.4, 0, [0.9, 0.9, 0.86]),
    box(1.1, 0.75, 0.07, 0, 1.4, 0, [0.35, 0.55, 0.45]),
  ]);
}

function tableGeometry(): BufferGeometry {
  return merged([
    box(1.6, 0.06, 0.75, 0, 0.74, 0, WOOD),
    box(1.6, 0.05, 0.28, 0, 0.44, 0.62, WOOD),
    box(1.6, 0.05, 0.28, 0, 0.44, -0.62, WOOD),
    box(0.08, 0.74, 1.4, -0.6, 0.37, 0, STEEL),
    box(0.08, 0.74, 1.4, 0.6, 0.37, 0, STEEL),
  ]);
}

function playGeometry(variant: number): BufferGeometry {
  if (variant === 1)
    return merged([
      tube(0.04, 0.04, 2.2, -1.2, 0, 0, [0.2, 0.45, 0.75]),
      tube(0.04, 0.04, 2.2, 1.2, 0, 0, [0.2, 0.45, 0.75]),
      box(2.5, 0.07, 0.07, 0, 2.2, 0, [0.2, 0.45, 0.75]),
      ...[-0.5, 0.5].flatMap((x) => [
        box(0.02, 1.6, 0.02, x - 0.18, 1.4, 0, DARK),
        box(0.02, 1.6, 0.02, x + 0.18, 1.4, 0, DARK),
        box(0.42, 0.04, 0.2, x, 0.6, 0, [0.85, 0.2, 0.15]),
      ]),
    ]);
  return merged([
    box(0.9, 0.08, 0.9, 0, 1.5, -1.0, [0.9, 0.7, 0.1]),
    ...(
      [
        [-0.4, -1.4],
        [0.4, -1.4],
        [-0.4, -0.6],
        [0.4, -0.6],
      ] as [number, number][]
    ).map(([x, z]) => tube(0.04, 0.04, 1.5, x, 0, z, [0.2, 0.45, 0.75])),
    colored(
      new BoxGeometry(0.6, 0.05, 2.6).rotateX(-0.55).translate(0, 0.78, 0.55),
      [0.85, 0.2, 0.15],
    ),
  ]);
}

function toriiGeometry(): BufferGeometry {
  const wood: RGB = [0.42, 0.3, 0.2];
  return merged([
    tube(0.3, 0.26, 5.6, -2.5, 0, 0, wood, 14),
    tube(0.3, 0.26, 5.6, 2.5, 0, 0, wood, 14),
    box(6.0, 0.36, 0.3, 0, 4.4, 0, wood),
    box(7.0, 0.42, 0.5, 0, 5.75, 0, wood),
    box(7.4, 0.2, 0.62, 0, 6.05, 0, wood),
    colored(
      new BoxGeometry(0.9, 0.2, 0.62).rotateZ(0.22).translate(-3.9, 6.18, 0),
      wood,
    ),
    colored(
      new BoxGeometry(0.9, 0.2, 0.62).rotateZ(-0.22).translate(3.9, 6.18, 0),
      wood,
    ),
  ]);
}

function railCrossingGeometry(): BufferGeometry {
  const yellow: RGB = [0.92, 0.75, 0.1];
  const parts: BufferGeometry[] = [];
  for (const [x, z, s] of [
    [-3.6, -4.5, 1],
    [3.6, 4.5, -1],
  ] as [number, number, number][]) {
    parts.push(
      tube(0.06, 0.06, 3.6, x, 0, z, yellow),
      colored(
        new BoxGeometry(1.3, 0.14, 0.04).rotateZ(0.6).translate(x, 3.0, z),
        yellow,
      ),
      colored(
        new BoxGeometry(1.3, 0.14, 0.04).rotateZ(-0.6).translate(x, 3.0, z),
        yellow,
      ),
      box(0.18, 0.18, 0.1, x - 0.25, 2.3, z, RED),
      box(0.18, 0.18, 0.1, x + 0.25, 2.3, z, RED),
      colored(
        new BoxGeometry(0.07, 4.2, 0.07)
          .rotateZ(0.25 * s)
          .translate(x - 0.55 * s, 2.9, z),
        yellow,
      ),
      box(0.3, 1.0, 0.3, x, 0.5, z, [0.25, 0.25, 0.25]),
    );
  }
  return merged(parts);
}

/** All mapped street furniture, keyed by TKY1 PROP kind; each entry lists variants. */
export function createFurnitureModels(): Map<number, BufferGeometry[]> {
  const models = new Map<number, BufferGeometry[]>();
  const add = (kind: number, variants: BufferGeometry[]) =>
    models.set(
      kind,
      variants.map((geometry) => withLift(geometry, 0.12)),
    );
  add(PROP.BUS_STOP, [busStopGeometry(false), busStopGeometry(true)]);
  add(PROP.BENCH, [benchGeometry()]);
  add(PROP.BOLLARD, [bollardGeometry()]);
  add(PROP.POST_BOX, [postBoxGeometry()]);
  add(PROP.PHONE, [phoneGeometry()]);
  add(PROP.SUBWAY, [subwayGeometry()]);
  add(PROP.STATUE, [0, 1, 2].map(statueGeometry));
  add(PROP.BIKES, [bikesGeometry()]);
  add(PROP.SHRINE, [shrineGeometry()]);
  add(PROP.HYDRANT, [hydrantGeometry()]);
  add(PROP.INFO, [infoGeometry()]);
  add(PROP.TABLE, [tableGeometry()]);
  add(PROP.PLAY, [playGeometry(0), playGeometry(1)]);
  add(PROP.TORII, [toriiGeometry()]);
  add(PROP.RAIL_CROSSING, [railCrossingGeometry()]);
  return models;
}

/** The rough far-tree crown shape shared by every tree species. */
export function blobCrownGeometry(): BufferGeometry {
  const lump = (
    values: [number, number, number, number, number],
    seed: number,
  ): BufferGeometry => {
    const [cx, cy, cz, radius, squash] = values;
    const geometry = mergeVertices(
      new IcosahedronGeometry(radius, 1)
        .deleteAttribute("uv")
        .deleteAttribute("normal"),
    );
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const wobble =
        0.86 +
        0.2 *
          Math.sin(x * 21 + z * 13 + seed * 2.1) *
          Math.sin(y * 17 + x * 9 + seed) +
        0.1 * Math.sin(z * 31 + y * 23 + seed * 4.7);
      position.setXYZ(
        i,
        cx + x * wobble,
        cy + y * wobble * squash,
        cz + z * wobble,
      );
    }
    geometry.computeVertexNormals();
    return geometry.toNonIndexed();
  };
  const crown = merged(
    (
      [
        [0, 0.6, 0, 0.36, 0.95],
        [0.21, 0.52, 0.08, 0.26, 0.85],
        [-0.19, 0.55, -0.11, 0.27, 0.85],
        [0.03, 0.8, -0.04, 0.24, 0.9],
        [-0.06, 0.5, 0.22, 0.25, 0.8],
        [0.1, 0.56, -0.22, 0.23, 0.8],
      ] as [number, number, number, number, number][]
    ).map((values, index) => lump(values, index)),
  );
  const position = crown.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const t = Math.max(0, Math.min(1, (position.getY(i) - 0.25) / 0.75));
    colors[i * 3] = 0.02 + 0.046 * t;
    colors[i * 3 + 1] = 0.034 + 0.074 * t;
    colors[i * 3 + 2] = 0.011 + 0.02 * t;
  }
  crown.setAttribute("color", new BufferAttribute(colors, 3));
  return merged([
    crown,
    tube(0.035, 0.03, 0.35, 0, 0, 0, [0.25, 0.2, 0.16], 5),
  ]);
}
