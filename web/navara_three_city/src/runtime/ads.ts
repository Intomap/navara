import type { CitySignData } from "@navaramap/worker";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

import type { CityUniforms } from "../materials/programs";

const COLS = 8;
const ROWS = 4;
const SIZE = 512;
const WIDE = 24;
const TALL = 8;
const FONT =
  '"PingFang HK", "PingFang TC", "Hiragino Sans CNS", "Heiti TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const SHOP = [
  "茶餐廳",
  "燒臘",
  "點心",
  "雲吞麵",
  "涼茶",
  "藥行",
  "電器",
  "金行",
  "鐘錶",
  "找換",
  "麻雀",
  "卡拉OK",
  "夜總會",
  "桑拿",
  "按摩",
  "賓館",
  "酒樓",
  "海鮮",
  "髮型屋",
  "大押",
  "珠寶玉器",
  "香燭",
  "蛇羹",
  "打冷",
  "冰室",
  "燒味",
  "糖水",
  "麻雀娛樂",
  "芬蘭浴",
  "足浴",
  "士多",
  "藥房",
  "電器城",
  "旅行社",
  "海味",
  "燒鵝",
];
const FANCY = [
  "大金龍",
  "鴻運",
  "富貴",
  "發財",
  "龍鳳",
  "恭喜發財",
  "金玉滿堂",
  "大展鴻圖",
  "生意興隆",
  "出入平安",
];
const LATIN = [
  "HONG KONG",
  "KOWLOON",
  "NEON",
  "SEAFOOD",
  "MAHJONG",
  "SAUNA",
  "HOTEL",
  "PHARMACY",
  "EXCHANGE",
  "JEWELLERY",
  "NOODLES",
  "KARAOKE",
  "TAILOR",
  "WATCH",
  "MASSAGE",
  "PAWN",
  "TEA HOUSE",
  "DIM SUM",
  "ROAST",
  "BAKERY",
];
const NEON = [
  "#ff3d9a",
  "#22e6ff",
  "#ffe23d",
  "#4dff88",
  "#ff8a2b",
  "#b56bff",
  "#ff3838",
  "#f4f8ff",
];
const NIGHT = [
  "#0b0620",
  "#06142b",
  "#1a0626",
  "#04181a",
  "#200a0a",
  "#0a0a18",
];
type Point = readonly [number, number];
type Picture = (g: CanvasRenderingContext2D, a: string, b: string) => void;

