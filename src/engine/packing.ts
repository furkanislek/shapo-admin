import type { Board, Cell, PieceSet, Placement, Track } from "./model";
import {
  active,
  connected,
  key,
  normalize,
  shapeKey,
  validateSet,
  validatePlacements,
} from "./geometry";
import { colors } from "./demo";
import { hash } from "./random";
export const legacyAutomaticProfiles: Record<
  Track,
  { width: number; height: number; sizes: number[]; remaining: number[] }
> = {
  baby: { width: 4, height: 4, sizes: [2, 3, 4, 7], remaining: [1] },
  easy: { width: 5, height: 4, sizes: [2, 3, 4, 5, 6], remaining: [2] },
  medium: { width: 6, height: 5, sizes: [2, 3, 4, 5, 7, 9], remaining: [3] },
  hard: {
    width: 7,
    height: 5,
    sizes: [2, 3, 4, 5, 6, 7, 8],
    remaining: [4, 5],
  },
  expert: {
    width: 7,
    height: 6,
    sizes: [3, 4, 4, 5, 5, 6, 7, 8],
    remaining: [6, 5],
  },
};
export const automaticProfiles: typeof legacyAutomaticProfiles = {
  baby: { width: 4, height: 4, sizes: [2, 3, 4, 7], remaining: [1] },
  easy: { width: 6, height: 5, sizes: [2, 3, 4, 5, 7, 9], remaining: [3] },
  medium: {
    width: 7,
    height: 6,
    sizes: [3, 4, 4, 5, 5, 6, 7, 8],
    remaining: [6, 5],
  },
  hard: {
    width: 10,
    height: 8,
    sizes: [4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 8, 9],
    remaining: [14],
  },
  expert: {
    width: 16,
    height: 12,
    sizes: [
      6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10,
      10,
    ],
    remaining: [24],
  },
};
export type Packing = { board: Board; set: PieceSet; tiling: Placement[] };
export function createAutomaticPacking(
  track: Track,
  seed: string,
  method = "automatic-2",
): Packing {
  const profile = (
      method === "automatic-1" ? legacyAutomaticProfiles : automaticProfiles
    )[track],
    board: Board = {
      width: profile.width,
      height: profile.height,
      mask: Array(profile.height).fill("1".repeat(profile.width)),
    };
  let state = hash(seed);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let attempt = 0; attempt < 1000; attempt++) {
    let left = active(board);
    const pieces: PieceSet["pieces"] = [],
      tiling: Placement[] = [];
    for (const size of profile.sizes) {
      let chosen: Cell[] | undefined;
      for (let trial = 0; trial < 80; trial++) {
        const region: Cell[] = [left[random() % left.length]];
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
        const take = new Set(region.map(key)),
          remaining = left.filter((c) => !take.has(key(c)));
        if (
          region.length === size &&
          (!remaining.length || connected(remaining))
        ) {
          chosen = region;
          break;
        }
      }
      if (!chosen) break;
      const id = String.fromCharCode(65 + pieces.length),
        cells = normalize(chosen),
        origin: Cell = [
          Math.min(...chosen.map((c) => c[0])),
          Math.min(...chosen.map((c) => c[1])),
        ];
      pieces.push({
        id,
        symbol: id,
        color: colors[pieces.length % colors.length],
        cells,
      });
      tiling.push({
        pieceId: id,
        orientationKey: shapeKey(cells),
        origin,
        cells: cells.map(([x, y]) => [x + origin[0], y + origin[1]]),
      });
      const take = new Set(chosen.map(key));
      left = left.filter((c) => !take.has(key(c)));
    }
    if (left.length) continue;
    const geometry = pieces.map((p) => p.cells),
      set: PieceSet = {
        id: `auto-${method === "automatic-1" ? "" : "v2-"}${track}-${hash(JSON.stringify(geometry)).toString(16)}`,
        version: 1,
        allowRotations: true,
        allowReflections: false,
        pieces,
      };
    try {
      validateSet(set, {
        allowRotations: true,
        allowReflections: false,
        solutionPolicy: "unique",
      });
      validatePlacements(
        board,
        set,
        {
          allowRotations: true,
          allowReflections: false,
          solutionPolicy: "unique",
        },
        tiling,
        true,
      );
      return { board, set, tiling };
    } catch {}
  }
  throw Error("Otomatik parça seti tasarlanamadı; başka tohum deneyin");
}
