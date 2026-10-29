import {
  CanvasTexture,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Texture,
} from "three";

export const DECAL_COLS = 4;
export const DECAL_ROWS = 3;
const CELL_W = 256;
const CELL_H = 512;

export function createDecalTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = DECAL_COLS * CELL_W;
  canvas.height = DECAL_ROWS * CELL_H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas2D is required for city decals");
  const cell = (
    variant: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ) => {
    context.save();
    context.translate(
      (variant % DECAL_COLS) * CELL_W,
      Math.floor(variant / DECAL_COLS) * CELL_H,
    );
    context.beginPath();
    context.rect(0, 0, CELL_W, CELL_H);
    context.clip();
    draw(context);
    context.restore();
  };
  const arrow = (through: boolean, turn: number) => () => {
    context.scale(CELL_W / 1.7, CELL_H / 5);
    context.fillStyle = context.strokeStyle = "#fff";
    context.lineWidth = 0.17;
    context.lineCap = "butt";
    context.lineJoin = "round";
    const x = turn === 0 ? 0.85 : turn < 0 ? 1.15 : 0.55;
    const head = (
      tx: number,
      ty: number,
      dx: number,
      dy: number,
      len: number,
      width: number,
    ) => {
      context.beginPath();
      context.moveTo(tx, ty);
      context.lineTo(tx - dx * len - dy * width, ty - dy * len + dx * width);
      context.lineTo(tx - dx * len + dy * width, ty - dy * len - dx * width);
      context.closePath();
      context.fill();
    };
    if (through) {
      context.beginPath();
      context.moveTo(x, 4.9);
      context.lineTo(x, 1.7);
      context.stroke();
      head(x, 0.1, 0, -1, 1.7, 0.33);
    }
    if (turn) {
      const y = through ? 2.9 : 1.9;
      const ex = x + turn * 0.25;
      context.beginPath();
      context.moveTo(x, 4.9);
      context.lineTo(x, y + 0.5);
      context.quadraticCurveTo(x, y, ex, y - 0.25);
      context.stroke();
      head(x + turn * 0.9, y - 0.95, turn * 0.68, -0.73, 1.05, 0.3);
    }
  };
  cell(0, arrow(true, 0));
  cell(1, arrow(false, -1));
  cell(2, arrow(false, 1));
  cell(3, arrow(true, -1));
  cell(4, arrow(true, 1));
  const font = (px: number) =>
    `900 ${px}px "Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
  const fit = (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => {
    context.save();
    context.font = font(200);
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = color;
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    context.translate(x + width / 2, y + height);
    context.scale(width / textWidth, height / textHeight);
    context.fillText(text, 0, -metrics.actualBoundingBoxDescent);
    context.restore();
  };
  cell(5, () =>
    [..."止まれ"].forEach((character, index) =>
      fit(character, 14, 10 + index * 168, CELL_W - 28, 150, "#fff"),
    ),
  );
  for (const [variant, text] of [
    [6, "20"],
    [7, "30"],
    [8, "40"],
    [9, "50"],
    [10, "60"],
  ] as [number, string][]) {
    cell(variant, () =>
      [...text].forEach((character, index) =>
        fit(character, 10 + index * 124, 12, 112, CELL_H - 24, "#f2a31b"),
      ),
    );
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createDecalMaterial(texture: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -10,
  });
}
