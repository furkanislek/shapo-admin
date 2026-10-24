import { runAutomatic } from "../src/engine/automatic";
import {
  emptyCatalog,
  addLevel,
  validateCatalog,
  serialize,
} from "../src/engine/catalog";
import fs from "node:fs";
const full = process.argv.includes("--full");
let c = emptyCatalog();
const plan = full
  ? { baby: 30, easy: 100, medium: 200, hard: 250, expert: 250 }
  : { baby: 3, easy: 3, medium: 3, hard: 3, expert: 3 };
let lastPrinted = 0;
const report = runAutomatic(
  plan,
  "studio-auto-v1",
  c,
  (l, s) => {
    if (!c.pieceSets.some((p) => p.id === s.id && p.version === s.version))
      c.pieceSets.push(s);
    c = addLevel(c, l);
  },
  (p) => {
    if (
      p.accepted % 25 === 0 &&
      p.accepted > lastPrinted &&
      (lastPrinted = p.accepted)
    )
      console.log(p.track, p.accepted, Math.round(p.elapsed));
  },
);
console.log(JSON.stringify(report, null, 2));
if (full) {
  fs.writeFileSync(
    "examples/automatic-admin-catalog.json",
    serialize(validateCatalog(c)),
  );
  fs.writeFileSync(
    "examples/automatic-player-catalog.json",
    serialize(c, true),
  );
  fs.writeFileSync(
    "docs/automatic-generation-report.json",
    JSON.stringify(report, null, 2),
  );
}
if (report.accepted !== report.requested) process.exitCode = 1;
