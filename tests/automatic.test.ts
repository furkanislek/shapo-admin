import { generate, fingerprint } from "../src/engine/generator";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createAutomaticPacking,
  runAutomatic,
  automaticProfiles,
} from "../src/engine/automatic";
import {
  emptyCatalog,
  addLevel,
  validateCatalog,
  serialize,
} from "../src/engine/catalog";
import { validatePlacements } from "../src/engine/geometry";
import { tracks, type Catalog } from "../src/engine/model";
import fs from "node:fs";
test("automatic profiles change board and piece geometry by difficulty with certified tilings", () => {
  for (const t of tracks) {
    const packing = createAutomaticPacking(t, "profile-fixture");
    assert.equal(packing.set.pieces.length, automaticProfiles[t].sizes.length);
    assert.ok(
      validatePlacements(
        packing.board,
        packing.set,
        {
          allowRotations: true,
          allowReflections: false,
          solutionPolicy: "unique",
        },
        packing.tiling,
        true,
      ),
    );
    assert.deepEqual(packing, createAutomaticPacking(t, "profile-fixture"));
  }
  assert.equal(automaticProfiles.baby.sizes.length, 4);
  assert.equal(automaticProfiles.expert.sizes.length, 24);
});
test("automatic plan fills all requested tracks with unique measured puzzles and roundtrips", () => {
  let c = emptyCatalog();
  const report = runAutomatic(
    { baby: 3, easy: 3, medium: 3, hard: 3, expert: 3 },
    "studio-auto-v1",
    c,
    (l, s) => {
      if (!c.pieceSets.some((p) => p.id === s.id)) c.pieceSets.push(s);
      c = addLevel(c, l);
    },
    () => {},
  );
  assert.equal(report.accepted, 15);
  for (const t of tracks) {
    assert.equal(c.tracks[t].length, 3);
    for (const l of c.tracks[t]) {
      assert.equal(
        l.validation.classification,
        t === "hard" || t === "expert" ? "multiple" : "unique",
      );
      assert.equal(l.validation.countIsExact, t !== "hard" && t !== "expert");
      if (t === "hard" || t === "expert")
        assert.equal(l.fixedPlacements.length, 0);
      assert.equal(l.difficulty.label, t);
      assert.equal(l.generation.track, t);
    }
  }
  assert.ok(validateCatalog(JSON.parse(serialize(c))));
});
test("automatic plan rejects invalid counts and reports partial results truthfully", () => {
  assert.throws(
    () =>
      runAutomatic(
        { baby: -1 },
        "bad",
        emptyCatalog(),
        () => {},
        () => {},
      ),
    /adedi/,
  );
  assert.throws(
    () =>
      runAutomatic(
        {},
        "bad",
        emptyCatalog(),
        () => {},
        () => {},
      ),
    /En az/,
  );
});
test("delivered 830 levels have exact quotas, varied sets, unique IDs and valid complete coverage", () => {
  const c = JSON.parse(
    fs.readFileSync("examples/automatic-admin-catalog.json", "utf8"),
  ) as Catalog;
  const expected = { baby: 30, easy: 100, medium: 200, hard: 250, expert: 250 };
  const ids = new Set();
  for (const t of tracks) {
    assert.equal(c.tracks[t].length, expected[t]);
    const sets = new Set();
    for (const l of c.tracks[t]) {
      assert.ok(!ids.has(l.id));
      ids.add(l.id);
      sets.add(l.pieceSetId);
      assert.equal(l.difficulty.label, t);
      assert.equal(
        l.validation.classification,
        t === "hard" || t === "expert" ? "multiple" : "unique",
      );
      assert.ok(
        validatePlacements(
          l.board,
          c.pieceSets.find((s) => s.id === l.pieceSetId)!,
          l.rules,
          l.referenceSolution!,
          true,
        ),
      );
    }
    assert.ok(sets.size > 1);
  }
  assert.equal(ids.size, 830);
  const player = JSON.parse(
    fs.readFileSync("examples/automatic-player-catalog.json", "utf8"),
  ) as Catalog;
  assert.ok(!JSON.stringify(player).includes("referenceSolution"));
  assert.equal(tracks.flatMap((t) => player.tracks[t]).length, 830);
});

test("automatic exported seed and settings regenerate identical content without a hidden tiling argument", () => {
  let c = emptyCatalog();
  runAutomatic(
    { expert: 1 },
    "regenerate-fixture",
    c,
    (l, s) => {
      c.pieceSets.push(s);
      c = addLevel(c, l);
    },
    () => {},
  );
  const l = c.tracks.expert[0],
    set = c.pieceSets.find((s) => s.id === l.pieceSetId)!;
  assert.equal(l.generation.method, "automatic-2");
  const again = generate(l.board, set, l.generation);
  assert.equal(fingerprint(again), fingerprint(l));
  assert.equal(again.difficulty.estimatedScore, l.difficulty.estimatedScore);
});
