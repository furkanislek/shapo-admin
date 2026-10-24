import {
  silhouetteShapes,
  silhouetteBoard,
  silhouetteResolutions,
} from "../src/engine/silhouette-shapes";
import fs from "node:fs";
const boards = silhouetteShapes.flatMap((s) =>
  silhouetteResolutions.map((n) => silhouetteBoard(s.id, n)),
);
fs.mkdirSync("docs/silhouettes", { recursive: true });
fs.writeFileSync(
  "docs/silhouettes/masks.json",
  JSON.stringify(boards, null, 2),
);
console.log(boards.length, "bağlı maske");
