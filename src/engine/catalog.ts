import { partitionSilhouette } from "./silhouette-packing";
import { certifyTilings } from "./witnesses";
import { createAutomaticPacking } from "./packing";
import Ajv2020 from "ajv/dist/2020.js";
import schema from "./catalog.schema.json";
const validateStructure = new Ajv2020({ allErrors: true }).compile(schema);
import { tracks, VERSION, type Catalog, type Level } from "./model";
import { demoSets } from "./demo";
import { fingerprint } from "./generator";
import { evaluateDifficulty } from "./difficulty";
import { preflight, validatePlacements, validateSet } from "./geometry";
import { solve } from "./solver";
export const emptyCatalog = (): Catalog => ({
  schemaVersion: 1,
  game: "shape-packing-2d",
  catalogId: "shape-studio",
  catalogRevision: 1,
  engineVersion: VERSION,
  coordinateSystem: "xy-zero-based",
  pieceSets: demoSets,
  tracks: { baby: [], easy: [], medium: [], hard: [], expert: [] },
});
export function validateCatalog(value: unknown): Catalog {
  if (!validateStructure(value))
    throw Error(
      validateStructure.errors
        ?.slice(0, 5)
        .map((e) => `${e.instancePath || "catalog"}: ${e.message}`)
        .join(";"),
    );
  const c = structuredClone(value) as Catalog;
  if (
    c?.schemaVersion !== 1 ||
    c.game !== "shape-packing-2d" ||
    c.coordinateSystem !== "xy-zero-based" ||
    !Array.isArray(c.pieceSets) ||
    c.pieceSets.length > 1000
  )
    throw Error("catalog: sözleşme veya parça seti listesi geçersiz");
  const versions = new Set();
  for (const set of c.pieceSets) {
    const k = `${set.id}@${set.version}`;
    if (versions.has(k)) throw Error(`pieceSets: yinelenen sürüm ${k}`);
    versions.add(k);
    validateSet(set, {
      allowRotations: set.allowRotations ?? true,
      allowReflections: set.allowReflections ?? false,
      solutionPolicy: "unique",
    });
  }
  const ids = new Set(),
    seen = new Set();
  for (const track of tracks) {
    if (!Array.isArray(c.tracks?.[track]) || c.tracks[track].length > 1000)
      throw Error(`tracks.${track}: geçersiz bölüm listesi`);
    for (const l of c.tracks[track]) {
      try {
        if (
          !l.id ||
          ids.has(l.id) ||
          !l.generation ||
          !l.difficulty ||
          !Number.isInteger(l.revision) ||
          !Number.isInteger(l.order) ||
          !["rectangle", "silhouette"].includes(l.kind)
        )
          throw Error("eksik alan veya yinelenen id");
        ids.add(l.id);
        const set = c.pieceSets.find(
          (s) => s.id === l.pieceSetId && s.version === l.pieceSetVersion,
        );
        if (!set) throw Error("pieceSetVersion bulunamadı");
        if (
          !Array.isArray(l.pieceIds) ||
          new Set(l.pieceIds).size !== l.pieceIds.length ||
          l.pieceIds.length !== set.pieces.length ||
          set.pieces.some((p) => !l.pieceIds.includes(p.id))
        )
          throw Error("pieceIds tam envanterle eşleşmiyor");
        if (
          (set.allowRotations !== undefined &&
            set.allowRotations !== l.rules.allowRotations) ||
          (set.allowReflections !== undefined &&
            set.allowReflections !== l.rules.allowReflections)
        )
          throw Error("rules: set sürümünün dönüş kurallarıyla eşleşmiyor");
        if (l.rules.solutionPolicy !== l.generation.policy)
          throw Error("rules.solutionPolicy: generation.policy ile eşleşmiyor");
        if (
          l.kind === "rectangle" &&
          l.board.mask.some((row) => row.includes("0"))
        )
          throw Error("board.mask: dikdörtgen tamamen aktif olmalı");
        preflight(l.board, set, l.rules);
        validatePlacements(l.board, set, l.rules, l.fixedPlacements);
        if (l.referenceSolution) {
          validatePlacements(l.board, set, l.rules, l.referenceSolution, true);
          for (const p of l.fixedPlacements)
            if (
              !l.referenceSolution.some(
                (q) => JSON.stringify(q) === JSON.stringify(p),
              )
            )
              throw Error("referenceSolution sabit parçaları korumuyor");
        }
        const witness =
          (l.generation.method === "automatic-2" ||
            l.generation.method === "silhouette-1") &&
          l.rules.solutionPolicy === "any-valid" &&
          !l.fixedPlacements.length
            ? (l.referenceSolution ??
              (l.generation.method === "silhouette-1"
                ? partitionSilhouette(
                    l.board,
                    l.generation.packingSeed!,
                    l.generation.pieceCount!,
                  ).tiling
                : createAutomaticPacking(
                    l.generation.track,
                    l.generation.packingSeed!,
                    "automatic-2",
                  ).tiling))
            : undefined;
        const r = witness
          ? certifyTilings(l.board, set, l.rules, witness)
          : solve(l.board, set, l.rules, l.fixedPlacements, {
              nodeLimit: 500000,
            });
        if (r.status !== "complete")
          throw Error(
            "Arama sınırına ulaşıldı; yeniden doğrulama tamamlanamadı",
          );
        if (
          l.rules.solutionPolicy === "unique" &&
          r.classification !== "unique"
        )
          throw Error("tekillik kanıtlanamadı");
        if (!r.solutions.length) throw Error("çözüm doğrulanamadı");
        const difficulty = evaluateDifficulty(
          l.board,
          set,
          l.rules,
          l.fixedPlacements,
          r,
          l.difficulty.metricsVersion,
        );
        if (
          l.difficulty.label !== difficulty.label ||
          l.difficulty.estimatedScore !== difficulty.estimatedScore
        )
          throw Error("difficulty: hesaplanan tahmini zorluk ile eşleşmiyor");
        if ((l.difficulty.manualLabel ?? l.difficulty.label) !== track)
          throw Error("difficulty.manualLabel: katalog hattıyla eşleşmiyor");
        l.difficulty = {
          ...difficulty,
          ...(l.difficulty.manualLabel
            ? { manualLabel: l.difficulty.manualLabel }
            : {}),
        };
        l.referenceSolution = r.solutions[0];
        const { solutions, stats, ...v } = r;
        void solutions;
        void stats;
        l.validation = {
          ...v,
          symmetryPolicy: "board-symmetries-count-separately",
          engineVersion: VERSION,
        };
        const f = fingerprint(l);
        if (seen.has(f)) throw Error("yinelenen oynanabilir bölüm");
        seen.add(f);
      } catch (e) {
        throw Error(`tracks.${track}.${l.id}: ${(e as Error).message}`);
      }
    }
  }
  return c;
}
export function addLevel(c: Catalog, l: Level) {
  if (
    tracks
      .flatMap((t) => c.tracks[t])
      .some((x) => fingerprint(x) === fingerprint(l))
  )
    throw Error("Aynı oynanabilir bölüm katalogda zaten var");
  if (tracks.flatMap((t) => c.tracks[t]).some((x) => x.id === l.id))
    throw Error("Bölüm kimliği katalogda zaten var; revizyonla değiştirin");
  const next = structuredClone(c),
    track = l.difficulty.manualLabel ?? l.difficulty.label;
  l = { ...l, order: next.tracks[track].length + 1 };
  next.tracks[track].push(l);
  next.catalogRevision++;
  return next;
}
export function serialize(c: Catalog, player = false) {
  const result = structuredClone(c);
  if (player) {
    const strip = (l: Level) => {
      delete l.referenceSolution;
      l.revisionHistory?.forEach(strip);
    };
    for (const t of tracks) result.tracks[t].forEach(strip);
  }
  return JSON.stringify(result, null, 2);
}
