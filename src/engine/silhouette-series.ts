import {
  silhouetteShapes,
  silhouetteBoard,
  silhouetteResolutions,
} from "./silhouette-shapes";
import { partitionSilhouette } from "./silhouette-packing";
import { certifyTilings } from "./witnesses";
import { evaluateDifficulty } from "./difficulty";
import { generate, fingerprint } from "./generator";
import { type Catalog, type Level, type PieceSet, type Track } from "./model";
export const SILHOUETTE_SEED = "recognizable-silhouettes-1";
export function runSilhouetteSeries(
  existing: Catalog,
  onLevel: (l: Level, s: PieceSet) => void,
  onProgress: (report: {
    attempt: number;
    accepted: number;
    requested: number;
    track: Track;
    counts: Record<Track, number>;
    rejected: Record<string, number>;
    elapsed: number;
  }) => void,
) {
  if (existing.pieceSets.length + 100 > 1000)
    throw Error(
      "100 silüet seti için katalog kapasitesi yetersiz; önce kataloğu yedekleyip yeni çalışma açın.",
    );
  const start = performance.now(),
    counts: Record<Track, number> = {
      baby: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    },
    rejected: Record<string, number> = {},
    seen = new Set(Object.values(existing.tracks).flat().map(fingerprint));
  let attempt = 0,
    accepted = 0;
  for (const shape of silhouetteShapes)
    for (const [index, resolution] of silhouetteResolutions.entries()) {
      const board = silhouetteBoard(shape.id, resolution),
        area = board.mask.join("").replaceAll("0", "").length,
        requestedPieces = [8, 12, 18, 24, 30][index];
      let pieceCount = Math.max(
        8,
        Math.min(requestedPieces, Math.floor(area / 5.5)),
      );
      let track: Track = "medium";
      for (let retry = 0; retry < 6; retry++) {
        attempt++;
        try {
          const packingSeed = `${SILHOUETTE_SEED}:${shape.id}:${resolution}:${retry}`,
            packing = partitionSilhouette(board, packingSeed, pieceCount),
            rules = {
              allowRotations: true,
              allowReflections: false,
              solutionPolicy: "any-valid" as const,
            },
            proof = certifyTilings(board, packing.set, rules, packing.tiling),
            difficulty = evaluateDifficulty(
              board,
              packing.set,
              rules,
              [],
              proof,
            );
          track = difficulty.label;
          if (track === "baby" || track === "easy")
            throw Error("Orta zorluğun altında aday");
          const l = generate(
              board,
              packing.set,
              {
                method: "silhouette-1",
                packingSeed,
                pieceCount,
                seed: packingSeed,
                fixedCount: 0,
                nodeLimit: 100000,
                attemptLimit: 6,
                timeLimit: 15000,
                policy: "any-valid",
                track,
              },
              packing.tiling,
            ),
            f = fingerprint(l);
          if (seen.has(f)) {
            rejected["Katalogda zaten var"] =
              (rejected["Katalogda zaten var"] ?? 0) + 1;
            break;
          }
          seen.add(f);
          onLevel(l, packing.set);
          accepted++;
          counts[track]++;
          break;
        } catch (e) {
          const reason = (e as Error).message;
          rejected[reason] = (rejected[reason] ?? 0) + 1;
          if (retry === 3) pieceCount = Math.max(8, pieceCount - 1);
        }
      }
      onProgress({
        attempt,
        accepted,
        requested: 100,
        track,
        counts: { ...counts },
        rejected: { ...rejected },
        elapsed: performance.now() - start,
      });
    }
  return {
    attempt,
    accepted,
    requested: 100,
    counts,
    rejected,
    elapsed: performance.now() - start,
  };
}
