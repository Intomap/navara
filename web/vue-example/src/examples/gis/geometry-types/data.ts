import type { FeatureCollection, Position } from "geojson";

/**
 * One GeoJSON FeatureCollection with the two source geometry kinds that
 * `geometryTypes` derives from, laid out as a west-to-east pair:
 *
 * - LineString — a zigzag route
 * - Polygon with a hole — a square ring, so the hole boundary derives too
 *
 * The stage is the Azusa river valley near Kamikochi (Northern Japan Alps) —
 * an almost featureless part of the grayscale basemap, so the derived
 * boundary polylines and vertex points are the only things that draw the eye.
 */

/** Center of the exhibit pair — just north of the Azusa river. */
const CENTER = { lng: 137.6495, lat: 36.2445 };
/** Distance between the two exhibit centers, in degrees of longitude (~300 m). */
const SPACING = 0.0034;
/** Exhibits span CENTER.lat ± HALF_NS (~240 m north-south in total). */
const HALF_NS = 0.0011;
/** Half-width of the polygon, scaled so it renders square at this latitude. */
const HALF_EW = 0.0013;

/** Longitude of the exhibit at `index` (0 = west, 1 = east). */
const exhibitLng = (index: number): number =>
  CENTER.lng + (index - 0.5) * SPACING;

/** A square ring around (`centerLng`, CENTER.lat) with the given half-widths. */
const squareRing = (
  centerLng: number,
  halfEw: number,
  halfNs: number,
): Position[] => [
  [centerLng - halfEw, CENTER.lat - halfNs],
  [centerLng + halfEw, CENTER.lat - halfNs],
  [centerLng + halfEw, CENTER.lat + halfNs],
  [centerLng - halfEw, CENTER.lat + halfNs],
  [centerLng - halfEw, CENTER.lat - halfNs],
];

export const features: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Route" },
      geometry: {
        type: "LineString",
        coordinates: [-1, -0.5, 0, 0.5, 1].map((step, i) => [
          exhibitLng(0) + (i % 2 === 0 ? -0.0005 : 0.0005),
          CENTER.lat + step * HALF_NS,
        ]),
      },
    },
    {
      type: "Feature",
      properties: { name: "Area" },
      geometry: {
        type: "Polygon",
        coordinates: [
          squareRing(exhibitLng(1), HALF_EW, HALF_NS),
          squareRing(exhibitLng(1), HALF_EW * 0.4, HALF_NS * 0.4),
        ],
      },
    },
  ],
};
