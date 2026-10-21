import ThreeView, {
  Color,
  vector3ToGeodetic,
  type PickedFeature,
} from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { OverlayPlugin, TileJsonPlugin } from "@navaramap/three-plugins";
import { createApp, reactive } from "vue";
import { Vector3 } from "three";

import type { ExampleMeta } from "../../sections";
import type { ExampleContext, ExampleRunResult } from "../../types";
import InfoCard, { type InfoCardState } from "./InfoCard.vue";

export const meta: ExampleMeta = {
  section: "interaction",
  order: 1,
  title: { en: "Feature selection", ja: "地物選択" },
  description: {
    en: "Click a feature to highlight it and read its coordinates and properties.",
    ja: "地物をクリックしてハイライトし、座標と属性を読み取る。",
  },
  docs: "three/api/picking",
};

const BASE = new Color().setStyle("#0091ff");
// Slightly brightened BASE, applied while a feature is hovered.
const HOVER = new Color().setStyle("#4db3ff");
const HIGHLIGHT = new Color().setStyle("#ff6b2c");

export async function run(
  _ctx: ExampleContext,
): Promise<ExampleRunResult> {
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#cccccc"),
  });

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  const overlay = new OverlayPlugin({ maxDistance: 20_000_000 });
  view.addPlugin(overlay);

  await view.init();

  view.setCamera({
    lng: -0.1235,
    lat: 51.5075,
    height: 34_000,
    heading: 0,
    pitch: -84,
    roll: 0,
  });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  const places = await tilejson.addSource({
    type: "vector-tile",
    url: "https://papers.reearth.land/protomaps/tilejson.json",
  });
  const placesLayer = view.addLayer({
    type: "vector",
    source: places,
    sourceLayers: ["places"],
    point: {
      size: 12,
      sizeInMeters: false,
      color: BASE,
    },
  });

  // Vue-rendered floating info card, anchored via the OverlayPlugin.
  const cardState = reactive<InfoCardState>({
    visible: false,
    x: 0,
    y: 0,
    name: "",
    kind: "",
    rows: [],
  });
  const cardHost = document.createElement("div");
  document.body.appendChild(cardHost);
  const cardApp = createApp(InfoCard, { state: cardState });
  cardApp.mount(cardHost);

  const featureKey = (
    properties: Record<string, unknown> | undefined,
  ): string | null => {
    const name = properties?.["name"];
    if (name == null) return null;
    return [name, properties?.["kind"], properties?.["kind_detail"]].join("-");
  };

  let selectedKey: string | null = null;
  let hoveredKey: string | null = null;

  placesLayer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const key = featureKey(properties);
        return {
          color:
            key === selectedKey ? HIGHLIGHT : key === hoveredKey ? HOVER : BASE,
        };
      },
      { filters: ["name", "kind", "kind_detail"] },
    );
  });

  view.on("featureHover", (info) => {
    const key = info ? featureKey(info.properties) : null;
    if (key === hoveredKey) return;
    hoveredKey = key;
    view.canvas.style.cursor = key ? "pointer" : "";
    placesLayer.forceUpdate();
  });

  let lastPick: PickedFeature | null | undefined = null;
  view.on("featureClick", (info) => {
    lastPick = info;
  });

  view.on("click", (event) => {
    const previous = selectedKey;

    if (lastPick?.properties && featureKey(lastPick.properties) != null) {
      selectedKey = featureKey(lastPick.properties);
      const { lat, lng } = vector3ToGeodetic(
        new Vector3(event.map.x, event.map.y, event.map.z),
      );
      const lngLat = { lng, lat };

      const properties = lastPick.properties;
      const population = Number(properties["population"]);
      cardState.name = (properties["name"] as string) ?? "Unnamed place";
      cardState.kind =
        (properties["pmap:kind"] as string) ??
        (properties["kind"] as string) ??
        "place";
      cardState.rows = [
        { label: "Longitude", value: `${lngLat.lng.toFixed(5)}°` },
        { label: "Latitude", value: `${lngLat.lat.toFixed(5)}°` },
        ...(population > 0
          ? [{ label: "Population", value: population.toLocaleString() }]
          : []),
      ];
      overlay.setPositions([{ id: "picked", ...lngLat, alt: 0 }]);
    } else {
      selectedKey = null;
      cardState.visible = false;
      overlay.setPositions([]);
    }

    if (previous !== selectedKey) placesLayer.forceUpdate();
  });

  overlay.onUpdate(({ projected }) => {
    const pos = projected.get("picked");
    if (pos) {
      // Offset the card up and to the right of the anchored point.
      cardState.x = pos.x + 14;
      cardState.y = pos.y - 12;
      cardState.visible = true;
    } else {
      cardState.visible = false;
    }
  });

  view.attribution?.add([
    {
      attribution: "© OpenStreetMap contributors, © Protomaps",
      attributionUrl: "https://protomaps.com",
    },
  ]);

  return {
    view,
    dispose: () => {
      cardApp.unmount();
      cardHost.remove();
    },
  };
}
