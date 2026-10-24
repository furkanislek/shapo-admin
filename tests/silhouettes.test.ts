import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Catalog } from "../src/engine/model";
import { tracks } from "../src/engine/model";
import {
  silhouetteShapes,
  silhouetteResolutions,
  silhouetteBoard,
} from "../src/engine/silhouette-shapes";
import { active, connected, validatePlacements } from "../src/engine/geometry";
import { catalogForKind, filteredLevels, pageLevels } from "../src/engine/bulk";
import { validateCatalog } from "../src/engine/catalog";
import { generate, fingerprint } from "../src/engine/generator";
const read = () =>
  JSON.parse(
    fs.readFileSync("examples/silhouette-admin-catalog.json", "utf8"),
  ) as Catalog;
test("100 silhouette masks are connected, distinct, detailed and exactly match their authored outlines", () => {
  assert.equal(silhouetteShapes.length, 20);
  assert.equal(silhouetteResolutions.length, 5);
  assert.ok(Math.min(...silhouetteResolutions) >= 16);
  const masks = new Set();
  for (const shape of silhouetteShapes)
    for (const size of silhouetteResolutions) {
      const b = silhouetteBoard(shape.id, size);
      assert.ok(connected(active(b)));
      assert.ok(b.width <= 20 && b.height <= 20);
      masks.add(`${b.width},${b.height}:${b.mask.join("/")}`);
    }
  assert.equal(masks.size, 100);
});
test("delivered 100 silhouettes start at medium and include puzzles beyond the standard expert profile", () => {
  const c = read(),
    levels = tracks.flatMap((t) => c.tracks[t]);
  assert.equal(levels.length, 100);
  assert.equal(c.tracks.baby.length, 0);
  assert.equal(c.tracks.easy.length, 0);
  assert.ok(
    c.tracks.medium.length > 0 &&
      c.tracks.hard.length > 0 &&
      c.tracks.expert.length > 0,
  );
  const ids = new Set(),
    sets = new Set();
  let beyondExpert = 0;
  for (const l of levels) {
    assert.equal(l.kind, "silhouette");
    assert.equal(l.generation.method, "silhouette-1");
    assert.ok(!ids.has(l.id));
    ids.add(l.id);
    sets.add(l.pieceSetId);
    const res = Number(l.board.templateId!.split("-").at(-1)),
      shape = silhouetteShapes.find(
        (s) => l.board.templateId === `silhouette-${s.id}-${res}`,
      )!;
    assert.ok(shape);
    assert.deepEqual(l.board, silhouetteBoard(shape.id, res));
    const set = c.pieceSets.find((s) => s.id === l.pieceSetId)!;
    assert.ok(
      validatePlacements(l.board, set, l.rules, l.referenceSolution!, true),
    );
    assert.equal(l.fixedPlacements.length, 0);
    assert.equal(l.rules.solutionPolicy, "any-valid");
    assert.ok(l.validation.solutionCount >= 1);
    if (l.validation.solutionCount === 1) {
      assert.equal(l.validation.classification, "unknown");
      assert.equal(l.validation.countIsExact, false);
    }
    if (
      l.pieceIds.length > 24 &&
      active(l.board).length > 192 &&
      l.difficulty.estimatedScore > 234
    )
      beyondExpert++;
  }
  assert.equal(sets.size, 100);
  assert.ok(beyondExpert >= 10, `${beyondExpert} advanced silhouettes`);
});
test("asymmetric silhouette player imports recover valid solutions without claiming uniqueness", () => {
  const c = read(),
    selected = [
      "silhouette-cat-16",
      "silhouette-heart-20",
      "silhouette-teapot-20",
    ];
  for (const t of tracks)
    c.tracks[t] = c.tracks[t].filter((l) =>
      selected.includes(l.board.templateId!),
    );
  for (const t of tracks)
    for (const l of c.tracks[t]) delete l.referenceSolution;
  const restored = validateCatalog(c);
  assert.equal(tracks.flatMap((t) => restored.tracks[t]).length, 3);
  for (const l of tracks.flatMap((t) => restored.tracks[t])) {
    assert.ok(l.referenceSolution);
    assert.notEqual(l.validation.classification, "unique");
  }
});
test("silhouette seed, shape and piece count regenerate the same content", () => {
  const c = read(),
    l = c.tracks.expert.find((l) => l.pieceIds.length === 30)!,
    s = c.pieceSets.find((s) => s.id === l.pieceSetId)!;
  const again = generate(l.board, s, l.generation);
  assert.equal(fingerprint(again), fingerprint(l));
  assert.equal(again.difficulty.estimatedScore, l.difficulty.estimatedScore);
});
test("catalog type filters also constrain all-page and page bulk selections", () => {
  const c = read();
  const base = JSON.parse(
    fs.readFileSync("examples/admin-catalog.json", "utf8"),
  ) as Catalog;
  for (const t of tracks) c.tracks[t].push(...base.tracks[t]);
  const series = catalogForKind(c, "silhouette-series");
  assert.equal(filteredLevels(series, "all").length, 100);
  for (const l of pageLevels(series, "all", {}))
    assert.equal(l.generation.method, "silhouette-1");
  assert.equal(filteredLevels(catalogForKind(c, "rectangle"), "all").length, 1);
  assert.equal(
    filteredLevels(catalogForKind(c, "silhouette"), "all").length,
    103,
  );
});
