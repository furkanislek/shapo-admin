import { partitionSilhouette } from "./silhouette-packing";
import { certifyTilings } from "./witnesses";
import type { Board, PieceSet, Settings, Level, Placement } from "./model";
import { VERSION } from "./model";
import { defaultRules } from "./demo";
import { solve } from "./solver";
import { validatePlacements } from "./geometry";
import { evaluateDifficulty } from "./difficulty";
import { hash } from "./random";
export { hash } from "./random";
import { createAutomaticPacking } from "./packing";
export function fingerprint(l: Level) {
  return JSON.stringify([
    [l.board.width, l.board.height, l.board.mask],
    l.pieceSetId,
    l.pieceSetVersion,
    [l.rules.allowRotations, l.rules.allowReflections],
    l.fixedPlacements
      .map((p) => `${p.pieceId}:${p.cells.map((c) => c.join(",")).join(";")}`)
      .sort(),
  ]);
}
export function generate(
  board: Board,
  set: PieceSet,
  settings: Settings,
  certifiedTiling?: Placement[],
): Level {
  if (
    !settings.seed ||
    settings.seed.length > 256 ||
    !Number.isInteger(settings.fixedCount) ||
    !Number.isInteger(settings.nodeLimit) ||
    settings.nodeLimit < 1 ||
    settings.nodeLimit > 10000000 ||
    !Number.isInteger(settings.attemptLimit) ||
    settings.attemptLimit < 1 ||
    settings.attemptLimit > 10000 ||
    !Number.isInteger(settings.timeLimit) ||
    settings.timeLimit < 1 ||
    settings.timeLimit > 300000
  )
    throw Error("generation: tohum veya arama bütçesi geçersiz");
  if (settings.method?.startsWith("automatic-") && !certifiedTiling) {
    if (!settings.packingSeed) throw Error("generation.packingSeed eksik");
    const packing = createAutomaticPacking(
      settings.track,
      settings.packingSeed,
    );
    if (packing.set.id !== set.id)
      throw Error("generation.packingSeed set ile eşleşmiyor");
    certifiedTiling = packing.tiling;
  }
  if (settings.method === "silhouette-1" && !certifiedTiling) {
    const packing = partitionSilhouette(
      board,
      settings.packingSeed!,
      settings.pieceCount!,
    );
    if (packing.set.id !== set.id)
      throw Error("Silüet üretim ayarları parça setiyle eşleşmiyor");
    certifiedTiling = packing.tiling;
  }
  const rules = {
    ...defaultRules,
    allowRotations: set.allowRotations ?? true,
    allowReflections: set.allowReflections ?? false,
    solutionPolicy: settings.policy,
  };
  if (settings.fixedCount < 0 || settings.fixedCount >= set.pieces.length)
    throw Error("Sabit parça hedefi 0 ile parça sayısı − 1 arasında olmalı");
  const started = performance.now(),
    remainingTime = () => settings.timeLimit - (performance.now() - started);
  let limited = false;
  if (certifiedTiling)
    validatePlacements(board, set, rules, certifiedTiling, true);
  const first = certifiedTiling
    ? { solutions: [certifiedTiling], status: "complete" }
    : solve(board, set, rules, [], {
        limit: 1,
        nodeLimit: settings.nodeLimit,
        timeLimit: remainingTime(),
        seed: hash(settings.seed),
      });
  if (!first.solutions.length)
    throw Error(
      first.status === "complete"
        ? "Tahta doldurulamıyor"
        : "Arama sınırına ulaşıldı; tam döşeme bulunamadı",
    );
  let fixed = [...first.solutions[0]].sort(
    (a, b) => hash(settings.seed + a.pieceId) - hash(settings.seed + b.pieceId),
  );
  if (certifiedTiling) {
    let state = hash(settings.seed);
    for (let i = fixed.length - 1; i > 0; i--) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const j = (state >>> 0) % (i + 1);
      [fixed[i], fixed[j]] = [fixed[j], fixed[i]];
    }
  }
  if (
    certifiedTiling &&
    settings.policy === "any-valid" &&
    settings.fixedCount === 0
  )
    fixed = [];
  for (const p of [...fixed]) {
    if (fixed.length <= settings.fixedCount) break;
    const candidate = fixed.filter((q) => q.pieceId !== p.pieceId);
    const r = solve(board, set, rules, candidate, {
      nodeLimit: settings.nodeLimit,
      timeLimit: remainingTime(),
    });
    if (r.status !== "complete") limited = true;
    if (settings.policy === "any-valid" || r.classification === "unique")
      fixed = candidate;
  }
  if (fixed.length !== settings.fixedCount)
    throw Error(
      `Hedef ${settings.fixedCount} sabit parçaya ulaşılamadı; ${fixed.length} parça gerekiyor${limited ? ". Arama sınırına ulaşıldı; tekillik henüz doğrulanamadı" : ""}`,
    );
  const result =
    certifiedTiling && settings.policy === "any-valid" && fixed.length === 0
      ? certifyTilings(board, set, rules, certifiedTiling)
      : solve(board, set, rules, fixed, {
          nodeLimit: settings.nodeLimit,
          timeLimit: remainingTime(),
        });
  if (result.status !== "complete")
    throw Error("Arama sınırına ulaşıldı; doğrulama tamamlanamadı");
  if (settings.policy === "unique" && result.classification !== "unique")
    throw Error("Tek çözümlülük doğrulanamadı");
  if (!result.solutions.length) throw Error("Geçerli çözüm bulunamadı");
  const difficulty = evaluateDifficulty(
      board,
      set,
      rules,
      fixed,
      result,
      settings.method === "automatic-1" ? "estimate-1" : "estimate-2",
    ),
    { label } = difficulty;
  if (label !== settings.track)
    throw Error(
      `Adayın tahmini hattı ${label}; hedef ${settings.track}. Sabit parça hedefini değiştirin.`,
    );
  const { solutions, stats, ...validation } = result;
  void stats;
  const l: Level = {
    id: `level-${hash(JSON.stringify([board, set.id, set.version, settings])).toString(16)}`,
    revision: 1,
    order: 1,
    kind: board.templateId ? "silhouette" : "rectangle",
    pieceSetId: set.id,
    pieceSetVersion: set.version,
    pieceIds: set.pieces.map((p) => p.id),
    board,
    rules,
    fixedPlacements: fixed,
    referenceSolution: solutions[0],
    generation: { ...settings },
    difficulty,
    validation: {
      ...validation,
      symmetryPolicy: "board-symmetries-count-separately",
      engineVersion: VERSION,
    },
  };
  return l;
}
