const HK_A = 6378388;
const HK_F = 1 / 297;
const HK_E2 = HK_F * (2 - HK_F);
const HK_EP2 = HK_E2 / (1 - HK_E2);
const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const LAT0 = ((22 + 18 / 60 + 43.68 / 3600) * Math.PI) / 180;
const LON0 = ((114 + 10 / 60 + 42.8 / 3600) * Math.PI) / 180;
const FE = 836694.05;
const FN = 819069.8;
const LOCAL_E0 = 835625;
const LOCAL_N0 = 816500;
const ARC_SECOND = Math.PI / (180 * 3600);
const DATUM_TRANSLATION: Vec3 = [-162.619, -276.959, -161.764];
const DATUM_ROTATION: Vec3 = [
  0.067753 * ARC_SECOND,
  -2.243648 * ARC_SECOND,
  -1.158828 * ARC_SECOND,
];
const DATUM_SCALE = 1 - 1.094246e-6;

type Vec3 = [number, number, number];
type Matrix3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type Geodetic = {
  longitude: number;
  latitude: number;
  height: number;
};

export type LocalGeographic = {
  longitude: number;
  latitude: number;
};

function inverseMatrix(m: Matrix3): Matrix3 {
  const determinant =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  return [
    (m[4] * m[8] - m[5] * m[7]) / determinant,
    (m[2] * m[7] - m[1] * m[8]) / determinant,
    (m[1] * m[5] - m[2] * m[4]) / determinant,
    (m[5] * m[6] - m[3] * m[8]) / determinant,
    (m[0] * m[8] - m[2] * m[6]) / determinant,
    (m[2] * m[3] - m[0] * m[5]) / determinant,
    (m[3] * m[7] - m[4] * m[6]) / determinant,
    (m[1] * m[6] - m[0] * m[7]) / determinant,
    (m[0] * m[4] - m[1] * m[3]) / determinant,
  ];
}

const HK_TO_WGS84: Matrix3 = [
  DATUM_SCALE,
  -DATUM_ROTATION[2],
  DATUM_ROTATION[1],
  DATUM_ROTATION[2],
  DATUM_SCALE,
  -DATUM_ROTATION[0],
  -DATUM_ROTATION[1],
  DATUM_ROTATION[0],
  DATUM_SCALE,
];
const WGS84_TO_HK = inverseMatrix(HK_TO_WGS84);

function applyMatrix(m: Matrix3, point: Vec3): Vec3 {
  return [
    m[0] * point[0] + m[1] * point[1] + m[2] * point[2],
    m[3] * point[0] + m[4] * point[1] + m[5] * point[2],
    m[6] * point[0] + m[7] * point[1] + m[8] * point[2],
  ];
}

function hkToWgs84(point: Vec3): Vec3 {
  const transformed = applyMatrix(HK_TO_WGS84, point);
  return [
    transformed[0] + DATUM_TRANSLATION[0],
    transformed[1] + DATUM_TRANSLATION[1],
    transformed[2] + DATUM_TRANSLATION[2],
  ];
}

function wgs84ToHk(point: Vec3): Vec3 {
  return applyMatrix(WGS84_TO_HK, [
    point[0] - DATUM_TRANSLATION[0],
    point[1] - DATUM_TRANSLATION[1],
    point[2] - DATUM_TRANSLATION[2],
  ]);
}

function geodeticToEcef(g: Geodetic, a: number, e2: number): Vec3 {
  const sin = Math.sin(g.latitude);
  const cos = Math.cos(g.latitude);
  const n = a / Math.sqrt(1 - e2 * sin * sin);
  return [
    (n + g.height) * cos * Math.cos(g.longitude),
    (n + g.height) * cos * Math.sin(g.longitude),
    (n * (1 - e2) + g.height) * sin,
  ];
}

function ecefToGeodetic(point: Vec3, a: number, e2: number): Geodetic {
  const longitude = Math.atan2(point[1], point[0]);
  const p = Math.hypot(point[0], point[1]);
  let latitude = Math.atan2(point[2], p * (1 - e2));
  for (let i = 0; i < 8; i += 1) {
    const sin = Math.sin(latitude);
    const n = a / Math.sqrt(1 - e2 * sin * sin);
    latitude = Math.atan2(point[2] + e2 * n * sin, p);
  }
  const sin = Math.sin(latitude);
  const n = a / Math.sqrt(1 - e2 * sin * sin);
  return { longitude, latitude, height: p / Math.cos(latitude) - n };
}

