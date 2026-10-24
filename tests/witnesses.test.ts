import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createAutomaticPacking,
  automaticProfiles,
  legacyAutomaticProfiles,
} from "../src/engine/packing";
import { certifyTilings } from "../src/engine/witnesses";
import { validatePlacements } from "../src/engine/geometry";
import { evaluateDifficulty } from "../src/engine/difficulty";
import { emptyCatalog, validateCatalog } from "../src/engine/catalog";
import type { Catalog } from "../src/engine/model";
test("new medium has former expert dimensions and inventory; expert is over four times larger", () => {
  assert.deepEqual(automaticProfiles.medium, legacyAutomaticProfiles.expert);
  assert.ok(
    automaticProfiles.expert.width * automaticProfiles.expert.height >=
      4 *
        legacyAutomaticProfiles.expert.width *
        legacyAutomaticProfiles.expert.height,
  );
  for (const t of ["hard", "expert"] as const)
    assert.deepEqual(automaticProfiles[t].remaining, [
      automaticProfiles[t].sizes.length,
    ]);
});
test("unclued large boards have two independently checked distinct completions, never false uniqueness", () => {
  for (const t of ["hard", "expert"] as const) {
    const { board, set, tiling } = createAutomaticPacking(t, "witness-fixture");
    const rules = {
      allowRotations: true,
      allowReflections: false,
      solutionPolicy: "any-valid" as const,
    };
    const r = certifyTilings(board, set, rules, tiling);
    assert.equal(r.classification, "multiple");
    assert.equal(r.solutionCount, 2);
    assert.equal(r.countIsExact, false);
    assert.notDeepEqual(r.solutions[0], r.solutions[1]);
    for (const s of r.solutions)
      assert.ok(validatePlacements(board, set, rules, s, true));
    assert.equal(evaluateDifficulty(board, set, rules, [], r).label, t);
    assert.throws(() => certifyTilings(board, set, rules, tiling.slice(1)));
  }
});
test("legacy catalogs retain their original metric interpretation instead of silently relabelling", () => {
  const old = JSON.parse(
    fs.readFileSync("examples/automatic-v1-admin-catalog.json", "utf8"),
  ) as Catalog;
  const l = old.tracks.expert[0],
    c = emptyCatalog();
  c.pieceSets = old.pieceSets;
  c.tracks.expert = [l];
  const checked = validateCatalog(c);
  assert.equal(
    checked.tracks.expert[0].difficulty.metricsVersion,
    "estimate-1",
  );
  assert.equal(checked.tracks.expert[0].difficulty.label, "expert");
});
