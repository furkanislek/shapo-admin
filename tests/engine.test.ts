import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  orientations,
  shapeKey,
  validatePlacements,
  preflight,
  validateSet,
  connected,
} from "../src/engine/geometry";
import { solve } from "../src/engine/solver";
import { boards, demoSets, defaultRules } from "../src/engine/demo";
import { generate, fingerprint } from "../src/engine/generator";
import {
  addLevel,
  emptyCatalog,
  serialize,
  validateCatalog,
} from "../src/engine/catalog";
import {
  tracks,
  type Board,
  type PieceSet,
  type Settings,
} from "../src/engine/model";
const r = { ...defaultRules, allowReflections: true },
  b: Board = { width: 3, height: 2, mask: ["111", "111"] },
  s: PieceSet = {
    id: "tutorial",
    version: 1,
    pieces: [
      {
        id: "A",
        symbol: "A",
        color: "#647D68",
        cells: [
          [0, 0],
          [1, 0],
        ],
      },
      {
        id: "B",
        symbol: "B",
        color: "#CA956B",
        cells: [
          [2, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
      },
    ],
  };
const fixed = {
  pieceId: "A",
  orientationKey: "0,0;1,0",
  origin: [0, 0] as [number, number],
  cells: [
    [0, 0],
    [1, 0],
  ] as [number, number][],
};
test("normalization, rotations, reflections and square deduplication", () => {
  assert.deepEqual(
    normalize([
      [3, 4],
      [2, 4],
    ]),
    [
      [0, 0],
      [1, 0],
    ],
  );
  assert.equal(
    orientations(
      {
        id: "Q",
        symbol: "Q",
        color: "red",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
      },
      r,
    ).length,
    1,
  );
  assert.equal(orientations(s.pieces[0], r).length, 2);
  const l = {
    id: "L",
    symbol: "L",
    color: "red",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ] as [number, number][],
  };
  assert.equal(orientations(l, defaultRules).length, 4);
  assert.equal(orientations(l, r).length, 8);
  assert.ok(
    !orientations(l, defaultRules).some(
      ([k]) =>
        k ===
        shapeKey([
          [1, 0],
          [1, 1],
          [0, 2],
          [1, 2],
        ]),
    ),
  );
});
test("known multiple and unique fixture; all fixed cells preserved", () => {
  assert.equal(solve(b, s, r).classification, "multiple");
  const unique = solve(b, s, r, [fixed]);
  assert.equal(unique.classification, "unique");
  assert.equal(unique.countIsExact, true);
  for (const sol of unique.solutions) {
    assert.ok(
      sol.some(
        (p) => p.pieceId === "A" && JSON.stringify(p) === JSON.stringify(fixed),
      ),
    );
    assert.ok(validatePlacements(b, s, r, sol, true));
  }
});
test("brief malformed orientationKey is rejected", () => {
  assert.throws(
    () =>
      validatePlacements(b, s, r, [
        { ...fixed, orientationKey: "0,0;0,1;0,2" },
      ]),
    /tutarsız/,
  );
});
test("known zero solutions and budgets never report false certainty", () => {
  const z: Board = { width: 6, height: 1, mask: ["111111"] };
  assert.equal(solve(z, s, r).classification, "unsolvable");
  for (const opts of [
    { nodeLimit: 0 },
    { timeLimit: -1 },
    { cancelled: () => true },
  ]) {
    const out = solve(b, s, r, [], opts);
    assert.equal(out.classification, "unknown");
    assert.equal(out.countIsExact, false);
  }
  const one = solve(b, s, r, [], { limit: 1 });
  assert.equal(one.classification, "unknown");
});
test("areas, disconnected masks, duplicate geometry, illegal placements", () => {
  assert.throws(
    () => preflight({ ...b, width: 4, mask: ["1111", "1111"] }, s, r),
    /8 hücre/,
  );
  assert.throws(
    () => preflight({ width: 7, height: 1, mask: ["1110111"] }, s, r),
    /bileşen/,
  );
  assert.throws(
    () =>
      validateSet(
        { ...s, pieces: [s.pieces[0], { ...s.pieces[0], id: "C" }] },
        r,
      ),
    /geometri/,
  );
  assert.throws(() =>
    validatePlacements(b, s, r, [fixed, { ...fixed, pieceId: "B" }]),
  );
  assert.equal(
    connected([
      [0, 0],
      [2, 0],
    ]),
    false,
  );
});
const settings: Settings = {
  seed: "test-studio",
  fixedCount: 3,
  nodeLimit: 500000,
  attemptLimit: 30,
  timeLimit: 30000,
  policy: "unique",
  track: "easy",
};
function validDemo(id = "rectangle") {
  for (const fixedCount of [3, 4, 2, 5])
    for (const track of tracks)
      try {
        return generate(
          boards[id],
          demoSets.find((s) => s.id === `studio-${id}`)!,
          { ...settings, fixedCount, track },
        );
      } catch {}
  throw Error("demo generation failed");
}
test("rectangle and all silhouette demos solve with explicit inventory", () => {
  for (const id of Object.keys(boards)) {
    const l = validDemo(id),
      set = demoSets.find((s) => s.id === l.pieceSetId)!;
    assert.equal(l.validation.classification, "unique");
    assert.ok(
      validatePlacements(l.board, set, l.rules, l.referenceSolution!, true),
    );
    assert.equal(l.pieceIds.length, set.pieces.length);
  }
});
test("seed and settings determinism excluding diagnostic timing", () => {
  const a = validDemo(),
    b = generate(a.board, demoSets[0], a.generation);
  assert.equal(fingerprint(a), fingerprint(b));
  assert.deepEqual(a.referenceSolution, b.referenceSolution);
  assert.equal(a.difficulty.estimatedScore, b.difficulty.estimatedScore);
});
test("catalog deduplication, roundtrip and player reimport recovers solution", () => {
  const l = validDemo(),
    c = addLevel(emptyCatalog(), l);
  assert.throws(
    () =>
      addLevel(c, {
        ...l,
        id: "other",
        generation: { ...l.generation, seed: "other" },
      }),
    /zaten/,
  );
  const round = validateCatalog(JSON.parse(serialize(c)));
  assert.equal(
    fingerprint(round.tracks[l.difficulty.label][0]),
    fingerprint(l),
  );
  const player = serialize(c, true);
  assert.ok(!player.includes("referenceSolution"));
  const imported = validateCatalog(JSON.parse(player));
  assert.ok(imported.tracks[l.difficulty.label][0].referenceSolution);
  const before = serialize(c);
  assert.throws(() => validateCatalog({ ...c, game: "wrong" }));
  assert.equal(serialize(c), before);
});
test("playing valid, overlapping, incomplete and completed coverage", () => {
  const out = solve(b, s, r, [fixed]);
  assert.ok(validatePlacements(b, s, r, out.solutions[0], true));
  assert.throws(() => validatePlacements(b, s, r, [fixed], true));
  assert.throws(() => validatePlacements(b, s, r, [fixed, fixed]));
});

test("metadata does not bypass content deduplication; duplicate IDs rejected", () => {
  const l = validDemo(),
    c = addLevel(emptyCatalog(), l);
  assert.throws(
    () =>
      addLevel(c, {
        ...l,
        id: "metadata-copy",
        board: { ...l.board, shapeLabel: "Renamed" },
      }),
    /zaten/,
  );
  assert.throws(
    () =>
      addLevel(c, { ...l, fixedPlacements: l.referenceSolution!, id: l.id }),
    /kimliği/,
  );
});
test("schema errors carry paths and malformed imports preserve original", () => {
  const l = validDemo(),
    c = addLevel(emptyCatalog(), l),
    snapshot = serialize(c);
  const bad = JSON.parse(snapshot);
  delete bad.tracks[l.difficulty.label][0].generation;
  assert.throws(() => validateCatalog(bad), /tracks/);
  const bad2 = JSON.parse(snapshot);
  bad2.tracks[l.difficulty.label][0].pieceIds = [];
  assert.throws(() => validateCatalog(bad2));
  assert.equal(serialize(c), snapshot);
});
test("player export strips reference solutions recursively from revision history", () => {
  const l = validDemo();
  l.revisionHistory = [structuredClone(l)];
  l.revision = 2;
  const c = addLevel(emptyCatalog(), l);
  assert.ok(!serialize(c, true).includes("referenceSolution"));
});

test("a chiral silhouette cannot silently use a forbidden reflection", () => {
  const set: PieceSet = {
    id: "chiral",
    version: 1,
    pieces: [
      {
        id: "L",
        symbol: "L",
        color: "#123456",
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
      },
    ],
  };
  const board: Board = { width: 2, height: 3, mask: ["01", "01", "11"] };
  assert.equal(solve(board, set, defaultRules).classification, "unsolvable");
  assert.equal(
    solve(board, set, { ...defaultRules, allowReflections: true })
      .classification,
    "unique",
  );
});
test("one solution followed by a node cutoff remains unknown", () => {
  let found = false;
  for (let nodeLimit = 1; nodeLimit < 30; nodeLimit++) {
    const out = solve(b, s, r, [], { nodeLimit });
    if (out.solutionCount === 1 && out.status === "node_limit") {
      assert.equal(out.classification, "unknown");
      assert.equal(out.countIsExact, false);
      found = true;
      break;
    }
  }
  assert.ok(found);
});
test("tampered difficulty score is rejected rather than published", () => {
  const l = validDemo(),
    c = addLevel(emptyCatalog(), l);
  c.tracks[l.difficulty.label][0].difficulty.estimatedScore = 999;
  assert.throws(() => validateCatalog(c), /difficulty/);
});
