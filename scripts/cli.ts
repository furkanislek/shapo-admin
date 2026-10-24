import fs from "node:fs";
import { boards, demoSets } from "../src/engine/demo";
import { generate } from "../src/engine/generator";
import {
  emptyCatalog,
  addLevel,
  serialize,
  validateCatalog,
} from "../src/engine/catalog";
import { tracks, type Track, type Settings } from "../src/engine/model";
try {
  const [command = "generate", input = "examples/admin-catalog.json", output] =
    process.argv.slice(2);
  if (command === "validate") {
    const c = validateCatalog(JSON.parse(fs.readFileSync(input, "utf8")));
    console.log(
      `Doğrulandı: ${tracks.flatMap((t) => c.tracks[t]).length} bölüm`,
    );
  } else if (command === "export") {
    const c = validateCatalog(JSON.parse(fs.readFileSync(input, "utf8")));
    fs.writeFileSync(
      output ?? "examples/player-catalog.json",
      serialize(c, true),
    );
  } else if (command === "generate-config") {
    const config = JSON.parse(fs.readFileSync(input, "utf8"));
    const board = config.board ?? boards[config.boardId ?? "rectangle"];
    const set =
      config.pieceSet ??
      demoSets.find((s) => s.id === `studio-${config.boardId ?? "rectangle"}`);
    if (!board || !set)
      throw Error("config.board / config.pieceSet bulunamadı");
    const count = config.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw Error("config.count: 1–100 arasında olmalı");
    const settings: Settings = {
      seed: "cli-2026",
      fixedCount: 3,
      nodeLimit: 500000,
      attemptLimit: 30,
      timeLimit: 30000,
      policy: "unique",
      track: "medium",
      ...config.settings,
    };
    const min = settings.fixedMin ?? settings.fixedCount,
      max = settings.fixedMax ?? settings.fixedCount;
    if (min > max) throw Error("config.settings: sabit parça aralığı geçersiz");
    let c = emptyCatalog();
    c.pieceSets = [set];
    let attempts = 0,
      accepted = 0;
    const rejected: Record<string, number> = {},
      started = performance.now();
    while (
      attempts < settings.attemptLimit &&
      accepted < count &&
      performance.now() - started < settings.timeLimit
    ) {
      const i = attempts++;
      try {
        const l = generate(board, set, {
          ...settings,
          fixedCount:
            count > 1 ? min + (i % (max - min + 1)) : settings.fixedCount,
          seed:
            count === 1 && i === 0 ? settings.seed : `${settings.seed}-${i}`,
        });
        c = addLevel(c, l);
        accepted++;
      } catch (e) {
        const why = (e as Error).message;
        rejected[why] = (rejected[why] ?? 0) + 1;
      }
    }
    c = validateCatalog(c);
    const target = output ?? "examples/custom-catalog.json";
    fs.writeFileSync(target, serialize(c));
    const report = {
      requested: count,
      attempts,
      accepted,
      rejected,
      elapsedMs: performance.now() - started,
    };
    fs.writeFileSync(`${target}.report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (accepted < count)
      throw Error(
        `İstenen ${count}, üretilen ${accepted}; kısmi katalog ${target} dosyasına yazıldı`,
      );
  } else if (command === "generate") {
    let c = emptyCatalog();
    const report: unknown[] = [];
    for (const [id, board] of Object.entries(boards)) {
      const set = demoSets.find((s) => s.id === `studio-${id}`)!;
      const started = performance.now();
      let accepted = false,
        attempt = 0;
      const rejected: Record<string, number> = {};
      for (const fixedCount of [3, 4, 2, 1, 5, 0]) {
        if (accepted) break;
        for (const track of tracks) {
          attempt++;
          const settings: Settings = {
            seed: `demo-${id}-2026`,
            fixedCount,
            nodeLimit: 500000,
            attemptLimit: 30,
            timeLimit: 30000,
            policy: "unique",
            track: track as Track,
          };
          try {
            const level = generate(board, set, settings);
            c = addLevel(c, level);
            accepted = true;
            report.push({
              board: id,
              pieceSet: set.id,
              seed: settings.seed,
              attempts: attempt,
              rejected,
              accepted: 1,
              fixedCount,
              track,
              score: level.difficulty.estimatedScore,
              nodes: level.difficulty.metrics.nodes,
              elapsedMs: performance.now() - started,
            });
            break;
          } catch (e) {
            const why = (e as Error).message;
            rejected[why] = (rejected[why] ?? 0) + 1;
          }
        }
      }
      if (!accepted) throw Error(`${id}: doğrulanmış demo üretilemedi`);
    }
    c = validateCatalog(c);
    fs.mkdirSync("examples", { recursive: true });
    fs.writeFileSync(input, serialize(c));
    fs.writeFileSync("examples/player-catalog.json", serialize(c, true));
    fs.writeFileSync(
      "docs/generation-report.json",
      JSON.stringify(
        {
          engineVersion: c.engineVersion,
          report,
          verifiedLevels: tracks.flatMap((t) => c.tracks[t]).length,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(report, null, 2));
  } else
    throw Error(
      "Komutlar: generate [çıktı], validate [dosya], export [admin] [oyuncu]",
    );
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