function meridian(lat: number): number {
  return (
    HK_A *
    ((1 - HK_E2 / 4 - (3 * HK_E2 ** 2) / 64 - (5 * HK_E2 ** 3) / 256) * lat -
      ((3 * HK_E2) / 8 + (3 * HK_E2 ** 2) / 32 + (45 * HK_E2 ** 3) / 1024) *
        Math.sin(2 * lat) +
      ((15 * HK_E2 ** 2) / 256 + (45 * HK_E2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * HK_E2 ** 3) / 3072) * Math.sin(6 * lat))
  );
}

function hkGeographicToGrid(g: LocalGeographic): { x: number; z: number } {
  const delta = g.longitude - LON0;
  const sin = Math.sin(g.latitude);
  const cos = Math.cos(g.latitude);
  const n = HK_A / Math.sqrt(1 - HK_E2 * sin * sin);
  const t = Math.tan(g.latitude) ** 2;
  const c = HK_EP2 * cos * cos;
  const a = cos * delta;
  const m = meridian(g.latitude) - meridian(LAT0);
  const easting =
    FE +
    n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * HK_EP2) * a ** 5) / 120);
  const northing =
    FN +
    m +
    n *
      Math.tan(g.latitude) *
      ((a * a) / 2 +
        ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
        ((61 - 58 * t + t * t + 600 * c - 330 * HK_EP2) * a ** 6) / 720);
  return { x: easting - LOCAL_E0, z: LOCAL_N0 - northing };
}

function gridToHkGeographic(x: number, z: number): LocalGeographic {
  const m = meridian(LAT0) + LOCAL_N0 - z - FN;
  const mu =
    m /
    (HK_A * (1 - HK_E2 / 4 - (3 * HK_E2 ** 2) / 64 - (5 * HK_E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - HK_E2)) / (1 + Math.sqrt(1 - HK_E2));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);
  const sin = Math.sin(fp);
  const cos = Math.cos(fp);
  const c1 = HK_EP2 * cos * cos;
  const t1 = Math.tan(fp) ** 2;
  const n1 = HK_A / Math.sqrt(1 - HK_E2 * sin * sin);
  const r1 = (HK_A * (1 - HK_E2)) / (1 - HK_E2 * sin * sin) ** 1.5;
  const d = (LOCAL_E0 + x - FE) / n1;
  const latitude =
    fp -
    ((n1 * Math.tan(fp)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * HK_EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * HK_EP2 - 3 * c1 * c1) *
          d ** 6) /
          720);
  const longitude =
    LON0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * HK_EP2 + 24 * t1 * t1) *
        d ** 5) /
        120) /
      cos;
  return { longitude, latitude };
}

function wgs84GeodeticToLocal(g: Geodetic): { x: number; z: number } {
  const hkEcef = wgs84ToHk(geodeticToEcef(g, WGS84_A, WGS84_E2));
  return hkGeographicToGrid(ecefToGeodetic(hkEcef, HK_A, HK_E2));
}

export function geographicToLocal(
  lng: number,
  lat: number,
): { x: number; z: number } {
  return wgs84GeodeticToLocal({
    longitude: (lng * Math.PI) / 180,
    latitude: (lat * Math.PI) / 180,
    height: 0,
  });
}

export function localToEcef(
  x: number,
  y: number,
  z: number,
): {
  ecef: Vec3;
  geographic: LocalGeographic;
} {
  const hk = gridToHkGeographic(x, z);
  const ecef = hkToWgs84(geodeticToEcef({ ...hk, height: y }, HK_A, HK_E2));
  const geographic = ecefToGeodetic(ecef, WGS84_A, WGS84_E2);
  return { ecef, geographic };
}

export function localToGeographic(x: number, z: number): LocalGeographic {
  return localToEcef(x, 0, z).geographic;
}

export function localBasisEcef(geographic: LocalGeographic): {
  east: Vec3;
  north: Vec3;
  up: Vec3;
} {
  const slon = Math.sin(geographic.longitude);
  const clon = Math.cos(geographic.longitude);
  const slat = Math.sin(geographic.latitude);
  const clat = Math.cos(geographic.latitude);
  return {
    east: [-slon, clon, 0],
    north: [-slat * clon, -slat * slon, clat],
    up: [clat * clon, clat * slon, slat],
  };
}

export function ecefToLocalPoint(
  x: number,
  y: number,
  z: number,
): {
  x: number;
  y: number;
  z: number;
} {
  const geographic = ecefToGeodetic([x, y, z], WGS84_A, WGS84_E2);
  const local = wgs84GeodeticToLocal(geographic);
  return { ...local, y: geographic.height };
}

export function ecefToLocal(
  x: number,
  y: number,
  z: number,
): { x: number; z: number } {
  const point = ecefToLocalPoint(x, y, z);
  return { x: point.x, z: point.z };
}
