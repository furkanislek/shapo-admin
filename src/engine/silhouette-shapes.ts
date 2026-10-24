import type { Board } from "./model";
import { active, connected } from "./geometry";
type Point = [number, number];
const ellipse = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (
  x: number,
  y: number,
  a: number,
  b: number,
  c: number,
  d: number,
) => x >= a && x <= c && y >= b && y <= d;
function polygon(x: number, y: number, p: Point[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [a, b] = p[i],
      [c, d] = p[j];
    if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a)
      inside = !inside;
  }
  return inside;
}
const star: Point[] = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5,
    r = i % 2 ? 5.3 : 11.8;
  return [12 + Math.cos(a) * r, 12 + Math.sin(a) * r];
});
export const silhouetteShapes: {
  id: string;
  label: string;
  inside: (x: number, y: number) => boolean;
}[] = [
  {
    id: "heart",
    label: "Kalp",
    inside: (x, y) =>
      polygon(x, y, [
        [12, 6],
        [9, 3],
        [6, 2],
        [3, 3],
        [1, 6],
        [1, 9],
        [3, 13],
        [12, 23],
        [21, 13],
        [23, 9],
        [23, 6],
        [21, 3],
        [18, 2],
        [15, 3],
      ]),
  },
  {
    id: "cat",
    label: "Kedi",
    inside: (x, y) =>
      ellipse(x, y, 12, 8, 7, 6) ||
      polygon(x, y, [
        [5, 7],
        [4, 0],
        [11, 5],
      ]) ||
      polygon(x, y, [
        [13, 5],
        [20, 0],
        [19, 8],
      ]) ||
      ellipse(x, y, 12, 17, 6, 6) ||
      rect(x, y, 5, 21, 18, 23) ||
      polygon(x, y, [
        [16, 18],
        [21, 18],
        [21, 12],
        [24, 12],
        [24, 22],
        [16, 23],
      ]),
  },
  {
    id: "rabbit",
    label: "Tavşan",
    inside: (x, y) =>
      ellipse(x, y, 8, 5, 2.3, 5) ||
      ellipse(x, y, 15, 5, 2.3, 5) ||
      ellipse(x, y, 12, 11, 5, 4) ||
      ellipse(x, y, 12, 18, 7, 6) ||
      rect(x, y, 5, 21, 19, 24),
  },
  {
    id: "dog",
    label: "Köpek",
    inside: (x, y) =>
      ellipse(x, y, 5, 7, 4, 4) ||
      rect(x, y, 0, 7, 6, 10) ||
      rect(x, y, 6, 9, 20, 18) ||
      rect(x, y, 7, 16, 10, 24) ||
      rect(x, y, 17, 16, 20, 24) ||
      polygon(x, y, [
        [18, 12],
        [23, 4],
        [24, 6],
        [23, 14],
        [18, 17],
      ]),
  },
  {
    id: "fish",
    label: "Balık",
    inside: (x, y) =>
      ellipse(x, y, 10, 12, 8.5, 6) ||
      polygon(x, y, [
        [15, 12],
        [24, 3],
        [24, 21],
      ]) ||
      polygon(x, y, [
        [7, 8],
        [13, 2],
        [16, 9],
      ]) ||
      polygon(x, y, [
        [8, 16],
        [13, 22],
        [16, 16],
      ]),
  },
  {
    id: "butterfly",
    label: "Kelebek",
    inside: (x, y) =>
      ellipse(x, y, 5, 7, 5, 7) ||
      ellipse(x, y, 19, 7, 5, 7) ||
      ellipse(x, y, 6, 19, 4.8, 4.6) ||
      ellipse(x, y, 18, 19, 4.8, 4.6) ||
      rect(x, y, 8, 7, 16, 13) ||
      rect(x, y, 10.7, 3, 13.3, 23),
  },
  {
    id: "turtle",
    label: "Kaplumbağa",
    inside: (x, y) =>
      ellipse(x, y, 12, 13, 8, 7) ||
      ellipse(x, y, 12, 3.5, 3, 4) ||
      ellipse(x, y, 3, 10, 3, 2.5) ||
      ellipse(x, y, 21, 10, 3, 2.5) ||
      ellipse(x, y, 6, 20, 3, 3) ||
      ellipse(x, y, 18, 20, 3, 3) ||
      polygon(x, y, [
        [10, 18],
        [14, 18],
        [12, 24],
      ]),
  },
  {
    id: "duck",
    label: "Ördek",
    inside: (x, y) =>
      ellipse(x, y, 12, 16, 9, 6) ||
      rect(x, y, 7, 7, 13, 16) ||
      ellipse(x, y, 10, 6, 4, 4) ||
      polygon(x, y, [
        [12, 4],
        [20, 7],
        [12, 10],
      ]) ||
      polygon(x, y, [
        [5, 15],
        [0, 8],
        [1, 19],
        [7, 20],
      ]),
  },
  {
    id: "whale",
    label: "Balina",
    inside: (x, y) =>
      ellipse(x, y, 10, 15, 9.5, 6) ||
      polygon(x, y, [
        [15, 13],
        [24, 5],
        [24, 14],
        [20, 18],
        [15, 20],
      ]) ||
      rect(x, y, 7, 3, 10, 12) ||
      ellipse(x, y, 6, 3, 4, 2) ||
      ellipse(x, y, 12, 3, 4, 2),
  },
  {
    id: "penguin",
    label: "Penguen",
    inside: (x, y) =>
      ellipse(x, y, 12, 14, 7, 9) ||
      ellipse(x, y, 12, 6, 5, 5) ||
      polygon(x, y, [
        [7, 9],
        [0, 19],
        [7, 17],
      ]) ||
      polygon(x, y, [
        [17, 9],
        [24, 19],
        [17, 17],
      ]) ||
      rect(x, y, 5, 21, 11, 24) ||
      rect(x, y, 13, 21, 19, 24) ||
      polygon(x, y, [
        [15, 5],
        [20, 7],
        [15, 9],
      ]),
  },
  {
    id: "pine",
    label: "Çam ağacı",
    inside: (x, y) =>
      polygon(x, y, [
        [12, 0],
        [19, 8],
        [16, 8],
        [22, 15],
        [18, 15],
        [24, 21],
        [0, 21],
        [6, 15],
        [2, 15],
        [8, 8],
        [5, 8],
      ]) || rect(x, y, 10, 18, 14, 24),
  },
  {
    id: "tree",
    label: "Ağaç",
    inside: (x, y) =>
      ellipse(x, y, 7, 10, 6, 6) ||
      ellipse(x, y, 17, 10, 6, 6) ||
      ellipse(x, y, 12, 6, 7, 6) ||
      polygon(x, y, [
        [10, 12],
        [14, 12],
        [15, 24],
        [9, 24],
      ]),
  },
  {
    id: "mushroom",
    label: "Mantar",
    inside: (x, y) =>
      (ellipse(x, y, 12, 12, 12, 11) && y <= 13) ||
      polygon(x, y, [
        [9, 11],
        [15, 11],
        [17, 24],
        [7, 24],
      ]),
  },
  {
    id: "flower",
    label: "Çiçek",
    inside: (x, y) =>
      Array.from(
        { length: 5 },
        (_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2,
      ).some((a) =>
        ellipse(x, y, 12 + Math.cos(a) * 5.8, 9 + Math.sin(a) * 5.8, 3.2, 3.2),
      ) ||
      ellipse(x, y, 12, 9, 4, 4) ||
      rect(x, y, 11, 9, 13, 24) ||
      ellipse(x, y, 7, 18, 5.5, 2.3) ||
      ellipse(x, y, 17, 21, 5.5, 2.3),
  },
  {
    id: "rocket",
    label: "Roket",
    inside: (x, y) =>
      polygon(x, y, [
        [12, 0],
        [18, 7],
        [18, 16],
        [23, 23],
        [16, 20],
        [12, 24],
        [8, 20],
        [1, 23],
        [6, 16],
        [6, 7],
      ]) && !ellipse(x, y, 12, 10, 2.3, 2.8),
  },
  {
    id: "house",
    label: "Ev",
    inside: (x, y) =>
      (polygon(x, y, [
        [0, 10],
        [12, 0],
        [24, 10],
      ]) ||
        rect(x, y, 4, 9, 20, 24) ||
        rect(x, y, 17, 2, 20, 10)) &&
      !rect(x, y, 10, 17, 14, 24),
  },
  {
    id: "crown",
    label: "Taç",
    inside: (x, y) =>
      polygon(x, y, [
        [1, 2],
        [7, 10],
        [12, 0],
        [17, 10],
        [23, 2],
        [20, 23],
        [4, 23],
      ]),
  },
  { id: "star", label: "Yıldız", inside: (x, y) => polygon(x, y, star) },
  {
    id: "bear",
    label: "Ayı",
    inside: (x, y) =>
      ellipse(x, y, 12, 14, 10, 10) ||
      ellipse(x, y, 4, 4, 4, 4) ||
      ellipse(x, y, 20, 4, 4, 4),
  },
  {
    id: "teapot",
    label: "Çaydanlık",
    inside: (x, y) =>
      (ellipse(x, y, 11, 15, 8, 7) ||
        rect(x, y, 6, 7, 16, 10) ||
        ellipse(x, y, 11, 5.5, 2, 2) ||
        ellipse(x, y, 20, 14, 4, 6) ||
        polygon(x, y, [
          [6, 12],
          [0, 5],
          [1, 16],
          [6, 20],
        ])) &&
      !(ellipse(x, y, 20, 14, 2, 3.5) && x > 17.5),
  },
];
export function silhouetteBoard(shapeId: string, resolution: number): Board {
  const shape = silhouetteShapes.find((s) => s.id === shapeId);
  if (!shape) throw Error("Bilinmeyen silüet");
  const coverage = (x: number, y: number) => {
    let n = 0;
    for (const dx of [0.2, 0.5, 0.8])
      for (const dy of [0.2, 0.5, 0.8])
        if (
          shape.inside(
            ((x + dx) / resolution) * 24,
            ((y + dy) / resolution) * 24,
          )
        )
          n++;
    return n;
  };
  const grid = Array.from({ length: resolution }, (_, y) =>
    Array.from({ length: resolution }, (_, x) => (coverage(x, y) >= 4 ? 1 : 0)),
  );
  // Resolve diagonal-only contacts according to the original vector's cell coverage.
  for (let y = 0; y < resolution - 1; y++)
    for (let x = 0; x < resolution - 1; x++) {
      const a = grid[y][x],
        b = grid[y][x + 1],
        c = grid[y + 1][x],
        d = grid[y + 1][x + 1];
      if (a && d && !b && !c) {
        if (coverage(x + 1, y) >= coverage(x, y + 1)) grid[y][x + 1] = 1;
        else grid[y + 1][x] = 1;
      }
      if (b && c && !a && !d) {
        if (coverage(x, y) >= coverage(x + 1, y + 1)) grid[y][x] = 1;
        else grid[y + 1][x + 1] = 1;
      }
    }
  let board: Board = {
    width: resolution,
    height: resolution,
    mask: grid.map((r) => r.join("")),
    templateId: `silhouette-${shape.id}-${resolution}`,
    shapeLabel: `${shape.label} · ${resolution}`,
  };
  const cells = active(board);
  if (!connected(cells))
    throw Error(`${shape.label} ${resolution}: silüet bağlı değil`);
  const x0 = Math.min(...cells.map((c) => c[0])),
    x1 = Math.max(...cells.map((c) => c[0])),
    y0 = Math.min(...cells.map((c) => c[1])),
    y1 = Math.max(...cells.map((c) => c[1]));
  board = {
    ...board,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
    mask: board.mask.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1)),
  };
  return board;
}

export const silhouetteResolutions = [16, 17, 18, 19, 20];
