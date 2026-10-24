import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { boards, demoSets } from "../src/engine/demo";
import { validatePlacements } from "../src/engine/geometry";
import type { Level } from "../src/engine/model";
test("real worker cancellation preserves accepted batch and main loop stays responsive", async () => {
  const url = pathToFileURL(resolve("src/worker.ts")).href;
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=(message)=>parentPort.postMessage(message);require('tsx/cjs');require(${JSON.stringify(resolve("src/worker.ts"))});parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({type:'ready'});`,
    { eval: true },
  );
  void url;
  let ticks = 0;
  const heartbeat = setInterval(() => ticks++, 1),
    accepted: Level[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("worker timeout")), 15000);
      worker.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      worker.on("message", async (data) => {
        if (data.type === "ready")
          worker.postMessage({
            type: "generate",
            board: boards.rectangle,
            set: demoSets[0],
            settings: {
              seed: "cancel-test",
              fixedCount: 3,
              nodeLimit: 500000,
              attemptLimit: 1000,
              timeLimit: 60000,
              policy: "unique",
              track: "easy",
            },
            count: 100,
          });
        if (data.type === "error") {
          clearTimeout(timeout);
          reject(Error(data.error));
        }
        if (data.type === "level") {
          accepted.push(data.level);
          if (accepted.length === 2) {
            await worker.terminate();
            clearTimeout(timeout);
            resolve();
          }
        }
      });
    });
    assert.equal(accepted.length, 2);
    assert.ok(ticks > 0, "main event loop should run during worker search");
    for (const l of accepted)
      assert.ok(
        validatePlacements(
          l.board,
          demoSets[0],
          l.rules,
          l.referenceSolution!,
          true,
        ),
      );
  } finally {
    clearInterval(heartbeat);
    await worker.terminate();
  }
});

test("worker rejects area mismatch once before attempting a batch", async () => {
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);require('tsx/cjs');require(${JSON.stringify(resolve("src/worker.ts"))});parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({type:'ready'});`,
    { eval: true },
  );
  try {
    const messages: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("timeout")), 5000);
      worker.on("error", reject);
      worker.on("message", (data) => {
        if (data.type === "ready") {
          worker.postMessage({
            type: "generate",
            board: {
              width: 20,
              height: 20,
              mask: Array(20).fill("1".repeat(20)),
            },
            set: demoSets[0],
            settings: {
              seed: "bad-area",
              fixedCount: 3,
              nodeLimit: 200000,
              attemptLimit: 30,
              timeLimit: 15000,
              policy: "unique",
              track: "easy",
            },
            count: 5,
          });
          return;
        }
        messages.push(data.type);
        if (data.type === "error") {
          clearTimeout(timeout);
          assert.match(data.error, /400 hücre.*30 hücre/);
          resolve();
        }
      });
    });
    assert.deepEqual(messages, ["error"]);
  } finally {
    await worker.terminate();
  }
});

test("automatic worker emits versioned sets with partial levels that survive cancellation", async () => {
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);require('tsx/cjs');require(${JSON.stringify(resolve("src/worker.ts"))});parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({type:'ready'});`,
    { eval: true },
  );
  const accepted: { level: Level; set: (typeof demoSets)[number] }[] = [];
  let stopping = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("automatic worker timeout")),
        10000,
      );
      worker.on("error", reject);
      worker.on("message", async (data) => {
        if (data.type === "ready") {
          worker.postMessage({
            type: "automatic",
            plan: { expert: 250 },
            seed: "auto-cancel-fixture",
            catalog: {
              pieceSets: [],
              tracks: { baby: [], easy: [], medium: [], hard: [], expert: [] },
            },
          });
          return;
        }
        if (stopping) return;
        if (data.type === "error") {
          clearTimeout(timeout);
          reject(Error(data.error));
        }
        if (data.type === "automatic-level") {
          accepted.push(data);
          if (accepted.length === 2) {
            stopping = true;
            await worker.terminate();
            clearTimeout(timeout);
            resolve();
          }
        }
      });
    });
    assert.equal(accepted.length, 2);
    for (const { level, set } of accepted) {
      assert.ok(
        validatePlacements(
          level.board,
          set,
          level.rules,
          level.referenceSolution!,
          true,
        ),
      );
      assert.equal(level.validation.classification, "multiple");
      assert.equal(level.fixedPlacements.length, 0);
      assert.equal(level.pieceSetId, set.id);
    }
  } finally {
    await worker.terminate();
  }
});

test("difficulty upgrade preserves IDs and history while clearing all hard/expert starting pieces", async () => {
  const fs = await import("node:fs");
  const old = JSON.parse(
    fs.readFileSync("examples/automatic-v1-admin-catalog.json", "utf8"),
  );
  for (const t of ["baby", "easy", "medium", "hard", "expert"])
    old.tracks[t] = old.tracks[t].slice(0, 1);
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);require('tsx/cjs');require(${JSON.stringify(resolve("src/worker.ts"))});parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({type:'ready'});`,
    { eval: true },
  );
  const received: { level: Level; replaceId: string }[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("upgrade timeout")), 15000);
      worker.on("error", reject);
      worker.on("message", (data) => {
        if (data.type === "ready")
          worker.postMessage({
            type: "upgrade-difficulty",
            seed: "upgrade-test",
            catalog: old,
          });
        if (data.type === "error") {
          clearTimeout(timeout);
          reject(Error(data.error));
        }
        if (data.type === "automatic-level") received.push(data);
        if (data.type === "automatic-done") {
          clearTimeout(timeout);
          assert.equal(data.report.accepted, 5);
          resolve();
        }
      });
    });
    assert.equal(received.length, 5);
    for (const { level, replaceId } of received) {
      assert.equal(level.id, replaceId);
      assert.equal(level.revision, 2);
      assert.equal(level.revisionHistory?.[0].id, replaceId);
      if (["hard", "expert"].includes(level.difficulty.label)) {
        assert.equal(level.fixedPlacements.length, 0);
        assert.equal(level.rules.solutionPolicy, "any-valid");
        assert.equal(level.validation.classification, "multiple");
      }
    }
  } finally {
    await worker.terminate();
  }
});
