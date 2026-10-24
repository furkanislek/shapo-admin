import fs from "node:fs";
import { runSilhouetteSeries } from "../src/engine/silhouette-series";
import {
  emptyCatalog,
  addLevel,
  serialize,
  validateCatalog,
} from "../src/engine/catalog";
let c = emptyCatalog();
const report = runSilhouetteSeries(
  c,
  (l, s) => {
    if (!c.pieceSets.some((p) => p.id === s.id)) c.pieceSets.push(s);
    c = addLevel(c, l);
  },
  (p) => console.log(`${p.accepted}/100`, p.track, Math.round(p.elapsed)),
);
c = validateCatalog(c);
fs.writeFileSync("examples/silhouette-admin-catalog.json", serialize(c));
fs.writeFileSync("examples/silhouette-player-catalog.json", serialize(c, true));
fs.writeFileSync(
  "docs/silhouettes/generation-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (report.accepted !== 100) process.exitCode = 1;
