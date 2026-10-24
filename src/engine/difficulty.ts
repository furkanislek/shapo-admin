import type {
  Board,
  PieceSet,
  Rules,
  Placement,
  Result,
  Level,
  Cell,
  Track,
} from "./model";
import { key, placements, normalize, shapeKey } from "./geometry";
function transformation(
  piece: PieceSet["pieces"][number],
  placement: Placement,
  rules: Rules,
) {
  for (let f = 0; f < (rules.allowReflections ? 2 : 1); f++) {
    let cells = piece.cells.map(([x, y]) => [f ? -x : x, y] as Cell);
    for (
      let rotation = 0;
      rotation < (rules.allowRotations ? 4 : 1);
      rotation++
    ) {
      if (shapeKey(cells) === placement.orientationKey)
        return `${f ? "mirror" : "normal"}:${rotation}`;
      cells = normalize(cells.map(([x, y]) => [-y, x]));
    }
  }
  return "unknown";
}
export function evaluateDifficulty(
  board: Board,
  set: PieceSet,
  rules: Rules,
  fixed: Placement[],
  result: Result,
  metricsVersion = "estimate-2",
): Level["difficulty"] {
  const occupied = new Set(fixed.flatMap((p) => p.cells.map(key))),
    remainingPieces = set.pieces.filter(
      (p) => !fixed.some((q) => q.pieceId === p.id),
    );
  const initialPlacements = Object.fromEntries(
    remainingPieces.map((p) => [
      p.id,
      placements(board, p, rules).filter((p) =>
        p.cells.every((c) => !occupied.has(key(c))),
      ).length,
    ]),
  );
  const visualTransforms = remainingPieces.map((p) =>
    transformation(
      p,
      result.solutions[0].find((q) => q.pieceId === p.id)!,
      rules,
    ),
  );
  const rotationDiversity = new Set(visualTransforms).size,
    remaining = remainingPieces.length;
  const score = Math.round(
    remaining * 9 +
      Math.log2(1 + result.stats.backtracks) * 6 +
      Math.log2(1 + result.stats.nodes) * 3 +
      Math.max(0, result.stats.maxDepth - result.stats.forcedMoves) * 2 +
      (Object.values(initialPlacements).reduce(
        (n, v) => n + Math.log2(Math.max(1, v)),
        0,
      ) *
        2) /
        Math.max(1, remaining) +
      Math.max(0, rotationDiversity - 1) * 2,
  );
  if (!["estimate-1", "estimate-2"].includes(metricsVersion))
    throw Error("Bilinmeyen zorluk metrik sürümü");
  const label: Track =
    metricsVersion === "estimate-2"
      ? score < 27
        ? "baby"
        : score < 55
          ? "easy"
          : score < 140
            ? "medium"
            : score < 210
              ? "hard"
              : "expert"
      : score < 27
        ? "baby"
        : score < 39
          ? "easy"
          : score < 54
            ? "medium"
            : score < 72
              ? "hard"
              : "expert";
  return {
    label,
    estimatedScore: score,
    metricsVersion,
    metrics: {
      ...result.stats,
      initialPlacements,
      rotationDiversity,
      reflectionEnabled: rules.allowReflections,
    },
  };
}
