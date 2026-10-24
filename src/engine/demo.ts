import type { Board, Cell, PieceSet, Rules } from "./model";
import {
  active,
  connected,
  key,
  normalize,
  shapeKey,
  validateSet,
} from "./geometry";
export const defaultRules: Rules = {
  allowRotations: true,
  allowReflections: false,
  solutionPolicy: "unique",
};
export const colors = [
  "#849979",
  "#d4a05c",
  "#a18eb3",
  "#cb7d69",
  "#729da9",
  "#c4b45f",
  "#ae8e79",
];
export const boards: Record<string, Board> = {
  rectangle: { width: 6, height: 5, mask: Array(5).fill("111111") },
  cat: {
    width: 7,
    height: 7,
    mask: [
      "0100010",
      "0111110",
      "0111110",
      "0011100",
      "0011101",
      "0111111",
      "0111110",
    ],
    templateId: "cat",
    shapeLabel: "Kedi",
  },
  dog: {
    width: 9,
    height: 6,
    mask: [
      "010000000",
      "111100001",
      "111111111",
      "011111110",
      "001111110",
      "001100110",
    ],
    templateId: "dog",
    shapeLabel: "Köpek",
  },
  heart: {
    width: 8,
    height: 7,
    mask: [
      "01100110",
      "11111111",
      "11111111",
      "11111111",
      "01111110",
      "00111100",
      "00011000",
    ],
    templateId: "heart",
    shapeLabel: "Kalp",
  },
};
export function deriveSet(board: Board, id: string): PieceSet {
  const cells = active(board);
  let seed = 314159;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (let attempt = 0; attempt < 3000; attempt++) {
    let left = [...cells];
    const pieces: PieceSet["pieces"] = [];
    let failed = false;
    for (const size of [2, 3, 4, 5, 7, cells.length - 21]) {
      if (size < 1) {
        failed = true;
        break;
      }
      let region: Cell[] = [left[random() % left.length]];
      while (region.length < size) {
        const have = new Set(region.map(key));
        const adjacent = left.filter(
          (c) =>
            !have.has(key(c)) &&
            region.some(
              (q) => Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]) === 1,
            ),
        );
        if (!adjacent.length) break;
        region.push(adjacent[random() % adjacent.length]);
      }
      const take = new Set(region.map(key));
      const remaining = left.filter((c) => !take.has(key(c)));
      if (
        region.length !== size ||
        (remaining.length && !connected(remaining))
      ) {
        failed = true;
        break;
      }
      pieces.push({
        id: String.fromCharCode(65 + pieces.length),
        symbol: String.fromCharCode(65 + pieces.length),
        color: colors[pieces.length],
        cells: normalize(region),
      });
      left = remaining;
    }
    if (!failed && !left.length) {
      const set = {
        id,
        version: 1,
        allowRotations: true,
        allowReflections: false,
        pieces,
      };
      try {
        validateSet(set, defaultRules);
        return set;
      } catch {}
    }
  }
  throw Error(`Şablon için parça seti türetilemedi: ${id}`);
}
export const demoSets = Object.entries(boards).map(([id, b]) =>
  deriveSet(b, `studio-${id}`),
);
export const boardFingerprint = (b: Board) =>
  `${b.width}x${b.height}:${b.mask.join("/")}`;
export { shapeKey };
