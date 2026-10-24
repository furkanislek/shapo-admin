import type { Board, Cell, Piece, PieceSet, Placement } from "./model";
import {
  active,
  connected,
  key,
  normalize,
  orientations,
  shapeKey,
  validateSet,
  validatePlacements,
} from "./geometry";
import { hash } from "./random";
import { colors } from "./demo";
export function partitionSilhouette(
  board: Board,
  seed: string,
  pieceCount: number,
) {
  const all = active(board),
    rules = {
      allowRotations: true,
      allowReflections: false,
      solutionPolicy: "any-valid" as const,
    };
  if (
    !connected(all) ||
    !Number.isInteger(pieceCount) ||
    pieceCount < 8 ||
    pieceCount > 30 ||
    all.length < pieceCount * 3
  )
    throw Error("Silüet alanı veya parça adedi uygun değil");
  let state = hash(seed);
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  for (let attempt = 0; attempt < 450; attempt++) {
    const base = Math.floor(all.length / pieceCount),
      sizes = Array.from({ length: pieceCount }, (_, i) =>
        Math.max(3, base + (i % 5) - 2),
      );
    let difference = all.length - sizes.reduce((n, v) => n + v, 0);
    for (let i = 0; difference; i = (i + 1) % pieceCount) {
      if (difference > 0) {
        sizes[i]++;
        difference--;
      } else if (sizes[i] > 3) {
        sizes[i]--;
        difference++;
      }
    }
    sizes.sort((a, b) => a - b);
    let left = [...all];
    const pieces: Piece[] = [],
      tiling: Placement[] = [],
      seen = new Set<string>();
    for (const size of sizes) {
      let chosen: Cell[] | undefined,
        geometry = "";
      for (let trial = 0; trial < 100; trial++) {
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
        if (region.length !== size) continue;
        const take = new Set(region.map(key)),
          remaining = left.filter((c) => !take.has(key(c)));
        if (remaining.length && !connected(remaining)) continue;
        const normalized = normalize(region),
          k = orientations(
            { id: "check", symbol: "?", color: "#000000", cells: normalized },
            rules,
          )
            .map(([k]) => k)
            .sort()[0];
        if (seen.has(k)) continue;
        chosen = region;
        geometry = k;
        break;
      }
      if (!chosen) break;
      seen.add(geometry);
      const index = pieces.length,
        id = `P${String(index + 1).padStart(2, "0")}`,
        symbol =
          index < 26 ? String.fromCharCode(65 + index) : String(index + 1),
        cells = normalize(chosen),
        origin: Cell = [
          Math.min(...chosen.map((c) => c[0])),
          Math.min(...chosen.map((c) => c[1])),
        ];
      pieces.push({ id, symbol, color: colors[index % colors.length], cells });
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
    const set: PieceSet = {
      id: `silhouette-${hash(JSON.stringify([board.mask, pieces.map((p) => p.cells)])).toString(16)}`,
      version: 1,
      allowRotations: true,
      allowReflections: false,
      pieces,
    };
    validateSet(set, rules);
    validatePlacements(board, set, rules, tiling, true);
    return { board, set, tiling };
  }
  throw Error(`${board.shapeLabel}: özgün parça seti türetilemedi`);
}
