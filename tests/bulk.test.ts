import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Catalog } from "../src/engine/model";
import {
  deleteLevels,
  moveLevels,
  filteredLevels,
  pageLevels,
  pageIndex,
} from "../src/engine/bulk";
const fixture = () =>
  JSON.parse(
    fs.readFileSync("examples/automatic-admin-catalog.json", "utf8"),
  ) as Catalog;
test("bulk selection distinguishes current page, entire filtered track and all tracks", () => {
  const c = fixture();
  assert.equal(pageLevels(c, "expert", {}).length, 20);
  assert.equal(filteredLevels(c, "expert").length, 250);
  assert.equal(filteredLevels(c, "all").length, 830);
  assert.equal(pageLevels(c, "expert", { expert: 12 }).length, 10);
  assert.equal(pageIndex(0, 12), 0);
  assert.equal(pageIndex(21, 50), 1);
});
test("bulk deletion across pages and tracks preserves source, stable IDs, history and contiguous orders", () => {
  const c = fixture(),
    before = JSON.stringify(c),
    ids = new Set([
      c.tracks.baby[0].id,
      c.tracks.expert[0].id,
      c.tracks.expert[249].id,
    ]);
  const result = deleteLevels(c, ids);
  assert.equal(result.changed, 3);
  assert.equal(result.catalog.tracks.baby.length, 29);
  assert.equal(result.catalog.tracks.expert.length, 248);
  assert.equal(result.catalog.catalogRevision, c.catalogRevision + 1);
  assert.deepEqual(
    result.catalog.tracks.expert.map((l) => l.order),
    Array.from({ length: 248 }, (_, i) => i + 1),
  );
  assert.equal(JSON.stringify(c), before);
  assert.equal(c.tracks.expert.length, 250, "undo snapshot is untouched");
  assert.equal(result.catalog.tracks.expert[0].id, c.tracks.expert[1].id);
});
test("selecting a whole track deletes only that track, clearing all leaves versioned sets intact", () => {
  const c = fixture(),
    one = deleteLevels(c, new Set(filteredLevels(c, "hard").map((l) => l.id)));
  assert.equal(one.changed, 250);
  assert.equal(one.catalog.tracks.hard.length, 0);
  assert.equal(one.catalog.tracks.expert.length, 250);
  const all = deleteLevels(
    c,
    new Set(filteredLevels(c, "all").map((l) => l.id)),
  );
  assert.equal(filteredLevels(all.catalog, "all").length, 0);
  assert.deepEqual(all.catalog.pieceSets, c.pieceSets);
  assert.equal(deleteLevels(c, new Set(["missing"])).changed, 0);
});
test("bulk move preserves original score, uses manual label and does not duplicate target-track members", () => {
  const c = fixture(),
    l = c.tracks.expert[0],
    target = c.tracks.baby[0];
  const result = moveLevels(c, new Set([l.id, target.id]), "baby");
  assert.equal(result.changed, 1);
  const moved = result.catalog.tracks.baby.find((p) => p.id === l.id)!;
  assert.equal(moved.difficulty.label, "expert");
  assert.equal(moved.difficulty.manualLabel, "baby");
  assert.equal(moved.difficulty.estimatedScore, l.difficulty.estimatedScore);
  assert.equal(result.catalog.tracks.expert.length, 249);
  assert.equal(
    result.catalog.tracks.baby.filter((p) => p.id === target.id).length,
    1,
  );
  assert.equal(c.tracks.expert.length, 250);
});

test("bulk moves keep hard and expert starts empty", () => {
  const c = fixture();
  assert.throws(
    () => moveLevels(c, new Set([c.tracks.baby[0].id]), "expert"),
    /boş başlamalıdır/,
  );
  const result = moveLevels(c, new Set([c.tracks.hard[0].id]), "expert");
  assert.equal(result.changed, 1);
  assert.ok(
    result.catalog.tracks.expert.every((l) => l.fixedPlacements.length === 0),
  );
});
