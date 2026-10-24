import { tracks, type Catalog, type Track, type Level } from "./model";
export const PAGE_SIZE = 20;
export function pageIndex(length: number, page = 0) {
  return Math.min(
    Math.max(0, page),
    Math.max(0, Math.ceil(length / PAGE_SIZE) - 1),
  );
}
export function filteredLevels(c: Catalog, filter: Track | "all"): Level[] {
  return tracks
    .filter((t) => filter === "all" || t === filter)
    .flatMap((t) => c.tracks[t]);
}
export function pageLevels(
  c: Catalog,
  filter: Track | "all",
  pages: Partial<Record<Track, number>>,
): Level[] {
  return tracks
    .filter((t) => filter === "all" || t === filter)
    .flatMap((t) => {
      const i = pageIndex(c.tracks[t].length, pages[t]);
      return c.tracks[t].slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
    });
}
export function deleteLevels(c: Catalog, ids: ReadonlySet<string>) {
  const next = structuredClone(c);
  let changed = 0;
  for (const t of tracks) {
    const before = next.tracks[t].length;
    next.tracks[t] = next.tracks[t].filter((l) => !ids.has(l.id));
    changed += before - next.tracks[t].length;
    next.tracks[t].forEach((l, i) => (l.order = i + 1));
  }
  if (changed) next.catalogRevision++;
  return { catalog: next, changed };
}
export function moveLevels(
  c: Catalog,
  ids: ReadonlySet<string>,
  target: Track,
) {
  if (
    (target === "hard" || target === "expert") &&
    filteredLevels(c, "all").some(
      (l) => ids.has(l.id) && l.fixedPlacements.length > 0,
    )
  )
    throw Error(
      "Sabit parçalı bölümler zor/uzman hattına taşınamaz; bu seviyeler boş başlamalıdır.",
    );
  const next = structuredClone(c);
  const moved: Level[] = [];
  for (const t of tracks) {
    if (t === target) continue;
    next.tracks[t] = next.tracks[t].filter((l) => {
      if (!ids.has(l.id)) return true;
      moved.push({
        ...l,
        difficulty: { ...l.difficulty, manualLabel: target },
      });
      return false;
    });
  }
  next.tracks[target].push(...moved);
  for (const t of tracks) next.tracks[t].forEach((l, i) => (l.order = i + 1));
  if (moved.length) next.catalogRevision++;
  return { catalog: next, changed: moved.length };
}

export type CatalogKind =
  "all" | "rectangle" | "silhouette" | "silhouette-series";
export function catalogForKind(c: Catalog, kind: CatalogKind): Catalog {
  if (kind === "all") return c;
  return {
    ...c,
    tracks: Object.fromEntries(
      tracks.map((t) => [
        t,
        c.tracks[t].filter((l) =>
          kind === "silhouette-series"
            ? l.generation.method === "silhouette-1"
            : l.kind === kind,
        ),
      ]),
    ) as Catalog["tracks"],
  };
}
