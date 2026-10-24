import { runSilhouetteSeries } from "./engine/silhouette-series";
import { certifyTilings } from "./engine/witnesses";
import { tracks, type Track, type Level } from "./engine/model";
import { runAutomatic } from "./engine/automatic";
import { generate, fingerprint } from "./engine/generator";
import { validateCatalog } from "./engine/catalog";
import { preflight } from "./engine/geometry";
import { solve } from "./engine/solver";
self.onmessage = ({ data }) => {
  try {
    if (data.type === "silhouette-series") {
      let last = 0;
      const report = runSilhouetteSeries(
        data.catalog,
        (level, set) => postMessage({ type: "automatic-level", level, set }),
        (p) => {
          if (performance.now() - last > 120 || p.accepted === 100) {
            postMessage({ type: "automatic-progress", report: p });
            last = performance.now();
          }
        },
      );
      postMessage({ type: "automatic-done", report, silhouettes: true });
      return;
    }
    if (data.type === "upgrade-difficulty") {
      const previous = Object.fromEntries(
        tracks.map((t) => [
          t,
          data.catalog.tracks[t].filter(
            (l: Level) =>
              l.pieceSetId.startsWith("auto-") &&
              l.generation.method !== "automatic-2",
          ),
        ]),
      ) as Record<Track, Level[]>;
      const plan = Object.fromEntries(
        tracks.map((t) => [t, previous[t].length]),
      );
      const indexes = { baby: 0, easy: 0, medium: 0, hard: 0, expert: 0 };
      let last = 0;
      const report = runAutomatic(
        plan,
        data.seed,
        data.catalog,
        (level, set) => {
          const t = level.difficulty.label,
            old = previous[t][indexes[t]++];
          postMessage({
            type: "automatic-level",
            set,
            replaceId: old.id,
            level: {
              ...level,
              id: old.id,
              revision: old.revision + 1,
              order: old.order,
              revisionHistory: [
                ...(old.revisionHistory ?? []),
                { ...old, revisionHistory: undefined },
              ],
            },
          });
        },
        (p) => {
          if (performance.now() - last > 120 || p.accepted === p.requested) {
            postMessage({ type: "automatic-progress", report: p });
            last = performance.now();
          }
        },
      );
      postMessage({ type: "automatic-done", report, upgraded: true });
      return;
    }
    if (data.type === "automatic") {
      let last = 0;
      const report = runAutomatic(
        data.plan,
        data.seed,
        data.catalog,
        (level, set) => postMessage({ type: "automatic-level", level, set }),
        (p) => {
          if (performance.now() - last > 120 || p.accepted === p.requested) {
            postMessage({ type: "automatic-progress", report: p });
            last = performance.now();
          }
        },
      );
      postMessage({ type: "automatic-done", report });
      return;
    }
    if (data.type === "import") {
      postMessage({ type: "imported", catalog: validateCatalog(data.catalog) });
      return;
    }
    if (data.type === "solve") {
      if (
        data.referenceSolution &&
        data.rules.solutionPolicy === "any-valid" &&
        data.fixed.length === 0
      ) {
        postMessage({
          type: "solved",
          result: certifyTilings(
            data.board,
            data.set,
            data.rules,
            data.referenceSolution,
          ),
        });
        return;
      }
      postMessage({
        type: "solved",
        result: solve(data.board, data.set, data.rules, data.fixed, {
          nodeLimit: data.nodeLimit ?? 500000,
        }),
      });
      return;
    }
    if (
      (data.settings.fixedMin ?? data.settings.fixedCount) >
      (data.settings.fixedMax ?? data.settings.fixedCount)
    )
      throw Error("Sabit parça aralığı: minimum maksimumdan büyük olamaz");
    preflight(data.board, data.set, {
      allowRotations: data.set.allowRotations ?? true,
      allowReflections: data.set.allowReflections ?? false,
      solutionPolicy: data.settings.policy,
    });
    const seen = new Set<string>(data.existing ?? []),
      started = performance.now();
    let accepted = 0;
    const rejected: Record<string, number> = {};
    for (
      let i = 0;
      i < data.settings.attemptLimit && accepted < data.count;
      i++
    ) {
      if (performance.now() - started > data.settings.timeLimit) {
        postMessage({
          type: "progress",
          attempt: i,
          accepted,
          rejected,
          elapsed: performance.now() - started,
        });
        break;
      }
      try {
        const level = generate(data.board, data.set, {
          ...data.settings,
          fixedCount:
            data.count > 1
              ? (data.settings.fixedMin ?? data.settings.fixedCount) +
                (i %
                  ((data.settings.fixedMax ?? data.settings.fixedCount) -
                    (data.settings.fixedMin ?? data.settings.fixedCount) +
                    1))
              : data.settings.fixedCount,
          seed:
            data.count === 1 && i === 0
              ? data.settings.seed
              : `${data.settings.seed}-${i}`,
        });
        const f = fingerprint(level);
        if (data.count > 1 && seen.has(f))
          throw Error("Yinelenen oynanabilir bölüm");
        seen.add(f);
        postMessage({ type: "level", level });
        accepted++;
      } catch (e) {
        const msg = (e as Error).message;
        rejected[msg] = (rejected[msg] ?? 0) + 1;
      }
      postMessage({
        type: "progress",
        attempt: i + 1,
        accepted,
        rejected,
        elapsed: performance.now() - started,
      });
    }
    postMessage({ type: "done", accepted, requested: data.count, rejected });
  } catch (e) {
    postMessage({ type: "error", error: (e as Error).message });
  }
};
