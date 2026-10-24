import type { Board, PieceSet, Rules, Placement, Result, Cell } from "./model";
import { validatePlacements, normalize, shapeKey } from "./geometry";
export function certifyTilings(
  board: Board,
  set: PieceSet,
  rules: Rules,
  reference: Placement[],
): Result {
  const start = performance.now();
  validatePlacements(board, set, rules, reference, true);
  const rotated = reference.map((p) => {
    const absolute = p.cells.map(
        ([x, y]) => [board.width - 1 - x, board.height - 1 - y] as Cell,
      ),
      origin: Cell = [
        Math.min(...absolute.map((c) => c[0])),
        Math.min(...absolute.map((c) => c[1])),
      ],
      cells = normalize(absolute);
    return {
      pieceId: p.pieceId,
      orientationKey: shapeKey(cells),
      origin,
      cells: cells.map(([x, y]) => [x + origin[0], y + origin[1]] as Cell),
    };
  });
  let secondValid = true;
  try {
    validatePlacements(board, set, rules, rotated, true);
  } catch {
    secondValid = false;
  }
  const identity = (s: Placement[]) =>
    JSON.stringify(
      s
        .map((p) => [p.pieceId, p.cells])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    );
  const multiple = secondValid && identity(reference) !== identity(rotated);
  return {
    status: "complete",
    classification: multiple ? "multiple" : "unknown",
    solutionCount: multiple ? 2 : 1,
    countIsExact: false,
    solutions: multiple ? [reference, rotated] : [reference],
    stats: {
      nodes: 0,
      backtracks: 0,
      forcedMoves: 0,
      branchingPoints: 0,
      maxDepth: 0,
      elapsedMs: performance.now() - start,
    },
  };
}
