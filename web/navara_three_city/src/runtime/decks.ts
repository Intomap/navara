import type { CityDeck } from "../types";

export const DECK_FLAG = 0x8000;
export const CORRIDOR_MARGIN = 16;
const FADE = 8;

export const deckOf = (code: number): number =>
  code & DECK_FLAG ? code & 0x7fff : -1;

export type DeckProjection = {
  dist: number;
  y: number;
  inside: boolean;
};

export function projectOnDeck(
  deck: CityDeck,
  x: number,
  z: number,
): DeckProjection {
  const points = deck.pts;
  const last = points.length / 3 - 1;
  let best: DeckProjection = { dist: Infinity, y: 0, inside: false };
  for (let i = 1; i <= last; i += 1) {
    const ax = points[i * 3 - 3];
    const ay = points[i * 3 - 2];
    const az = points[i * 3 - 1];
    const dx = points[i * 3] - ax;
    const dz = points[i * 3 + 2] - az;
    const raw = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1);
    const t = Math.max(0, Math.min(1, raw));
    const dist = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (dist < best.dist)
      best = {
        dist,
        y: ay + (points[i * 3 + 1] - ay) * t,
        inside: !(i === 1 && raw <= 0) && !(i === last && raw >= 1),
      };
  }
  return best;
}

export class CityDecks {
  private boxes: [number, number, number, number][];

  constructor(private decks: CityDeck[]) {
    this.boxes = decks.map((deck) => {
      let x0 = Infinity,
        x1 = -Infinity,
        z0 = Infinity,
        z1 = -Infinity;
      for (let i = 0; i < deck.pts.length; i += 3) {
        x0 = Math.min(x0, deck.pts[i]);
        x1 = Math.max(x1, deck.pts[i]);
        z0 = Math.min(z0, deck.pts[i + 2]);
        z1 = Math.max(z1, deck.pts[i + 2]);
      }
      const margin = deck.half + FADE;
      return [x0 - margin, x1 + margin, z0 - margin, z1 + margin];
    });
  }

  surface(terrain: number, x: number, z: number): number {
    let y = terrain;
    for (let i = 0; i < this.decks.length; i += 1) {
      const box = this.boxes[i];
      if (x < box[0] || x > box[1] || z < box[2] || z > box[3]) continue;
      const projection = projectOnDeck(this.decks[i], x, z);
      if (!projection.inside || projection.y <= terrain) continue;
      const width = Math.max(
        0,
        Math.min(1, 1 - (projection.dist - this.decks[i].half) / FADE),
      );
      y = Math.max(y, terrain + (projection.y - terrain) * width);
    }
    return y;
  }

  cover(terrain: number, x: number, z: number): number {
    let y = terrain;
    for (const deck of this.decks) {
      const projection = projectOnDeck(deck, x, z);
      if (
        projection.inside &&
        projection.dist <= deck.half - CORRIDOR_MARGIN + 3.5
      )
        y = Math.max(y, projection.y);
    }
    return y;
  }
}
