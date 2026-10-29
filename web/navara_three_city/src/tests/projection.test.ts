import { describe, expect, it } from "vitest";

import {
  ecefToLocal,
  geographicToLocal,
  localToEcef,
  localToGeographic,
} from "../runtime/projection";

const REFERENCES = [
  { x: 0, z: 0, longitude: 114.170634833928, latitude: 22.287395489807 },
  { x: -1125, z: 1500, longitude: 114.159719754538, latitude: 22.273848750751 },
  { x: 1875, z: -1500, longitude: 114.188830536607, latitude: 22.300941097728 },
  {
    x: 844.05,
    z: -1069.8,
    longitude: 114.17882542801,
    latitude: 22.297056557854,
  },
];

describe("Hong Kong CRS", () => {
  it("matches PROJ EPSG:2326 to WGS84 reference points", () => {
    for (const reference of REFERENCES) {
      const geographic = localToGeographic(reference.x, reference.z);
      const longitude = (geographic.longitude * 180) / Math.PI;
      const latitude = (geographic.latitude * 180) / Math.PI;
      const errorMetres = Math.hypot(
        (longitude - reference.longitude) *
          111320 *
          Math.cos((reference.latitude * Math.PI) / 180),
        (latitude - reference.latitude) * 111320,
      );
      expect(errorMetres).toBeLessThan(0.05);
    }
  });

  it("round-trips WGS84 geographic and ECEF positions", () => {
    for (const reference of REFERENCES) {
      const local = geographicToLocal(reference.longitude, reference.latitude);
      expect(local.x).toBeCloseTo(reference.x, 3);
      expect(local.z).toBeCloseTo(reference.z, 3);
      const projected = localToEcef(reference.x, 120, reference.z);
      const roundTrip = ecefToLocal(...projected.ecef);
      expect(roundTrip.x).toBeCloseTo(reference.x, 3);
      expect(roundTrip.z).toBeCloseTo(reference.z, 3);
    }
  });

  it("matches the manifest origin instead of applying a manual offset", () => {
    const origin = localToGeographic(0, 0);
    expect((origin.longitude * 180) / Math.PI).toBeCloseTo(114.170634833928, 8);
    expect((origin.latitude * 180) / Math.PI).toBeCloseTo(22.2873954898065, 8);
  });
});
