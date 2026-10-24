import type { Board, PieceSet, Rules, Placement, Result } from "./model";
import {
  active,
  key,
  placements,
  preflight,
  validatePlacements,
} from "./geometry";
export function solve(
  board: Board,
  set: PieceSet,
  rules: Rules,
  fixed: Placement[] = [],
  opts: {
    nodeLimit?: number;
    timeLimit?: number;
    limit?: number;
    cancelled?: () => boolean;
    seed?: number;
  } = {},
): Result {
  preflight(board, set, rules);
  validatePlacements(board, set, rules, fixed);
  const start = performance.now(),
    stats = {
      nodes: 0,
      backtracks: 0,
      forcedMoves: 0,
      branchingPoints: 0,
      maxDepth: 0,
      elapsedMs: 0,
    };
  let status: Result["status"] = "complete",
    cut = false;
  const solutions: Placement[][] = [],
    occupied = new Set(fixed.flatMap((p) => p.cells.map(key))),
    used = new Set(fixed.map((p) => p.pieceId)),
    all = set.pieces.flatMap((p) => placements(board, p, rules));
  if (opts.seed !== undefined) {
    let v = opts.seed;
    for (let i = all.length - 1; i > 0; i--) {
      v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
      const j = v % (i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }
  }
  const cells = active(board).map(key);
  const byCell = new Map<string, Placement[]>(cells.map((c) => [c, []]));
  const byPiece = new Map<string, Placement[]>(
    set.pieces.map((p) => [p.id, []]),
  );
  for (const p of all) {
    byPiece.get(p.pieceId)!.push(p);
    for (const c of p.cells) byCell.get(key(c))!.push(p);
  }
  const valid = (p: Placement) =>
    !used.has(p.pieceId) && p.cells.every((c) => !occupied.has(key(c)));
  function search(path: Placement[]) {
    if (cut) return;
    if (opts.cancelled?.()) {
      status = "cancelled";
      cut = true;
      return;
    }
    if (stats.nodes >= (opts.nodeLimit ?? 200000)) {
      status = "node_limit";
      cut = true;
      return;
    }
    if (performance.now() - start > (opts.timeLimit ?? 15000)) {
      status = "timeout";
      cut = true;
      return;
    }
    stats.nodes++;
    stats.maxDepth = Math.max(stats.maxDepth, path.length);
    if (used.size === set.pieces.length) {
      const sol = [...fixed, ...path];
      validatePlacements(board, set, rules, sol, true);
      solutions.push(sol);
      if (solutions.length >= (opts.limit ?? 2)) cut = true;
      return;
    }
    let best: Placement[] | undefined;
    for (const c of cells)
      if (!occupied.has(c)) {
        const candidates = byCell.get(c)!.filter(valid);
        if (!best || candidates.length < best.length) best = candidates;
        if (!best.length) break;
      }
    for (const p of set.pieces)
      if (!used.has(p.id)) {
        const candidates = byPiece.get(p.id)!.filter(valid);
        if (!best || candidates.length < best.length) best = candidates;
      }
    if (!best?.length) {
      stats.backtracks++;
      return;
    }
    if (best.length === 1) stats.forcedMoves++;
    else stats.branchingPoints++;
    for (const p of best) {
      used.add(p.pieceId);
      p.cells.forEach((c) => occupied.add(key(c)));
      search([...path, p]);
      used.delete(p.pieceId);
      p.cells.forEach((c) => occupied.delete(key(c)));
      if (cut) return;
    }
  }
  search([]);
  stats.elapsedMs = performance.now() - start;
  const countIsExact = !cut,
    solutionCount = solutions.length;
  return {
    status,
    solutionCount,
    countIsExact,
    classification:
      solutionCount >= 2
        ? "multiple"
        : countIsExact
          ? solutionCount === 1
            ? "unique"
            : "unsolvable"
          : "unknown",
    solutions,
    stats,
  };
}
