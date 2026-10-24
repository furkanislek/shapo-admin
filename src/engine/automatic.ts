import {
  tracks,
  type Track,
  type Level,
  type PieceSet,
  type Catalog,
} from "./model";
import { generate, fingerprint } from "./generator";
import {
  automaticProfiles,
  createAutomaticPacking,
  type Packing,
} from "./packing";
export { automaticProfiles, createAutomaticPacking } from "./packing";
export type AutomaticProgress = {
  attempt: number;
  accepted: number;
  requested: number;
  track: Track;
  counts: Record<Track, number>;
  rejected: Record<string, number>;
  elapsed: number;
};
export function runAutomatic(
  plan: Partial<Record<Track, number>>,
  seed: string,
  existing: Catalog,
  onLevel: (level: Level, set: PieceSet) => void,
  onProgress: (p: AutomaticProgress) => void,
) {
  for (const t of tracks) {
    const n = plan[t] ?? 0;
    if (!Number.isInteger(n) || n < 0 || n > 1000)
      throw Error(`${t}: bölüm adedi 0–1000 arasında olmalı`);
  }
  const requested = tracks.reduce((n, t) => n + (plan[t] ?? 0), 0);
  if (!requested) throw Error("En az bir bölüm isteyin");
  const start = performance.now(),
    seen = new Set(tracks.flatMap((t) => existing.tracks[t]).map(fingerprint)),
    counts: Record<Track, number> = {
      baby: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    },
    rejected: Record<string, number> = {};
  let accepted = 0,
    attempt = 0;
  const setBudget = Math.max(0, 1000 - existing.pieceSets.length),
    poolSize = Math.min(
      30,
      Math.floor(
        (setBudget - (plan.hard ?? 0) - (plan.expert ?? 0)) /
          Math.max(
            1,
            tracks.filter(
              (t) => t !== "hard" && t !== "expert" && (plan[t] ?? 0) > 0,
            ).length,
          ),
      ),
    );
  if (poolSize < 1)
    throw Error(
      "Otomatik üretim için set kapasitesi dolu; ayrı katalog oluşturun.",
    );
  for (const track of tracks) {
    const target = plan[track] ?? 0;
    if (!target) continue;
    const pool: Packing[] = [];
    const profile = automaticProfiles[track];
    for (
      let i = 0;
      i < Math.max(100, target * 40) && counts[track] < target;
      i++
    ) {
      attempt++;
      try {
        const index = track === "hard" || track === "expert" ? i : i % poolSize;
        if (!pool[index])
          pool[index] = createAutomaticPacking(
            track,
            `${seed}:${track}:set:${index}`,
          );
        const packing = pool[index],
          remaining =
            profile.remaining[
              Math.floor(i / poolSize) % profile.remaining.length
            ];
        const level = generate(
          packing.board,
          packing.set,
          {
            seed: `${seed}:${track}:${i}`,
            method: "automatic-2",
            packingSeed: `${seed}:${track}:set:${index}`,
            fixedCount: packing.set.pieces.length - remaining,
            nodeLimit: 100000,
            attemptLimit: Math.min(10000, Math.max(100, target * 40)),
            timeLimit: 3000,
            policy:
              track === "hard" || track === "expert" ? "any-valid" : "unique",
            track,
          },
          packing.tiling,
        );
        const f = fingerprint(level);
        if (seen.has(f)) throw Error("Yinelenen bölüm");
        seen.add(f);
        onLevel(level, packing.set);
        accepted++;
        counts[track]++;
      } catch (e) {
        const reason = (e as Error).message;
        rejected[reason] = (rejected[reason] ?? 0) + 1;
      }
      onProgress({
        attempt,
        accepted,
        requested,
        track,
        counts: { ...counts },
        rejected: { ...rejected },
        elapsed: performance.now() - start,
      });
    }
  }
  return {
    attempt,
    accepted,
    requested,
    counts,
    rejected,
    elapsed: performance.now() - start,
  };
}