function tube(g: CanvasRenderingContext2D, colour: string, width = 0.05): void {
  g.strokeStyle = colour;
  g.fillStyle = colour;
  g.shadowColor = colour;
  g.shadowBlur = 26;
  g.lineWidth = width;
  g.lineCap = "round";
  g.lineJoin = "round";
}
function line(
  g: CanvasRenderingContext2D,
  points: Point[],
  close = false,
): void {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
  g.stroke();
}
function ring(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill = false,
): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) g.fill();
  else g.stroke();
}
const PICTURES: Picture[] = [
  (g, a, b) => {
    tube(g, a);
    line(
      g,
      [
        [-0.44, 0.34],
        [0.44, 0.34],
        [0.44, 0.06],
        [-0.44, 0.06],
      ],
      true,
    );
    line(
      g,
      [
        [-0.44, 0.02],
        [0.44, 0.02],
        [0.44, -0.24],
        [-0.44, -0.24],
      ],
      true,
    );
    line(g, [
      [-0.2, 0.34],
      [-0.2, 0.48],
    ]);
    line(g, [
      [0.2, 0.34],
      [0.2, 0.48],
    ]);
    tube(g, b, 0.03);
    for (let k = 0; k < 5; k++)
      line(g, [
        [-0.32 + k * 0.16, 0.3],
        [-0.32 + k * 0.16, 0.1],
      ]);
    for (let k = 0; k < 5; k++)
      line(g, [
        [-0.32 + k * 0.16, -0.02],
        [-0.32 + k * 0.16, -0.2],
      ]);
    tube(g, "#ffe23d", 0.03);
    ring(g, -0.26, -0.3, 0.055);
    ring(g, 0.26, -0.3, 0.055);
  },
  (g, a, b) => {
    tube(g, a);
    line(
      g,
      [
        [-0.48, 0.14],
        [0.48, 0.16],
        [0.34, -0.3],
        [-0.34, -0.3],
      ],
      true,
    );
    line(
      g,
      [
        [-0.42, 0.14],
        [-0.42, 0.3],
        [0.42, 0.32],
      ],
      true,
    );
    tube(g, b, 0.04);
    ring(g, -0.12, 0.06, 0.075);
    ring(g, 0.12, 0.07, 0.075);
    line(g, [
      [-0.12, 0.14],
      [-0.12, 0.3],
    ]);
    line(g, [
      [0.12, 0.15],
      [0.12, 0.32],
    ]);
    tube(g, "#f4f8ff", 0.028);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.34 + k * 0.2, 0.1],
        [-0.34 + k * 0.2, -0.04],
      ]);
    for (let k = 0; k < 3; k++)
      line(g, [
        [-0.5 - k * 0.05, -0.36 - k * 0.04],
        [-0.28 - k * 0.05, -0.36 - k * 0.04],
      ]);
  },
  (g, a, b) => {
    tube(g, a);
    line(
      g,
      [
        [-0.46, 0.16],
        [0.46, 0.16],
        [0.3, 0.32],
        [-0.3, 0.32],
      ],
      true,
    );
    line(g, [
      [-0.46, 0.16],
      [-0.34, 0.4],
    ]);
    line(g, [
      [0.46, 0.16],
      [0.34, 0.4],
    ]);
    tube(g, b, 0.035);
    line(g, [
      [-0.06, 0.4],
      [-0.06, 0.02],
    ]);
    for (const s of [-1, 1])
      line(g, [
        [-0.06, 0.34],
        [s * 0.42, 0.14],
      ]);
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++)
        line(g, [
          [s * (0.16 + k * 0.09), 0.3 - k * 0.05],
          [s * (0.16 + k * 0.09), 0.14 - k * 0.03],
        ]);
    tube(g, "#f4f8ff", 0.026);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.36 + k * 0.24, 0.06],
        [-0.36 + k * 0.24, -0.06],
      ]);
  },
  (g, a, b) => {
    tube(g, a);
    const buildings: [number, number, number][] = [
      [-0.46, 0.1, 0.34],
      [-0.32, 0.11, 0.52],
      [-0.16, 0.1, 0.42],
      [0.02, 0.12, 0.66],
      [0.2, 0.1, 0.5],
      [0.34, 0.11, 0.6],
      [0.48, 0.1, 0.4],
    ];
    for (const [x, w, h] of buildings) {
      line(
        g,
        [
          [x - w / 2, -0.3],
          [x + w / 2, -0.3],
          [x + w / 2, -0.3 + h],
          [x - w / 2, -0.3 + h],
        ],
        true,
      );
      line(g, [
        [x - w / 2, -0.3 + h],
        [x, -0.3 + h + 0.06],
        [x + w / 2, -0.3 + h],
      ]);
    }
    tube(g, b, 0.03);
    for (let k = 0; k < 9; k++)
      line(g, [
        [-0.42 + k * 0.11, -0.16],
        [-0.42 + k * 0.11, -0.06],
      ]);
    tube(g, "#ffe23d", 0.03);
    for (let k = 0; k < 5; k++)
      line(g, [
        [-0.52 - k * 0.03, -0.36],
        [-0.3 - k * 0.03, -0.36],
      ]);
  },
  (g, a, b) => {
    tube(g, a, 0.035);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.44 + k * 0.3, -0.44],
        [-0.44 + k * 0.3, 0.44],
      ]);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.44, -0.36 + k * 0.28],
        [0.46, -0.36 + k * 0.28],
      ]);
    tube(g, b, 0.03);
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++)
        line(g, [
          [s * 0.44 - k * 0.3 * s, -0.44 + k * 0.3],
          [s * 0.14 - k * 0.3 * s, -0.14 + k * 0.3],
        ]);
    tube(g, "#ffe23d", 0.03);
    for (let k = 0; k < 3; k++) ring(g, -0.3 + k * 0.3, 0.12, 0.03, true);
  },
  (g, a, b) => {
    tube(g, a);
    g.beginPath();
    g.ellipse(0, 0.06, 0.44, 0.2, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(0, 0.06, 0.44, 0, Math.PI);
    g.stroke();
    line(g, [
      [-0.4, -0.06],
      [0.4, -0.06],
    ]);
    line(g, [
      [-0.3, -0.22],
      [0.3, -0.22],
    ]);
    tube(g, b, 0.035);
    for (const [x, y] of [
      [-0.2, 0.1],
      [0.06, 0.12],
      [0.24, 0.05],
    ] as Point[]) {
      ring(g, x, y, 0.1);
      line(g, [
        [x - 0.07, y + 0.07],
        [x, y + 0.15],
        [x + 0.07, y + 0.07],
      ]);
    }
    tube(g, "#f4f8ff", 0.026);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(-0.24 + k * 0.24, -0.3);
      g.bezierCurveTo(
        -0.18 + k * 0.24,
        -0.4,
        -0.3 + k * 0.24,
        -0.44,
        -0.22 + k * 0.24,
        -0.52,
      );
      g.stroke();
    }
  },
  (g, a, b) => {
    tube(g, a);
    line(g, [
      [-0.5, 0.44],
      [0.5, 0.44],
    ]);
    line(g, [
      [-0.5, 0.44],
      [-0.5, -0.5],
    ]);
    line(g, [
      [0.5, 0.44],
      [0.5, -0.5],
    ]);
    for (const x of [-0.22, 0.2]) {
      line(g, [
        [x, 0.44],
        [x, 0.3],
      ]);
      g.beginPath();
      g.ellipse(x, 0.06, 0.15, 0.24, 0, 0, Math.PI * 2);
      g.stroke();
      line(g, [
        [x + 0.12, 0.2],
        [x + 0.3, 0.28],
      ]);
      line(g, [
        [x + 0.12, 0.06],
        [x + 0.32, 0.06],
      ]);
    }
    tube(g, b, 0.03);
    for (const x of [-0.22, 0.2])
      for (let k = 0; k < 4; k++)
        line(g, [
          [x - 0.08, -0.08 - k * 0.07],
          [x + 0.08, -0.08 - k * 0.07],
        ]);
    tube(g, "#ffe23d", 0.03);
    g.beginPath();
    g.ellipse(0.02, -0.38, 0.16, 0.08, 0, 0, Math.PI * 2);
    g.stroke();
  },
  (g, a, b) => {
    tube(g, a, 0.055);
    line(
      g,
      [
        [-0.3, -0.44],
        [0.3, -0.44],
        [0.3, 0.44],
        [-0.3, 0.44],
      ],
      true,
    );
    line(g, [
      [-0.3, 0.3],
      [0.3, 0.3],
    ]);
    tube(g, b, 0.04);
    ring(g, 0, 0, 0.14);
    ring(g, 0, 0, 0.05, true);
    for (let k = 0; k < 8; k++) {
      const t = (k * Math.PI) / 4;
      line(g, [
        [Math.cos(t) * 0.16, Math.sin(t) * 0.16],
        [Math.cos(t) * 0.24, Math.sin(t) * 0.24],
      ]);
    }
    tube(g, "#ffe23d", 0.04);
    line(g, [
      [-0.16, 0.38],
      [0.16, 0.38],
    ]);
  },
  (g, a, b) => {
    tube(g, a);
    line(
      g,
      [
        [-0.3, 0.14],
        [-0.24, -0.24],
        [0.24, -0.24],
        [0.3, 0.14],
      ],
      true,
    );
    g.beginPath();
    g.ellipse(0, 0.14, 0.3, 0.07, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -0.3, 0.42, 0.08, 0, 0, Math.PI * 2);
    g.stroke();
    line(g, [
      [0.3, 0.06],
      [0.46, -0.02],
      [0.46, -0.14],
      [0.28, -0.16],
    ]);
    tube(g, b, 0.03);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(-0.12 + k * 0.12, 0.24);
      g.bezierCurveTo(
        -0.06 + k * 0.12,
        0.34,
        -0.18 + k * 0.12,
        0.4,
        -0.1 + k * 0.12,
        0.5,
      );
      g.stroke();
    }
    tube(g, "#f4f8ff", 0.026);
    line(g, [
      [-0.2, 0.02],
      [0.2, 0.02],
    ]);
  },
  (g, a, b) => {
    tube(g, a);
    ring(g, 0, 0.02, 0.36);
    line(g, [
      [-0.3, 0.2],
      [-0.42, 0.42],
      [-0.2, 0.34],
    ]);
    line(g, [
      [0.3, 0.2],
      [0.42, 0.42],
      [0.2, 0.34],
    ]);
    line(g, [
      [-0.36, -0.14],
      [-0.2, -0.28],
      [0, -0.32],
      [0.2, -0.28],
      [0.36, -0.14],
    ]);
    tube(g, b, 0.04);
    for (const s of [-1, 1]) ring(g, s * 0.15, 0.06, 0.09);
    tube(g, "#ffe23d", 0.04);
    ring(g, -0.15, 0.06, 0.035, true);
    ring(g, 0.15, 0.06, 0.035, true);
    line(g, [
      [-0.1, -0.16],
      [0, -0.1],
      [0.1, -0.16],
    ]);
    tube(g, "#ff3838", 0.035);
    for (let k = 0; k < 7; k++) {
      const t = Math.PI + (k * Math.PI) / 6;
      line(g, [
        [Math.cos(t) * 0.34, Math.sin(t) * 0.34 + 0.02],
        [Math.cos(t) * 0.5, Math.sin(t) * 0.5 + 0.02],
      ]);
    }
  },
  (g, a, b) => {
    tube(g, a);
    line(
      g,
      [
        [-0.4, 0.24],
        [-0.2, -0.06],
        [0.2, -0.06],
        [0.4, 0.24],
      ],
      true,
    );
    line(
      g,
      [
        [-0.4, 0.24],
        [-0.24, 0.34],
        [0.24, 0.34],
        [0.4, 0.24],
      ],
      true,
    );
    line(g, [
      [-0.2, -0.06],
      [-0.24, 0.34],
    ]);
    line(g, [
      [0.2, -0.06],
      [0.24, 0.34],
    ]);
    tube(g, b, 0.04);
    for (const [x, y] of [
      [-0.34, -0.28],
      [0, -0.36],
      [0.34, -0.28],
    ] as Point[]) {
      ring(g, x, y, 0.13);
      line(g, [
        [x - 0.05, y],
        [x + 0.05, y],
      ]);
      line(g, [
        [x, y - 0.05],
        [x, y + 0.05],
      ]);
    }
    tube(g, "#ffe23d", 0.03);
    for (let k = 0; k < 5; k++)
      line(g, [
        [-0.4 + k * 0.2, 0.2],
        [-0.4 + k * 0.2, 0.3],
      ]);
  },
  (g, a, b) => {
    tube(g, a);
    g.beginPath();
    g.ellipse(0, -0.04, 0.42, 0.34, 0, 0, Math.PI * 2);
    g.stroke();
    tube(g, b, 0.04);
    for (let k = 0; k < 6; k++) {
      const t = (k * Math.PI * 2) / 6 - Math.PI / 2;
      line(g, [
        [0, 0.3],
        [Math.cos(t) * 0.24, 0.3 - Math.sin(t) * 0.1 - 0.06],
      ]);
    }
    ring(g, 0, 0.3, 0.04, true);
    tube(g, "#f4f8ff", 0.026);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(-0.2 + k * 0.2, 0.44);
      g.bezierCurveTo(
        -0.14 + k * 0.2,
        0.52,
        -0.26 + k * 0.2,
        0.54,
        -0.18 + k * 0.2,
        0.62,
      );
      g.stroke();
    }
  },
  (g, a, b) => {
    tube(g, a);
    g.beginPath();
    g.ellipse(-0.04, 0, 0.3, 0.2, 0, 0, Math.PI * 2);
    g.stroke();
    line(g, [
      [0.26, 0],
      [0.48, -0.24],
    ]);
    line(g, [
      [0.26, 0],
      [0.48, 0.24],
    ]);
    line(g, [
      [0.48, -0.24],
      [0.48, 0.24],
    ]);
    line(g, [
      [-0.14, -0.2],
      [-0.06, -0.36],
      [0.06, -0.34],
    ]);
    line(g, [
      [-0.14, 0.2],
      [-0.06, 0.36],
      [0.06, 0.34],
    ]);
    tube(g, b, 0.035);
    ring(g, -0.2, 0.03, 0.05, true);
    tube(g, "#f4f8ff", 0.026);
    for (const s of [-1, 1])
      line(g, [
        [0, s * 0.06],
        [0.12, s * 0.12],
      ]);
  },
  (g, a, b) => {
    tube(g, a);
    line(g, [
      [-0.4, -0.44],
      [-0.4, 0.3],
    ]);
    line(g, [
      [-0.4, 0.3],
      [0.48, 0.3],
    ]);
    line(g, [
      [0.3, 0.3],
      [0.3, 0.14],
    ]);
    line(g, [
      [-0.4, 0.12],
      [0.24, 0.3],
    ]);
    line(g, [
      [-0.4, 0.12],
      [0, -0.44],
    ]);
    line(g, [
      [-0.4, -0.44],
      [0.06, -0.44],
    ]);
    for (let k = 0; k < 5; k++)
      line(g, [
        [-0.4 + k * 0.18, -0.44],
        [-0.4 + k * 0.18, -0.2],
      ]);
    tube(g, b, 0.035);
    line(g, [
      [0.3, 0.14],
      [0.3, -0.06],
    ]);
    line(
      g,
      [
        [0.14, -0.06],
        [0.46, -0.06],
        [0.46, -0.26],
        [0.14, -0.26],
      ],
      true,
    );
    tube(g, "#ffe23d", 0.03);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.4 + k * 0.2, -0.4],
        [-0.4 + k * 0.2, -0.24],
      ]);
  },
  (g, a, b) => {
    tube(g, a, 0.04);
    const boards: [number, number, number, number][] = [
      [-0.34, 0.1, 0.16, 0.44],
      [-0.06, 0.24, 0.14, 0.36],
      [0.16, 0.06, 0.16, 0.5],
      [0.36, 0.22, 0.14, 0.32],
    ];
    for (const [x, y, w, h] of boards)
      line(
        g,
        [
          [x - w / 2, y - h / 2],
          [x + w / 2, y - h / 2],
          [x + w / 2, y + h / 2],
          [x - w / 2, y + h / 2],
        ],
        true,
      );
    line(g, [
      [-0.5, 0.44],
      [0.5, 0.44],
    ]);
    tube(g, b, 0.03);
    for (const [x, y, h] of [
      [-0.34, 0.1, 0.44],
      [0.16, 0.06, 0.5],
    ] as [number, number, number][])
      for (let k = 0; k < 3; k++)
        line(g, [
          [x - 0.03, y - h / 2 + 0.1 + k * 0.12],
          [x + 0.03, y - h / 2 + 0.1 + k * 0.12],
        ]);
    tube(g, "#ffe23d", 0.03);
    for (let k = 0; k < 4; k++)
      line(g, [
        [-0.44, -0.32],
        [-0.44 + k * 0.3, -0.32],
      ]);
  },
];

function createAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * SIZE;
  canvas.height = ROWS * SIZE;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Cannot create advertisement atlas");
  let seed = 11;
  const rnd = (): number =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pick = (items: string[]): string =>
    items[Math.floor(rnd() * items.length)];
  const cell = (i: number, draw: () => void): void => {
    g.save();
    g.translate((i % COLS) * SIZE, Math.floor(i / COLS) * SIZE);
    g.beginPath();
    g.rect(0, 0, SIZE, SIZE);
    g.clip();
    draw();
    g.restore();
  };
  const backdrop = (w: number): void => {
    const grad = g.createLinearGradient(0, 0, w, SIZE);
    grad.addColorStop(0, pick(NIGHT));
    grad.addColorStop(1, pick(NIGHT));
    g.shadowBlur = 0;
    g.fillStyle = grad;
    g.fillRect(0, 0, w, SIZE);
  };
  const words = (
    text: string,
    x: number,
    y: number,
    size: number,
    colour: string,
    vertical: boolean,
  ): void => {
    g.font = `900 ${size}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = colour;
    g.shadowBlur = 30;
    g.fillStyle = "#ffffff";
    g.strokeStyle = colour;
    g.lineWidth = size * 0.09;
    const chars = vertical ? [...text] : [text];
    chars.forEach((ch, k) => {
      const yy = y + (k - (chars.length - 1) / 2) * size * 1.06;
      g.strokeText(ch, x, yy);
      g.fillText(ch, x, yy);
    });
  };
  for (let i = 0; i < WIDE; i++)
    cell(i, () => {
      const a = NEON[i % NEON.length],
        b = NEON[(i * 3 + 2) % NEON.length],
        w = NEON[(i * 5 + 4) % NEON.length],
        left = i % 2 === 0;
      backdrop(SIZE);
      g.lineWidth = 10;
      g.strokeStyle = w;
      g.shadowColor = w;
      g.shadowBlur = 24;
      g.strokeRect(22, 22, SIZE - 44, SIZE - 44);
      g.save();
      g.translate(SIZE * (left ? 0.32 : 0.68), SIZE * 0.5);
      g.scale(SIZE * 0.5, SIZE * 0.74);
      PICTURES[i % PICTURES.length](g, a, b);
      g.restore();
      if (i % 3 !== 2) {
        const t = pick(i % 3 ? SHOP : FANCY);
        words(
          t,
          SIZE * (left ? 0.78 : 0.22),
          SIZE * 0.5,
          Math.min(SIZE * 0.19, (SIZE * 0.8) / [...t].length),
          w,
          true,
        );
      } else {
        const t = pick(LATIN);
        g.save();
        g.translate(SIZE * (left ? 0.74 : 0.26), SIZE * 0.5);
        g.rotate(-Math.PI / 2);
        words(
          t,
          0,
          0,
          Math.min(SIZE * 0.16, (SIZE * 0.8) / (t.length * 0.62)),
          w,
          false,
        );
        g.restore();
      }
    });
  for (let i = 0; i < TALL; i++)
    cell(WIDE + i, () => {
      const a = NEON[(i * 3) % NEON.length],
        b = NEON[(i * 3 + 5) % NEON.length],
        w = SIZE / 3;
      backdrop(w);
      g.lineWidth = 8;
      g.strokeStyle = a;
      g.shadowColor = a;
      g.shadowBlur = 22;
      g.strokeRect(12, 12, w - 24, SIZE - 24);
      const t = pick(i % 2 ? SHOP : FANCY);
      words(
        t,
        w / 2,
        SIZE * 0.4,
        Math.min(w * 0.62, (SIZE * 0.62) / [...t].length),
        a,
        true,
      );
      g.save();
      g.translate(w / 2, SIZE * 0.84);
      g.scale(w * 0.7, SIZE * 0.2);
      PICTURES[(i * 5 + 1) % PICTURES.length](g, b, a);
      g.restore();
    });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

let sharedAtlas: { texture: CanvasTexture; references: number } | undefined;
function acquireAtlas(): CanvasTexture {
  if (!sharedAtlas) sharedAtlas = { texture: createAtlas(), references: 0 };
  sharedAtlas.references++;
  return sharedAtlas.texture;
}
function releaseAtlas(): void {
  if (!sharedAtlas || --sharedAtlas.references > 0) return;
  sharedAtlas.texture.dispose();
  sharedAtlas = undefined;
}

export function buildAds(
  signs: CitySignData[],
  cityUp: Vector3,
  uniforms: CityUniforms,
): { group: Group; dispose: () => void } {
  const atlas = acquireAtlas();
  const material = new MeshStandardMaterial({ map: atlas, roughness: 0.5 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aAd; varying vec3 vAd; varying vec2 vBoard;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAd=aAd; vBoard=uv;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
uniform float uNight, uTime;
varying vec3 vAd;
varying vec2 vBoard;
vec3 gAd;
vec3 poster(float index, vec2 at) {
  float i=floor(index+0.5);
  vec2 cell=vec2(mod(i,${COLS}.0),${ROWS - 1}.0-floor(i/${COLS}.0));
  return texture2D(map,(cell+clamp(at,0.004,0.996))/vec2(${COLS}.0,${ROWS}.0)).rgb;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `
if(vAd.y>1.5) gAd=poster(vAd.x,vec2(vBoard.x/3.0,vBoard.y));
else if(vAd.y>0.5) {
  float t=uTime*0.16+vAd.z*9.0, wipe=smoothstep(0.86,1.0,fract(t));
  float now=mod(vAd.x+floor(t),${WIDE}.0), next=mod(now+1.0,${WIDE}.0);
  gAd=mix(poster(now,vBoard),poster(next,vBoard),step(vBoard.x,wipe));
  vec2 led=fract(vBoard*vec2(160.0,90.0));
  float fine=max(fwidth(vBoard.x*160.0),fwidth(vBoard.y*90.0));
  gAd*=mix(0.72+0.5*step(0.22,led.x)*step(0.22,led.y),1.0,smoothstep(0.3,1.0,fine));
} else gAd=poster(vAd.x,vBoard);
diffuseColor.rgb*=mix(gAd*0.55+0.03,gAd,uNight);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=gAd*(vAd.y>0.5&&vAd.y<1.5?1.0+0.9*uNight:0.1+2.2*uNight);",
      );
  };
  material.customProgramCacheKey = () => "navara-city-ads-v1";
  const frameMaterial = new MeshStandardMaterial({
    color: 0x2a2c2f,
    roughness: 0.6,
    metalness: 0.4,
    side: DoubleSide,
  });
  const positions: number[] = [],
    uv: number[] = [],
    ads: number[] = [],
    frame: number[] = [];
  for (const sign of signs) {
    if (sign.style < 3 || sign.style > 6) continue;
    const center = new Vector3().fromArray(sign.position),
      normal = new Vector3().fromArray(sign.normal).normalize();
    const right = new Vector3().crossVectors(cityUp, normal).normalize(),
      up = new Vector3().crossVectors(normal, right).normalize(),
      out = 0.3;
    const point = (side: number, vertical: number, offset = out): Vector3 =>
      center
        .clone()
        .addScaledVector(right, (side * sign.width) / 2)
        .addScaledVector(up, (vertical - 0.5) * sign.height)
        .addScaledVector(normal, offset);
    const corners = [
      point(-1, 0),
      point(1, 0),
      point(1, 1),
      point(-1, 0),
      point(1, 1),
      point(-1, 1),
    ];
    for (const corner of corners) positions.push(...corner.toArray());
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    const seed = Math.abs(center.x * 0.37 + center.z * 0.91) % 1,
      kind = sign.style === 4 ? 1 : sign.style === 6 ? 2 : 0;
    for (let i = 0; i < 6; i++) ads.push(sign.color, kind, seed);
    const back = [
      point(-1.03, -0.03, out - 0.08),
      point(1.03, -0.03, out - 0.08),
      point(1.03, 1.03, out - 0.08),
      point(-1.03, 1.03, out - 0.08),
    ];
    for (const i of [0, 1, 2, 0, 2, 3]) frame.push(...back[i].toArray());
    if (sign.style === 5)
      for (const side of [-0.8, 0, 0.8]) {
        const a = point(side - 0.03, 0, out - 0.1),
          b = point(side + 0.03, 0, out - 0.1),
          al = a.clone().addScaledVector(up, -1.6),
          bl = b.clone().addScaledVector(up, -1.6);
        for (const p of [al, bl, b, al, b, a]) frame.push(...p.toArray());
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("aAd", new Float32BufferAttribute(ads, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const frameGeometry = new BufferGeometry();
  frameGeometry.setAttribute("position", new Float32BufferAttribute(frame, 3));
  frameGeometry.computeVertexNormals();
  frameGeometry.computeBoundingSphere();
  const group = new Group();
  group.name = "ads";
  group.add(
    new Mesh(frameGeometry, frameMaterial),
    new Mesh(geometry, material),
  );
  let disposed = false;
  return {
    group,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      frameGeometry.dispose();
      material.dispose();
      frameMaterial.dispose();
      releaseAtlas();
      group.clear();
    },
  };
}
