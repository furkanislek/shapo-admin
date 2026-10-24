import {
  filteredLevels,
  catalogForKind,
  type CatalogKind,
  pageLevels,
  pageIndex,
  deleteLevels,
  moveLevels,
} from "./engine/bulk";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BoardView, MaskThumbnail } from "./BoardView";
import {
  boards,
  demoSets,
  defaultRules,
  deriveSet,
  colors,
} from "./engine/demo";
import {
  active,
  preflight,
  topology,
  connected,
  normalize,
  orientations,
  validatePlacements,
  validateSet,
} from "./engine/geometry";
import { addLevel, serialize } from "./engine/catalog";
import {
  tracks,
  VERSION,
  type Board,
  type Catalog,
  type Cell,
  type Level,
  type PieceSet,
  type Placement,
  type Result,
  type Settings,
  type Track,
} from "./engine/model";
import { fingerprint } from "./engine/generator";
import { loadWorkspace, saveWorkspace } from "./storage";
import bundledCatalog from "../examples/admin-catalog.json";
import "./style.css";
import { AutomaticControls } from "./AutomaticControls";
import type { AutomaticProgress } from "./engine/automatic";
const names: Record<Track, string> = {
  baby: "Başlangıç",
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
  expert: "Uzman",
};
const boardNames: Record<string, string> = {
  rectangle: "Dikdörtgen",
  cat: "Kedi",
  dog: "Köpek",
  heart: "Kalp",
};
const defaultSettings: Settings = {
  seed: "demo-rectangle-2026",
  fixedCount: 3,
  nodeLimit: 200000,
  attemptLimit: 30,
  timeLimit: 15000,
  policy: "unique",
  track: "medium",
};
function download(text: string, name: string) {
  const u = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function App() {
  const [tab, setTab] = useState("Üretici"),
    [catalog, setCatalog] = useState<Catalog>(
      bundledCatalog as unknown as Catalog,
    ),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState("Yerel çalışma alanı yükleniyor"),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [boardId, setBoardId] = useState("rectangle"),
    [board, setBoard] = useState<Board>(boards.rectangle),
    [setId, setSetId] = useState("studio-rectangle@1"),
    [level, setLevel] = useState<Level | undefined>(
      tracks
        .flatMap((t) => (bundledCatalog as unknown as Catalog).tracks[t])
        .find((l) => l.kind === "rectangle"),
    ),
    [solution, setSolution] = useState(false),
    [grid, setGrid] = useState(false),
    [mono, setMono] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Doğrulanmış demo hazır. Çözümü inceleyin veya yeni bir bölüm üretin.",
    ),
    [progress, setProgress] = useState<{
      attempt: number;
      accepted: number;
      rejected: Record<string, number>;
      elapsed: number;
    }>(),
    [batch, setBatch] = useState(5),
    [autoAdd, setAutoAdd] = useState(false),
    [filter, setFilter] = useState("all"),
    [history, setHistory] = useState<Catalog[]>([]),
    [pending, setPending] = useState<Catalog>(),
    [playing, setPlaying] = useState(false),
    [moves, setMoves] = useState<Placement[]>([]),
    [selected, setSelected] = useState(""),
    [orientation, setOrientation] = useState(0),
    [ghost, setGhost] = useState<Cell[]>([]),
    [results, setResults] = useState<Result>(),
    [solutionIndex, setSolutionIndex] = useState(0),
    [step, setStep] = useState(30),
    [masks, setMasks] = useState<Record<string, Board>>({}),
    [maskUndo, setMaskUndo] = useState<Board[]>([]),
    [maskRedo, setMaskRedo] = useState<Board[]>([]),
    [mirror, setMirror] = useState(false),
    [editingSet, setEditingSet] = useState<PieceSet>(demoSets[0]),
    [editingPiece, setEditingPiece] = useState(0),
    [revisionTarget, setRevisionTarget] = useState<string>(),
    [revisionConfirm, setRevisionConfirm] = useState(false);
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("all");
  const viewCatalog = catalogForKind(catalog, catalogKind),
    viewTotal = filteredLevels(viewCatalog, "all").length;
  const [selectedLevelIds, setSelectedLevelIds] = useState<Set<string>>(
      new Set(),
    ),
    [bulkTrack, setBulkTrack] = useState<Track>("baby");
  function selectLevels(ids: string[]) {
    setSelectedLevelIds((previous) => new Set([...previous, ...ids]));
  }
  function deleteSelection() {
    const result = deleteLevels(catalog, selectedLevelIds);
    if (!result.changed) return;
    changeCatalog(result.catalog);
    if (level && selectedLevelIds.has(level.id)) {
      setLevel(undefined);
      setRevisionTarget(undefined);
    }
    setSelectedLevelIds(new Set());
    setCatalogPages({});
    setMessage(
      `${result.changed} bölüm silindi. Geri al ile tamamını geri getirebilirsiniz.`,
    );
  }
  function moveSelection() {
    let result;
    try {
      result = moveLevels(catalog, selectedLevelIds, bulkTrack);
    } catch (e) {
      setMessage((e as Error).message);
      return;
    }
    if (!result.changed) {
      setMessage("Seçilen bölümler zaten bu hatta.");
      return;
    }
    changeCatalog(result.catalog);
    setSelectedLevelIds(new Set());
    setCatalogPages({});
    setMessage(
      `${result.changed} bölüm ${names[bulkTrack]} hattına taşındı. Geri al kullanılabilir.`,
    );
  }
  useEffect(() => {
    const valid = new Set(
      tracks.flatMap((t) => catalog.tracks[t]).map((l) => l.id),
    );
    setSelectedLevelIds((previous) => {
      const next = new Set([...previous].filter((id) => valid.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [catalog]);
  const [catalogPages, setCatalogPages] = useState<
    Partial<Record<Track, number>>
  >({});
  const [generationMode, setGenerationMode] = useState<"automatic" | "manual">(
    "automatic",
  );
  const [automaticReport, setAutomaticReport] =
    useState<Omit<AutomaticProgress, "track">>();
  const automaticQueue = useRef<
      { level: Level; set: PieceSet; replaceId?: string }[]
    >([]),
    flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flushAutomatic() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = undefined;
    }
    const queue = automaticQueue.current.splice(0);
    if (!queue.length) return;
    const next = structuredClone(catalogRef.current),
      seen = new Set(tracks.flatMap((t) => next.tracks[t]).map(fingerprint)),
      ids = new Set(tracks.flatMap((t) => next.tracks[t]).map((l) => l.id));
    for (const entry of queue) {
      const f = fingerprint(entry.level);
      if (seen.has(f) || (ids.has(entry.level.id) && !entry.replaceId))
        continue;
      if (entry.replaceId) {
        for (const t of tracks) {
          const i = next.tracks[t].findIndex((l) => l.id === entry.replaceId);
          if (i >= 0) {
            next.tracks[t].splice(i, 1);
            break;
          }
        }
        ids.delete(entry.replaceId);
      }
      if (seen.has(f) || ids.has(entry.level.id)) continue;
      seen.add(f);
      ids.add(entry.level.id);
      if (
        !next.pieceSets.some(
          (s) => s.id === entry.set.id && s.version === entry.set.version,
        )
      )
        next.pieceSets.push(entry.set);
      const t = entry.level.difficulty.label;
      next.tracks[t].push({
        ...entry.level,
        order: entry.replaceId ? entry.level.order : next.tracks[t].length + 1,
      });
    }
    for (const t of tracks) next.tracks[t].sort((a, b) => a.order - b.order);
    next.catalogRevision++;
    catalogRef.current = next;
    setCatalog(next);
    const last = queue[queue.length - 1];
    setLevel(last.level);
    setBoard(last.level.board);
    setSetId(`${last.set.id}@${last.set.version}`);
    setSolution(false);
    setResults(undefined);
    setMoves([]);
  }
  function startSilhouettes() {
    setHistory((h) => [...h.slice(-19), catalog]);
    setBusy(true);
    setAutomaticReport(undefined);
    setProgress(undefined);
    setPlaying(false);
    setMessage(
      "100 silüet bölüm üretiliyor. Maskeler korunarak her şekle ayrı envanter tasarlanıyor…",
    );
    spawn().postMessage({ type: "silhouette-series", catalog });
  }
  function upgradeDifficulty() {
    const count = tracks
      .flatMap((t) => catalog.tracks[t])
      .filter(
        (l) =>
          l.pieceSetId.startsWith("auto-") &&
          l.generation.method !== "automatic-2",
      ).length;
    if (!count) {
      setMessage("Eski ölçeğe ait otomatik bölüm yok.");
      return;
    }
    setHistory((h) => [...h.slice(-19), catalog]);
    setBusy(true);
    setAutomaticReport(undefined);
    setMessage(
      `${count} bölüm yeni ölçeğe uyarlanıyor; kimlikler ve önceki revizyonlar korunuyor.`,
    );
    spawn().postMessage({
      type: "upgrade-difficulty",
      seed: `upgrade-${Date.now().toString(36)}`,
      catalog,
    });
  }
  function startAutomatic(plan: Partial<Record<Track, number>>) {
    setHistory((h) => [...h.slice(-19), catalog]);
    setBusy(true);
    setAutomaticReport(undefined);
    setProgress(undefined);
    setPlaying(false);
    setMessage(
      "Otomatik üretim başladı. Seviyeye uygun parça setleri tasarlanıyor…",
    );
    spawn().postMessage({
      type: "automatic",
      plan,
      seed: `auto-${Date.now().toString(36)}`,
      catalog,
    });
  }
  const worker = useRef<Worker | null>(null),
    catalogRef = useRef(catalog),
    batchRef = useRef(false),
    hintRef = useRef(false),
    revalidateRef = useRef(false);
  catalogRef.current = catalog;
  const set =
    catalog.pieceSets.find((s) => `${s.id}@${s.version}` === setId) ??
    catalog.pieceSets[0];
  const currentSet = level
    ? (catalog.pieceSets.find(
        (s) => s.id === level.pieceSetId && s.version === level.pieceSetVersion,
      ) ?? set)
    : set;
  let configurationError = "";
  try {
    preflight(board, set, {
      ...defaultRules,
      allowRotations: set.allowRotations ?? true,
      allowReflections: set.allowReflections ?? false,
      solutionPolicy: settings.policy,
    });
  } catch (e) {
    configurationError = (e as Error).message;
  }
  function restoreDemo() {
    const demo = tracks
      .flatMap((t) => (bundledCatalog as unknown as Catalog).tracks[t])
      .find((l) => l.kind === "rectangle")!;
    setBoardId("rectangle");
    setBoard(boards.rectangle);
    setSetId("studio-rectangle@1");
    setSettings({ ...demo.generation });
    setLevel(undefined);
    setProgress(undefined);
    setMessage("6 × 5 demo ayarları hazır. Bölüm üret düğmesine basın.");
  }
  const total = tracks.reduce((n, t) => n + catalog.tracks[t].length, 0);
  useEffect(() => {
    loadWorkspace()
      .then((v) => {
        if (v) {
          setCatalog(v.catalog);
          const previous = tracks
            .flatMap((t) => v.catalog.tracks[t])
            .find((l) => l.kind === "rectangle");
          setLevel(previous);
          if (previous) {
            setBoard(previous.board);
            setSetId(`${previous.pieceSetId}@${previous.pieceSetVersion}`);
          }
          setMasks((v.masks ?? {}) as Record<string, Board>);
        }
        try {
          const p = localStorage.getItem("studio-settings");
          if (p) setSettings({ ...defaultSettings, ...JSON.parse(p) });
        } catch {}
        setReady(true);
      })
      .catch(() => {
        setSaved("Depolama açılamadı; JSON indirerek yedekleyin");
        setReady(true);
      });
    return () => {
      worker.current?.terminate();
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let valid = true;
    const saveTimer = setTimeout(() => {
      saveWorkspace(catalog, masks)
        .then(() => {
          if (valid)
            setSaved(
              `Kaydedildi · ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
            );
        })
        .catch(() => setSaved("Kayıt başarısız · JSON indirerek kurtarın"));
    }, 350);
    return () => {
      clearTimeout(saveTimer);
      valid = false;
    };
  }, [catalog, masks, ready]);
  useEffect(() => {
    try {
      localStorage.setItem("studio-settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);
  useEffect(() => {
    setResults(undefined);
    setGhost([]);
    setSelected("");
  }, [board, setId]);
  useEffect(() => {
    if (tab === "Silüet editörü") setMasks((m) => ({ ...m, [boardId]: board }));
  }, [board, boardId, tab]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      saveWorkspace(catalogRef.current, masks).catch(() =>
        setSaved("Ara kayıt başarısız; JSON indirerek yedekleyin"),
      );
    }, 3000);
    return () => clearInterval(timer);
  }, [busy, masks]);
  function changeCatalog(next: Catalog) {
    setHistory((h) => [...h.slice(-19), catalogRef.current]);
    setCatalog(next);
  }
  function spawn() {
    worker.current?.terminate();
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onerror = (e) => {
      setBusy(false);
      setMessage(`Worker hatası: ${e.message}`);
    };
    w.onmessage = ({ data }) => {
      if (data.type === "automatic-level") {
        automaticQueue.current.push({
          level: data.level,
          set: data.set,
          replaceId: data.replaceId,
        });
        if (!flushTimer.current)
          flushTimer.current = setTimeout(flushAutomatic, 120);
        return;
      }
      if (data.type === "automatic-progress") {
        setAutomaticReport(data.report);
        return;
      }
      if (data.type === "automatic-done") {
        flushAutomatic();
        if (data.silhouettes) {
          setCatalogKind("silhouette-series");
          setFilter("all");
          setCatalogPages({});
          setTab("Katalog");
        }
        setAutomaticReport(data.report);
        setBusy(false);
        setMessage(
          data.report.accepted === data.report.requested
            ? data.upgraded
              ? `${data.report.accepted} bölüm yeni zorluk ölçeğine göre revize edildi.`
              : `${data.report.accepted} bölüm üretildi ve kataloğa eklendi.`
            : `${data.report.requested} bölümden ${data.report.accepted} üretildi. Kalanlar ve red nedenleri raporda.`,
        );
        return;
      }

      if (data.type === "level") {
        setLevel(data.level);
        setSolution(false);
        setMoves([]);
        setResults(undefined);
        if (batchRef.current) {
          try {
            const next = addLevel(catalogRef.current, data.level);
            catalogRef.current = next;
            setCatalog(next);
          } catch (e) {
            setMessage((e as Error).message);
          }
        } else
          setMessage(
            "Bölüm üretildi. Çözümü inceleyip kataloğa ekleyebilirsiniz.",
          );
      }
      if (data.type === "progress") setProgress(data);
      if (data.type === "done") {
        setBusy(false);
        setMessage(
          data.accepted === 0
            ? `Bölüm üretilemedi. ${Object.keys(data.rejected ?? {})[0] ?? "Arama bütçesi doldu."}`
            : data.accepted < data.requested
              ? `${data.requested} bölüm istendi, ${data.accepted} üretildi. Ayrıntılar raporda.`
              : `${data.accepted} bölüm başarıyla üretildi.`,
        );
      }
      if (data.type === "error") {
        flushAutomatic();
        setBusy(false);
        setMessage(data.error);
      }
      if (data.type === "imported") {
        setBusy(false);
        setPending(data.catalog);
        setMessage("Dosya doğrulandı. Birleştirme veya değiştirme seçin.");
      }
      if (data.type === "solved") {
        setBusy(false);
        setResults(data.result);
        setSolutionIndex(0);
        if (revalidateRef.current) {
          revalidateRef.current = false;
          setMessage(
            `Yeniden doğrulama: ${data.result.classification}, ${data.result.stats.nodes} düğüm`,
          );
        } else if (hintRef.current) {
          hintRef.current = false;
          const next = data.result.solutions[0]?.find(
            (p: Placement) =>
              !level?.fixedPlacements.some((q) => q.pieceId === p.pieceId) &&
              !moves.some((q) => q.pieceId === p.pieceId),
          );
          if (next) setMoves((m) => [...m, next]);
          setMessage(
            next
              ? `${next.pieceId} parçası mevcut durumun tamamlanabilen çözümünden yerleştirildi.`
              : "Mevcut durum tamamlanamıyor veya sınır doldu; son hamleyi geri alın.",
          );
        } else
          setMessage(
            `Çözüm sınıfı: ${data.result.classification} · ${data.result.countIsExact ? "Kesin" : "En az"} ${data.result.solutionCount} çözüm`,
          );
      }
    };
    return w;
  }
  function generate(count = 1) {
    if (configurationError) {
      setProgress(undefined);
      setMessage(configurationError);
      return;
    }
    setBusy(true);
    setProgress(undefined);
    setMessage("Tam döşeme aranıyor, tekillik sınanıyor…");
    setPlaying(false);
    batchRef.current = count > 1;
    setAutoAdd(count > 1);
    if (count > 1) setHistory((h) => [...h.slice(-19), catalog]);
    spawn().postMessage({
      type: "generate",
      board,
      set,
      settings,
      count,
      existing: tracks.flatMap((t) => catalog.tracks[t]).map(fingerprint),
    });
  }
  function stop() {
    flushAutomatic();
    if (worker.current) worker.current.onmessage = null;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setMessage("İşlem durduruldu; kabul edilen bölümler korundu.");
  }
  function selectBoard(id: string) {
    setBoardId(id);
    setBoard(masks[id] ?? boards[id]);
    setSetId(`studio-${id}@1`);
    setLevel(undefined);
    setMaskUndo([]);
    setMaskRedo([]);
    setSelected("");
  }
  function inspect(l: Level) {
    setGenerationMode("manual");
    setRevisionTarget(l.id);
    setLevel(l);
    setBoard(l.board);
    setSetId(`${l.pieceSetId}@${l.pieceSetVersion}`);
    setSettings(l.generation);
    setSolution(false);
    setMoves([]);
    setResults(undefined);
    setPlaying(false);
    setTab("Üretici");
  }
  function solveCurrent(hint = false) {
    if (!level) return;
    setBusy(true);
    hintRef.current = hint;
    spawn().postMessage({
      type: "solve",
      board: level.board,
      set: currentSet,
      rules: level.rules,
      referenceSolution: level.referenceSolution,
      fixed: hint
        ? [...level.fixedPlacements, ...moves]
        : level.fixedPlacements,
    });
  }
  function place(origin: Cell) {
    if (!playing || !selected || !level) return;
    try {
      const piece = currentSet.pieces.find((p) => p.id === selected)!;
      if (level.fixedPlacements.some((p) => p.pieceId === selected))
        throw Error("Sabit parça taşınamaz");
      const opts = orientations(piece, level.rules),
        [orientationKey, cells] = opts[orientation % opts.length];
      const p: Placement = {
        pieceId: selected,
        orientationKey,
        origin,
        cells: cells.map(([x, y]) => [x + origin[0], y + origin[1]]),
      };
      const next = [...moves.filter((q) => q.pieceId !== selected), p];
      validatePlacements(level.board, currentSet, level.rules, [
        ...level.fixedPlacements,
        ...next,
      ]);
      setMoves(next);
      setGhost([]);
      setMessage(
        next.length + level.fixedPlacements.length === currentSet.pieces.length
          ? "Tebrikler! Tüm hücreler geçerli biçimde dolduruldu."
          : `${selected} yerleştirildi.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function updateMask(x: number, y: number) {
    const next = structuredClone(board);
    const row = [...next.mask[y]],
      v = row[x] === "1" ? "0" : "1";
    row[x] = v;
    if (mirror) row[board.width - 1 - x] = v;
    next.mask[y] = row.join("");
    next.templateId = board.templateId ?? "custom";
    next.shapeLabel = board.shapeLabel ?? "Özel silüet";
    setMaskUndo((h) => [...h, board]);
    setMaskRedo([]);
    setBoard(next);
    setLevel(undefined);
    setMasks((m) => ({ ...m, [boardId]: next }));
  }
  function saveSet() {
    try {
      const s = {
        ...editingSet,
        version:
          Math.max(
            0,
            ...catalog.pieceSets
              .filter((s) => s.id === editingSet.id)
              .map((s) => s.version),
          ) + 1,
        pieces: editingSet.pieces.map((p) => ({
          ...p,
          cells: normalize(p.cells),
        })),
      };
      validateSet(s, {
        ...defaultRules,
        allowRotations: s.allowRotations ?? true,
        allowReflections: s.allowReflections ?? false,
      });
      changeCatalog({
        ...catalog,
        pieceSets: [...catalog.pieceSets, s],
        catalogRevision: catalog.catalogRevision + 1,
      });
      setSetId(`${s.id}@${s.version}`);
      setEditingSet(s);
      setMessage(
        `Parça seti v${s.version} olarak kaydedildi. Eski referanslar korundu.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function importFile(file: File | undefined, pieces = false) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setMessage("Dosya sınırı 50 MB");
      return;
    }
    try {
      const value = JSON.parse(await file.text());
      if (pieces) {
        validateSet(value, {
          ...defaultRules,
          allowRotations: value.allowRotations ?? true,
          allowReflections: value.allowReflections ?? false,
        });
        setEditingSet(value);
        setEditingPiece(0);
        setMessage(
          "Parça seti doğrulandı; yeni sürüm olarak kaydedebilirsiniz.",
        );
        return;
      }
      setBusy(true);
      spawn().postMessage({ type: "import", catalog: value });
    } catch (e) {
      setMessage(`İçe aktarma: ${(e as Error).message}`);
    }
  }
  function exportCatalog(player = false) {
    if (busy) {
      setMessage(
        "Dışa aktarmadan önce üretimin tamamlanmasını bekleyin veya durdurun.",
      );
      return;
    }
    setBusy(true);
    const w = spawn();
    const previous = w.onmessage;
    w.onmessage = (e) => {
      if (e.data.type === "imported") {
        setBusy(false);
        download(
          serialize(e.data.catalog, player),
          player ? "player-catalog.json" : "admin-catalog.json",
        );
        setMessage("Katalog yeniden doğrulandı ve indirildi.");
      } else previous?.call(w, e);
    };
    w.postMessage({ type: "import", catalog });
  }
  function mergeImport() {
    if (!pending) return;
    try {
      let next = structuredClone(catalog);
      for (const s of pending.pieceSets) {
        const old = next.pieceSets.find(
          (p) => p.id === s.id && p.version === s.version,
        );
        if (old && JSON.stringify(old) !== JSON.stringify(s))
          throw Error(`Set sürümü çakışması: ${s.id}@${s.version}`);
        if (!old) next.pieceSets.push(s);
      }
      for (const t of tracks)
        for (const l of pending.tracks[t]) next = addLevel(next, l);
      changeCatalog(next);
      setPending(undefined);
      setMessage("Doğrulanmış katalog birleştirildi.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function mutateLevel(
    id: string,
    fn: (l: Level, t: Track, i: number, c: Catalog) => void,
  ) {
    const next = structuredClone(catalog);
    for (const t of tracks) {
      const i = next.tracks[t].findIndex((l) => l.id === id);
      if (i >= 0) {
        fn(next.tracks[t][i], t, i, next);
        break;
      }
    }
    for (const t of tracks) next.tracks[t].forEach((l, i) => (l.order = i + 1));
    next.catalogRevision++;
    changeCatalog(next);
  }
  const shownBoard = level && tab === "Üretici" ? level.board : board;
  const shownSet = level && tab === "Üretici" ? currentSet : set;
  const shownPlacements = level
    ? playing
      ? [...level.fixedPlacements, ...moves]
      : solution
        ? (
            results?.solutions[solutionIndex] ??
            level.referenceSolution ??
            []
          ).slice(0, step)
        : level.fixedPlacements
    : [];
  const field = (key: keyof Settings, value: string | number | boolean) =>
    setSettings((s) => ({ ...s, [key]: value }));
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">✣</span>
          <span>
            shape<span className="brand-light"> / studio</span>
          </span>
        </a>
        <div className="workspace-label">İÇERİK ÇALIŞMA ALANI</div>
        <nav>
          {[
            ["Üretici", "◫"],
            ["Katalog", "▤"],
            ["Parça setleri", "◈"],
            ["Silüet editörü", "⬡"],
          ].map(([t, icon]) => (
            <button
              key={t}
              className={tab === t ? "nav active" : "nav"}
              onClick={() => setTab(t)}
            >
              <span>{icon}</span>
              {t}
              {t === "Katalog" && <small>{total}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="green-dot" /> Yalnızca bu cihazda
          <p>
            Fikirden oynanabilir bir bulmacaya.
            <br />
            Çalışmalarınız yerelde saklanır.
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">S</div>
          <div>
            Studio çalışma alanı<small>Yerel · v{VERSION}</small>
          </div>
          <span>⌘</span>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="breadcrumb">
            Çalışma alanı <span>/</span> <b>{tab}</b>
          </div>
          <div className="header-actions">
            <span className="save-state">
              <span className="green-dot" />
              {saved}
            </span>
            <button className="small" onClick={() => exportCatalog()}>
              ↗ JSON dışa aktar
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">SHAPE PUZZLE STUDIO</div>
              <h1>
                {tab === "Üretici"
                  ? "Bir sonraki bulmacanı oluştur."
                  : tab === "Katalog"
                    ? "Bölüm koleksiyonun."
                    : tab === "Parça setleri"
                      ? "Her parça bir olasılık."
                      : "Şekle bir hikâye ver."}
              </h1>
              <p>
                {tab === "Üretici"
                  ? "Parçaları bir araya getir, olasılıkları keşfet. Doğrulanmış bölümler üret."
                  : tab === "Katalog"
                    ? "Doğrulanmış bölümleri düzenle, sırala ve oyuncuların için dışa aktar."
                    : tab === "Parça setleri"
                      ? "Hücrelerden özgün parçalar tasarla. Her değişiklik yeni bir sürümde saklanır."
                      : "Silüetini çiz, alanı kontrol et ve ona uygun parça setini oluştur."}
              </p>
            </div>
            <span className="subtle-tag">✧ 2D parça yerleştirme</span>
          </div>
          <div className="status" role="status" aria-live="polite">
            <span>{busy ? "◌" : "↳"}</span>
            {message}
            {busy && (
              <button className="small" onClick={stop}>
                İşlemi durdur
              </button>
            )}
          </div>
          {revisionConfirm && level && (
            <section className="import-banner">
              <b>Revizyon önizlemesi</b>
              <p>
                {revisionTarget} bölümü, {level.id} adayı ile değiştirilecek.
                Kalıcı kimlik ve önceki revizyon geçmişi korunur; geri al
                kullanılabilir.
              </p>
              <button
                onClick={() => {
                  try {
                    if (
                      tracks
                        .flatMap((t) => catalog.tracks[t])
                        .some(
                          (l) =>
                            l.id !== revisionTarget &&
                            fingerprint(l) === fingerprint(level),
                        )
                    )
                      throw Error("Bu oynanabilir bölüm katalogda zaten var");
                    mutateLevel(revisionTarget!, (old, t, i, c) => {
                      c.tracks[t][i] = {
                        ...level,
                        id: old.id,
                        order: old.order,
                        revision: old.revision + 1,
                        difficulty: {
                          ...level.difficulty,
                          ...(t !== level.difficulty.label
                            ? { manualLabel: t }
                            : {}),
                        },
                        revisionHistory: [
                          ...(old.revisionHistory ?? []),
                          { ...old, revisionHistory: undefined },
                        ],
                      };
                    });
                    setRevisionConfirm(false);
                    setMessage(
                      "Yeni revizyon kaydedildi; kalıcı kimlik ve geçmiş korundu.",
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Revizyonu onayla
              </button>
              <button onClick={() => setRevisionConfirm(false)}>Vazgeç</button>
            </section>
          )}
          {pending && (
            <section className="import-banner">
              <b>Doğrulama başarılı · İçe aktarma önizlemesi</b>
              <p>
                {tracks.flatMap((t) => pending.tracks[t]).length} bölüm,{" "}
                {pending.pieceSets.length} set sürümü. Mevcut çalışma henüz
                değiştirilmedi.
              </p>
              <button onClick={mergeImport}>Birleştir</button>
              <button
                onClick={() => {
                  changeCatalog(pending);
                  setPending(undefined);
                  setLevel(undefined);
                  setSolution(false);
                  setResults(undefined);
                  setRevisionTarget(undefined);
                  setMessage("Doğrulanmış katalog çalışma alanına alındı.");
                }}
              >
                Mevcut kataloğu değiştir
              </button>
              <button onClick={() => setPending(undefined)}>Vazgeç</button>
            </section>
          )}
          {tab === "Üretici" && (
            <>
              <div className="studio-grid">
                <section className="panel settings">
                  {generationMode === "automatic" ? (
                    <AutomaticControls
                      busy={busy}
                      onRun={startAutomatic}
                      onUpgrade={upgradeDifficulty}
                      onSilhouettes={startSilhouettes}
                      onManual={() => setGenerationMode("manual")}
                    />
                  ) : (
                    <>
                      <button
                        className="text-button"
                        onClick={() => setGenerationMode("automatic")}
                      >
                        ← Otomatik üretime dön
                      </button>
                      <div className="panel-title">
                        <h2>Üretim ayarları</h2>
                        <span>01</span>
                      </div>
                      <button className="text-button" onClick={restoreDemo}>
                        ↶ Çalışan demo ayarlarına dön
                      </button>
                      <label>Zorluk hattı</label>
                      <div className="track-select">
                        {tracks.map((t) => (
                          <button
                            key={t}
                            className={settings.track === t ? "chosen" : ""}
                            title={t}
                            onClick={() => field("track", t)}
                          >
                            {names[t]}
                          </button>
                        ))}
                      </div>
                      <label htmlFor="board">Tahta şablonu</label>
                      <select
                        id="board"
                        value={boardId}
                        onChange={(e) => selectBoard(e.target.value)}
                      >
                        {Object.keys(boards).map((id) => (
                          <option key={id} value={id}>
                            {boardNames[id]}{" "}
                            {id === "rectangle" ? "· Standart" : "· Özel"}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="set">Parça seti / sürüm</label>
                      <select
                        id="set"
                        value={setId}
                        onChange={(e) => {
                          setSetId(e.target.value);
                          setLevel(undefined);
                          setSelected("");
                        }}
                      >
                        {catalog.pieceSets.map((s) => (
                          <option
                            key={`${s.id}@${s.version}`}
                            value={`${s.id}@${s.version}`}
                          >
                            {s.id} · v{s.version}
                          </option>
                        ))}
                      </select>
                      <div className="two-fields">
                        <div>
                          <label htmlFor="width">Genişlik</label>
                          <input
                            id="width"
                            type="number"
                            min="1"
                            max="20"
                            disabled={boardId !== "rectangle"}
                            value={board.width}
                            onChange={(e) => {
                              const width = Math.max(
                                1,
                                Math.min(20, +e.target.value),
                              );
                              setBoard((b) => ({
                                ...b,
                                width,
                                mask: Array(b.height).fill("1".repeat(width)),
                              }));
                              setLevel(undefined);
                            }}
                          />
                        </div>
                        <div>
                          <label htmlFor="height">Yükseklik</label>
                          <input
                            id="height"
                            type="number"
                            min="1"
                            max="20"
                            disabled={boardId !== "rectangle"}
                            value={board.height}
                            onChange={(e) => {
                              const height = Math.max(
                                1,
                                Math.min(20, +e.target.value),
                              );
                              setBoard((b) => ({
                                ...b,
                                height,
                                mask: Array(height).fill("1".repeat(b.width)),
                              }));
                              setLevel(undefined);
                            }}
                          />
                        </div>
                      </div>
                      <div className="area-line">
                        <span>Aktif alan</span>
                        <b>{active(board).length} hücre</b>
                        <span> / </span>
                        <b>
                          {set.pieces.reduce((n, p) => n + p.cells.length, 0)}{" "}
                          parça alanı
                        </b>
                      </div>
                      {configurationError && (
                        <div className="configuration-error" role="alert">
                          <b>{configurationError}</b>
                          <p>
                            Tahta boyutunu değiştirmek parça setini büyütmez. Bu
                            set için 6 × 5 demo tahtasını kullanın veya yeni
                            alana uygun bir parça seti tasarlayın.
                          </p>
                          <button onClick={restoreDemo}>
                            6 × 5 demo ayarlarını uygula
                          </button>
                        </div>
                      )}
                      <label htmlFor="seed">
                        Üretim tohumu{" "}
                        <button
                          className="text-button"
                          onClick={() =>
                            field("seed", `studio-${Date.now().toString(36)}`)
                          }
                        >
                          ↻ Değiştir
                        </button>
                      </label>
                      <input
                        id="seed"
                        className="mono"
                        value={settings.seed}
                        onChange={(e) => field("seed", e.target.value)}
                      />
                      <div className="two-fields">
                        <div>
                          <label htmlFor="fixed">Sabit parça hedefi</label>
                          <input
                            id="fixed"
                            type="number"
                            min="0"
                            max={set.pieces.length - 1}
                            value={settings.fixedCount}
                            onChange={(e) =>
                              field("fixedCount", +e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="policy">Çözüm politikası</label>
                          <select
                            id="policy"
                            value={settings.policy}
                            onChange={(e) => field("policy", e.target.value)}
                          >
                            <option value="unique">Tek çözüm</option>
                            <option value="any-valid">Her geçerli çözüm</option>
                          </select>
                        </div>
                      </div>
                      <details>
                        <summary>Arama bütçeleri</summary>
                        <div className="two-fields">
                          <label>
                            Seri sabit min
                            <input
                              type="number"
                              min="0"
                              max={set.pieces.length - 1}
                              value={settings.fixedMin ?? settings.fixedCount}
                              onChange={(e) =>
                                field("fixedMin", +e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Seri sabit max
                            <input
                              type="number"
                              min="0"
                              max={set.pieces.length - 1}
                              value={settings.fixedMax ?? settings.fixedCount}
                              onChange={(e) =>
                                field("fixedMax", +e.target.value)
                              }
                            />
                          </label>
                        </div>
                        {(
                          [
                            ["nodeLimit", "Düğüm sınırı"],
                            ["attemptLimit", "Toplam deneme sınırı"],
                            ["timeLimit", "Güvenlik süresi (ms)"],
                          ] as const
                        ).map(([k, l]) => (
                          <label key={k}>
                            {l}
                            <input
                              type="number"
                              min="1"
                              value={settings[k]}
                              onChange={(e) =>
                                field(k, Math.max(1, +e.target.value))
                              }
                            />
                          </label>
                        ))}
                      </details>
                      <button
                        className="primary full"
                        disabled={busy || !!configurationError}
                        onClick={() => generate()}
                      >
                        ✧ Bölüm üret <span>↗</span>
                      </button>
                      <div className="batch-control">
                        <input
                          aria-label="Seri üretim adedi"
                          type="number"
                          min="1"
                          max="100"
                          value={batch}
                          onChange={(e) =>
                            setBatch(
                              Math.max(1, Math.min(100, +e.target.value)),
                            )
                          }
                        />
                        <button
                          disabled={busy || !!configurationError}
                          onClick={() => generate(batch)}
                        >
                          Seri üret
                        </button>
                        {busy && <button onClick={stop}>Durdur</button>}
                      </div>
                    </>
                  )}
                </section>
                <section className="panel preview">
                  <div className="panel-title">
                    <h2>
                      Tahta önizlemesi{" "}
                      <span className="pill">
                        {shownBoard.shapeLabel ?? "Standart"}
                      </span>
                    </h2>
                    <button
                      className={grid ? "icon-button toggled" : "icon-button"}
                      onClick={() => setGrid(!grid)}
                      title="Kare hücre katmanını aç"
                    >
                      ▦
                    </button>
                  </div>
                  <div className="preview-topline">
                    <span className="mono">
                      {shownBoard.width} × {shownBoard.height}
                    </span>
                    <span>
                      <span className="green-dot" />
                      {level ? "Doğrulanmış bölüm" : "Üretime hazır alan"}
                    </span>
                  </div>
                  <div
                    className="board-stage"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!selected || !playing) return;
                      const svg = e.currentTarget.querySelector("svg");
                      if (!svg) return;
                      const matrix = svg.getScreenCTM();
                      if (!matrix) return;
                      const point = new DOMPoint(
                        e.clientX,
                        e.clientY,
                      ).matrixTransform(matrix.inverse());
                      const x = Math.round((point.x - 20) / 48),
                        y = Math.round((point.y - 20) / 48);
                      const p = currentSet.pieces.find(
                        (p) => p.id === selected,
                      );
                      if (p) {
                        const opts = orientations(
                          p,
                          level?.rules ?? defaultRules,
                        );
                        setGhost(
                          opts[orientation % opts.length][1].map(([a, b]) => [
                            a + x,
                            b + y,
                          ]),
                        );
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const svg = e.currentTarget.querySelector("svg");
                      if (!svg) return;
                      const matrix = svg.getScreenCTM();
                      if (!matrix) return;
                      const point = new DOMPoint(
                        e.clientX,
                        e.clientY,
                      ).matrixTransform(matrix.inverse());
                      place([
                        Math.round((point.x - 20) / 48),
                        Math.round((point.y - 20) / 48),
                      ]);
                    }}
                  >
                    <BoardView
                      board={shownBoard}
                      set={shownSet}
                      placements={shownPlacements}
                      fixed={level?.fixedPlacements}
                      grid={grid}
                      mono={mono}
                      selected={selected}
                      ghost={ghost}
                      invalid={ghost.some(
                        ([x, y]) =>
                          shownBoard.mask[y]?.[x] !== "1" ||
                          shownPlacements.some(
                            (p) =>
                              p.pieceId !== selected &&
                              p.cells.some(([a, b]) => a === x && b === y),
                          ),
                      )}
                      onCell={playing ? place : undefined}
                    />
                    {!level && (
                      <div className="empty-board-label">
                        Olasılıklarla dolu bir başlangıç.
                      </div>
                    )}
                  </div>
                  <div className="board-toolbar">
                    <button
                      disabled={!level}
                      className={solution ? "toggled" : ""}
                      onClick={() => {
                        setPlaying(false);
                        setSolution(!solution);
                      }}
                    >
                      ◉ {solution ? "Çözümü gizle" : "Çözümü göster"}
                    </button>
                    <button
                      disabled={!level}
                      className={playing ? "toggled" : ""}
                      onClick={() => {
                        setPlaying(!playing);
                        setSolution(false);
                        setSelected("");
                      }}
                    >
                      ▷ Bölümü dene
                    </button>
                    <button
                      onClick={() => setMono(!mono)}
                      title="Tek renk silüet"
                    >
                      ◐
                    </button>
                  </div>
                  {solution && level && (
                    <div className="step-control">
                      <label>
                        Arama yerleştirme sırası{" "}
                        <input
                          aria-label="Gösterilen çözüm adımı"
                          type="range"
                          min="0"
                          max={currentSet.pieces.length}
                          value={Math.min(step, currentSet.pieces.length)}
                          onChange={(e) => setStep(+e.target.value)}
                        />
                      </label>
                      <small>İnsan mantığıyla çözüm açıklaması değildir.</small>
                    </div>
                  )}
                  <div className="inventory">
                    <div className="section-label">
                      {playing ? "YERLEŞTİRİLECEK PARÇALAR" : "PARÇA ENVANTERİ"}
                      <span>{shownSet.pieces.length} parça</span>
                    </div>
                    <div className="piece-list">
                      {shownSet.pieces.map((p) => (
                        <button
                          key={p.id}
                          draggable={
                            playing &&
                            !level?.fixedPlacements.some(
                              (q) => q.pieceId === p.id,
                            )
                          }
                          onDragEnd={() => setGhost([])}
                          onDragStart={() => {
                            setSelected(p.id);
                            setOrientation(0);
                          }}
                          className={
                            selected === p.id
                              ? "piece-chip selected"
                              : "piece-chip"
                          }
                          onClick={() => {
                            setSelected(p.id);
                            setOrientation(0);
                          }}
                          style={
                            { "--piece-color": p.color } as React.CSSProperties
                          }
                        >
                          <svg
                            viewBox={`-0.5 -0.5 ${Math.max(...p.cells.map((c) => c[0])) + 1} ${Math.max(...p.cells.map((c) => c[1])) + 1}`}
                          >
                            {p.cells.map(([x, y]) => (
                              <circle
                                key={`${x},${y}`}
                                cx={x}
                                cy={y}
                                r=".43"
                                fill={p.color}
                              />
                            ))}
                          </svg>
                          <span>{p.symbol}</span>
                          {level?.fixedPlacements.some(
                            (q) => q.pieceId === p.id,
                          ) && <small>⌑</small>}
                        </button>
                      ))}
                    </div>
                    {selected &&
                      currentSet.pieces.some((p) => p.id === selected) && (
                        <small className="piece-detail">
                          {selected} ·{" "}
                          {
                            currentSet.pieces.find((p) => p.id === selected)
                              ?.cells.length
                          }{" "}
                          hücre ·{" "}
                          {
                            orientations(
                              currentSet.pieces.find((p) => p.id === selected)!,
                              level?.rules ?? defaultRules,
                            ).length
                          }{" "}
                          izinli yönelim
                        </small>
                      )}
                    {playing && (
                      <div className="play-controls">
                        <button onClick={() => setOrientation((o) => o + 1)}>
                          ↻ Yönelim ({orientation + 1})
                        </button>
                        <button onClick={() => setMoves((m) => m.slice(0, -1))}>
                          Geri al
                        </button>
                        <button onClick={() => setMoves([])}>Sıfırla</button>
                        <button
                          disabled={busy}
                          onClick={() => solveCurrent(true)}
                        >
                          ✧ İpucu
                        </button>
                        <small>
                          Parçayı sürükleyin veya seçip tahta hücresine
                          tıklayın. Klavyeyle hücreye odaklanıp Enter
                          kullanabilirsiniz. Yansıtma:{" "}
                          {level?.rules.allowReflections ? "açık" : "kapalı"}.
                        </small>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="panel information">
                  <div className="panel-title">
                    <h2>Bölüm bilgisi</h2>
                    <span>↗</span>
                  </div>
                  <div className="validation-badge">
                    <span>✓</span>
                    <div>
                      {level
                        ? level.validation.classification === "unique"
                          ? "Tek çözüm doğrulandı"
                          : "Geçerli çözüm doğrulandı"
                        : "Üretim bekleniyor"}
                      <small>
                        {level
                          ? "Bağımsız kapsama kontrolü geçti"
                          : "Çözücü henüz çalıştırılmadı"}
                      </small>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Bölüm kimliği</dt>
                      <dd className="mono">{level?.id ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Tahmini zorluk</dt>
                      <dd>
                        {level ? names[level.difficulty.label] : "—"}{" "}
                        {level && (
                          <span className="score">
                            {level.difficulty.estimatedScore}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Sabit / kalan parça</dt>
                      <dd>
                        {level
                          ? `${level.fixedPlacements.length} / ${currentSet.pieces.length - level.fixedPlacements.length}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Çözüm sayısı</dt>
                      <dd>
                        {level
                          ? `${level.validation.countIsExact ? "" : "En az "}${level.validation.solutionCount}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Aranan düğüm</dt>
                      <dd className="mono">
                        {level?.difficulty.metrics.nodes ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Geri dönüş</dt>
                      <dd className="mono">
                        {level?.difficulty.metrics.backtracks ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="info-note">
                    ⓘ Zorluk puanı tahminidir. Tahta simetrileri ayrı çözümler
                    olarak sayılır.
                  </div>
                  <button
                    className="primary full"
                    disabled={!level}
                    onClick={() => {
                      try {
                        changeCatalog(addLevel(catalog, level!));
                        setMessage("Bölüm kataloğa eklendi.");
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    ＋ Kataloğa ekle
                  </button>
                  <button
                    className="full"
                    disabled={!level || !revisionTarget}
                    onClick={() => {
                      if (!level || !revisionTarget) return;
                      setRevisionConfirm(true);
                    }}
                  >
                    Seçili bölümü revizyonla değiştir
                  </button>
                  <button
                    className="full"
                    disabled={!level || busy}
                    onClick={() => solveCurrent()}
                  >
                    Çözümleri incele / doğrula
                  </button>
                  {results && level && (
                    <div className="solution-nav">
                      <button
                        disabled={!solutionIndex}
                        onClick={() => setSolutionIndex((i) => i - 1)}
                      >
                        ←
                      </button>
                      <span>
                        {solutionIndex + 1} / {results.solutions.length}
                      </span>
                      <button
                        disabled={solutionIndex >= results.solutions.length - 1}
                        onClick={() => {
                          setSolutionIndex((i) => i + 1);
                          setSolution(true);
                        }}
                      >
                        →
                      </button>
                    </div>
                  )}
                  <button
                    className="text-button"
                    disabled={!level}
                    onClick={() =>
                      level &&
                      download(
                        JSON.stringify(level, null, 2),
                        `${level.id}.json`,
                      )
                    }
                  >
                    ↓ Bu bölümü indir
                  </button>
                  <div className="tip-card">
                    <div>ATÖLYE NOTU</div>
                    <p>İyi bir bulmaca, küçük bir keşif hissiyle başlar.</p>
                    <span>◌ ◌ ◌</span>
                  </div>
                </aside>
              </div>
              {automaticReport && (
                <section className="panel report">
                  <h2>Otomatik üretim raporu</h2>
                  <p>
                    {automaticReport.accepted} / {automaticReport.requested}{" "}
                    bölüm · {automaticReport.attempt} aday ·{" "}
                    {(automaticReport.elapsed / 1000).toFixed(1)} saniye
                  </p>
                  <div className="auto-counts">
                    {tracks.map((t) => (
                      <span key={t}>
                        {names[t]} <b>{automaticReport.counts[t]}</b>
                      </span>
                    ))}
                  </div>
                  {busy && <button onClick={stop}>Üretimi durdur</button>}
                  <details>
                    <summary>Red nedenlerini göster</summary>
                    {Object.entries(automaticReport.rejected).map(
                      ([reason, n]) => (
                        <p key={reason}>
                          {n} · {reason}
                        </p>
                      ),
                    )}
                  </details>
                </section>
              )}
              {progress && (
                <section className="panel report">
                  <h2>
                    Üretim raporu{" "}
                    {autoAdd &&
                      progress.accepted > 0 &&
                      "· Kabul edilenler kataloğa eklendi"}
                  </h2>
                  <p>
                    {progress.attempt} aday · {progress.accepted} kabul ·{" "}
                    {(progress.elapsed / 1000).toFixed(2)} saniye
                  </p>
                  {Object.entries(progress.rejected).map(([reason, n]) => (
                    <p key={reason}>
                      {n} red — {reason}
                    </p>
                  ))}
                </section>
              )}
              <section className="quick-catalog">
                <div>
                  <h2>
                    Kataloğa bir bakış{" "}
                    <span className="pill">{total} bölüm</span>
                  </h2>
                  <p>Bir sonraki keşif burada başlıyor.</p>
                </div>
                <button onClick={() => setTab("Katalog")}>
                  Tüm kataloğu gör →
                </button>
              </section>
              <div className="track-summary">
                {tracks.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilter(t);
                      setTab("Katalog");
                    }}
                  >
                    <span className={`track-dot ${t}`} />
                    <span>{names[t]}</span>
                    <strong>
                      {catalog.tracks[t].length.toString().padStart(2, "0")}
                    </strong>
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "Katalog" && (
            <>
              <section className="panel catalog-toolbar">
                <div className="catalog-kind">
                  <label htmlFor="catalog-kind">
                    Bölüm türü
                    <select
                      id="catalog-kind"
                      value={catalogKind}
                      onChange={(e) => {
                        setCatalogKind(e.target.value as CatalogKind);
                        setCatalogPages({});
                      }}
                    >
                      <option value="all">Bütün bölümler</option>
                      <option value="rectangle">Dikdörtgenler</option>
                      <option value="silhouette">Tüm silüetler</option>
                      <option value="silhouette-series">
                        Yeni 100 silüetlik seri
                      </option>
                    </select>
                  </label>
                </div>
                <div className="tabs">
                  <button
                    className={filter === "all" ? "chosen" : ""}
                    onClick={() => setFilter("all")}
                  >
                    Tümü ({viewTotal})
                  </button>
                  {tracks.map((t) => (
                    <button
                      key={t}
                      className={filter === t ? "chosen" : ""}
                      onClick={() => setFilter(t)}
                    >
                      {names[t]} ({viewCatalog.tracks[t].length})
                    </button>
                  ))}
                </div>
                <div className="toolbar">
                  <label className="button">
                    ↑ JSON yükle
                    <input
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={(e) => importFile(e.target.files?.[0])}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      spawn().postMessage({
                        type: "import",
                        catalog: bundledCatalog,
                      });
                    }}
                  >
                    Demo kataloğunu yükle
                  </button>
                  <button onClick={() => exportCatalog()}>Admin JSON</button>
                  <button onClick={() => exportCatalog(true)}>
                    Oyuncu JSON
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(serialize(catalog))
                        .then(() => setMessage("Katalog panoya kopyalandı."))
                        .catch(() =>
                          setMessage("Pano kullanılamıyor; JSON indirin."),
                        )
                    }
                  >
                    Kopyala
                  </button>
                  <button
                    disabled={busy || !history.length}
                    onClick={() => {
                      setCatalog(history[history.length - 1]);
                      setHistory((h) => h.slice(0, -1));
                      setMessage("Son katalog işlemi geri alındı.");
                    }}
                  >
                    ↶ Geri al
                  </button>
                  <button
                    onClick={() => {
                      const n = Number(
                        prompt("Her kaç standart bölümden sonra silüet?", "15"),
                      );
                      if (!Number.isInteger(n) || n < 1) return;
                      const next = structuredClone(catalog);
                      let shortage = 0;
                      for (const t of tracks) {
                        const standard = next.tracks[t].filter(
                            (l) => l.kind === "rectangle",
                          ),
                          special = next.tracks[t].filter(
                            (l) => l.kind === "silhouette",
                          ),
                          out: Level[] = [];
                        for (let i = 0; i < standard.length; i++) {
                          out.push(standard[i]);
                          if ((i + 1) % n === 0) {
                            if (special.length) out.push(special.shift()!);
                            else shortage++;
                          }
                        }
                        out.push(...special);
                        out.forEach((l, i) => (l.order = i + 1));
                        next.tracks[t] = out;
                      }
                      changeCatalog(next);
                      setMessage(
                        shortage
                          ? `${shortage} özel bölüm eksik; mevcut bölümler sıralandı.`
                          : "Özel bölüm ritmi uygulandı.",
                      );
                    }}
                  >
                    Özel bölüm ritmi
                  </button>
                </div>
              </section>
              <section
                className="panel bulk-toolbar"
                aria-label="Toplu bölüm işlemleri"
              >
                <div className="bulk-selection">
                  <b>{selectedLevelIds.size} bölüm seçili</b>
                  <button
                    disabled={busy}
                    onClick={() =>
                      selectLevels(
                        pageLevels(
                          viewCatalog,
                          filter as Track | "all",
                          catalogPages,
                        ).map((l) => l.id),
                      )
                    }
                  >
                    Bu sayfayı seç
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      selectLevels(
                        filteredLevels(
                          viewCatalog,
                          filter as Track | "all",
                        ).map((l) => l.id),
                      )
                    }
                  >
                    Filtredekilerin tümünü seç (
                    {
                      filteredLevels(viewCatalog, filter as Track | "all")
                        .length
                    }
                    )
                  </button>
                  <button
                    disabled={!selectedLevelIds.size}
                    onClick={() => setSelectedLevelIds(new Set())}
                  >
                    Seçimi temizle
                  </button>
                </div>
                <div className="bulk-actions">
                  <button
                    className="danger"
                    disabled={busy || !selectedLevelIds.size}
                    onClick={deleteSelection}
                  >
                    Seçilenleri sil ({selectedLevelIds.size})
                  </button>
                  <label htmlFor="bulk-track">Seçilenleri taşı</label>
                  <select
                    id="bulk-track"
                    value={bulkTrack}
                    disabled={busy}
                    onChange={(e) => setBulkTrack(e.target.value as Track)}
                  >
                    {tracks.map((t) => (
                      <option key={t} value={t}>
                        {names[t]}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy || !selectedLevelIds.size}
                    onClick={moveSelection}
                  >
                    Taşı
                  </button>
                </div>
                <p>
                  Seçimler sayfalar ve filtreler arasında korunur. Silme ve
                  taşıma işlemleri “Geri al” ile geri alınabilir.
                </p>
              </section>
              <div className="catalog-list">
                {tracks
                  .filter((t) => filter === "all" || filter === t)
                  .map((t) => (
                    <section key={t}>
                      <div className="catalog-section-title">
                        <h2>
                          <span className={`track-dot ${t}`} />
                          {names[t]}
                        </h2>
                        <span>{viewCatalog.tracks[t].length} bölüm</span>
                      </div>
                      {!viewCatalog.tracks[t].length ? (
                        <div className="catalog-empty">
                          Bu hatta henüz bölüm yok. Üreticide yeni bir bulmaca
                          oluşturun.
                        </div>
                      ) : (
                        viewCatalog.tracks[t]
                          .slice(
                            pageIndex(
                              viewCatalog.tracks[t].length,
                              catalogPages[t],
                            ) * 20,
                            (pageIndex(
                              viewCatalog.tracks[t].length,
                              catalogPages[t],
                            ) +
                              1) *
                              20,
                          )
                          .map((l) => {
                            const s = catalog.pieceSets.find(
                              (s) =>
                                s.id === l.pieceSetId &&
                                s.version === l.pieceSetVersion,
                            )!;
                            return (
                              <article
                                className={`catalog-row${selectedLevelIds.has(l.id) ? " row-selected" : ""}`}
                                key={l.id}
                              >
                                <input
                                  className="row-checkbox"
                                  type="checkbox"
                                  aria-label={`${l.id} bölümünü seç`}
                                  checked={selectedLevelIds.has(l.id)}
                                  disabled={busy}
                                  onChange={(e) =>
                                    setSelectedLevelIds((previous) => {
                                      const next = new Set(previous);
                                      if (e.target.checked) next.add(l.id);
                                      else next.delete(l.id);
                                      return next;
                                    })
                                  }
                                />

                                <span className="order mono">
                                  {String(l.order).padStart(2, "0")}
                                </span>
                                <div
                                  className={
                                    l.kind === "silhouette"
                                      ? "mini-board silhouette-pair"
                                      : "mini-board"
                                  }
                                >
                                  {l.kind === "silhouette" && (
                                    <MaskThumbnail board={l.board} />
                                  )}
                                  <BoardView
                                    board={l.board}
                                    set={s}
                                    placements={
                                      l.referenceSolution ?? l.fixedPlacements
                                    }
                                    fixed={l.fixedPlacements}
                                  />
                                </div>
                                <div className="level-name">
                                  <b>
                                    {l.board.shapeLabel ?? "Dikdörtgen"}{" "}
                                    <small>· r{l.revision}</small>
                                  </b>
                                  <span className="mono">{l.id}</span>
                                  <small>
                                    {l.generation.seed} · {l.pieceSetId}@
                                    {l.pieceSetVersion}
                                  </small>
                                </div>
                                <div>
                                  <span className="validated">
                                    ✓{" "}
                                    {l.validation.classification ===
                                      "unknown" &&
                                    l.validation.solutionCount > 0
                                      ? "Çözüm doğrulandı"
                                      : l.validation.classification}
                                  </span>
                                  <small className="block">
                                    Tahmini puan {l.difficulty.estimatedScore}
                                    {l.difficulty.manualLabel
                                      ? " · Manuel hat"
                                      : ""}
                                  </small>
                                </div>
                                <div className="row-actions">
                                  <button
                                    title="Yukarı taşı"
                                    onClick={() =>
                                      mutateLevel(l.id, (_, tr, i, c) => {
                                        if (i > 0)
                                          [
                                            c.tracks[tr][i - 1],
                                            c.tracks[tr][i],
                                          ] = [
                                            c.tracks[tr][i],
                                            c.tracks[tr][i - 1],
                                          ];
                                      })
                                    }
                                  >
                                    ↑
                                  </button>
                                  <button
                                    title="Aşağı taşı"
                                    onClick={() =>
                                      mutateLevel(l.id, (_, tr, i, c) => {
                                        if (i < c.tracks[tr].length - 1)
                                          [
                                            c.tracks[tr][i + 1],
                                            c.tracks[tr][i],
                                          ] = [
                                            c.tracks[tr][i],
                                            c.tracks[tr][i + 1],
                                          ];
                                      })
                                    }
                                  >
                                    ↓
                                  </button>
                                  <select
                                    aria-label="Bölümü hatta taşı"
                                    value={t}
                                    onChange={(e) =>
                                      mutateLevel(l.id, (item, tr, i, c) => {
                                        c.tracks[tr].splice(i, 1);
                                        item.difficulty.manualLabel = e.target
                                          .value as Track;
                                        c.tracks[e.target.value as Track].push(
                                          item,
                                        );
                                      })
                                    }
                                  >
                                    {tracks.map((tr) => (
                                      <option key={tr} value={tr}>
                                        {names[tr]}
                                      </option>
                                    ))}
                                  </select>
                                  <button onClick={() => inspect(l)}>
                                    İncele
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBusy(true);
                                      revalidateRef.current = true;
                                      spawn().postMessage({
                                        type: "solve",
                                        board: l.board,
                                        set: s,
                                        rules: l.rules,
                                        fixed: l.fixedPlacements,
                                        referenceSolution: l.referenceSolution,
                                      });
                                    }}
                                  >
                                    Doğrula
                                  </button>
                                  <button
                                    onClick={() =>
                                      download(
                                        JSON.stringify(l, null, 2),
                                        `${l.id}.json`,
                                      )
                                    }
                                  >
                                    Kopyasını indir
                                  </button>
                                  <button
                                    onClick={() => {
                                      inspect(l);
                                      setSettings((s) => ({
                                        ...s,
                                        seed: `${l.generation.seed}-r${l.revision + 1}`,
                                      }));
                                      setMessage(
                                        "Yeni tohum hazır. Bölüm üretip revizyon düğmesiyle değiştirin; kalıcı kimlik korunur.",
                                      );
                                    }}
                                  >
                                    Yeniden üret
                                  </button>
                                  <button
                                    title="Sil"
                                    onClick={() =>
                                      mutateLevel(l.id, (_, tr, i, c) => {
                                        c.tracks[tr].splice(i, 1);
                                      })
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              </article>
                            );
                          })
                      )}
                      {viewCatalog.tracks[t].length > 20 && (
                        <div className="catalog-pagination">
                          <button
                            disabled={
                              !pageIndex(
                                viewCatalog.tracks[t].length,
                                catalogPages[t],
                              )
                            }
                            onClick={() =>
                              setCatalogPages((p) => ({
                                ...p,
                                [t]: Math.max(
                                  0,
                                  pageIndex(
                                    viewCatalog.tracks[t].length,
                                    p[t],
                                  ) - 1,
                                ),
                              }))
                            }
                          >
                            ← Önceki
                          </button>
                          <span>
                            {pageIndex(
                              viewCatalog.tracks[t].length,
                              catalogPages[t],
                            ) + 1}{" "}
                            / {Math.ceil(viewCatalog.tracks[t].length / 20)}
                          </span>
                          <button
                            disabled={
                              (pageIndex(
                                viewCatalog.tracks[t].length,
                                catalogPages[t],
                              ) +
                                1) *
                                20 >=
                              viewCatalog.tracks[t].length
                            }
                            onClick={() =>
                              setCatalogPages((p) => ({
                                ...p,
                                [t]:
                                  pageIndex(
                                    viewCatalog.tracks[t].length,
                                    p[t],
                                  ) + 1,
                              }))
                            }
                          >
                            Sonraki →
                          </button>
                        </div>
                      )}
                    </section>
                  ))}
              </div>
            </>
          )}
          {tab === "Silüet editörü" && (
            <div className="editor-layout">
              <section className="panel">
                <div className="panel-title">
                  <h2>Tahtayı şekillendir</h2>
                  <span>⬡</span>
                </div>
                <label>
                  Hazır şablon
                  <select
                    value={boardId}
                    onChange={(e) => selectBoard(e.target.value)}
                  >
                    {Object.keys(boards).map((id) => (
                      <option key={id} value={id}>
                        {boardNames[id]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Silüet etiketi
                  <input
                    value={board.shapeLabel ?? ""}
                    onChange={(e) =>
                      setBoard((b) => ({
                        ...b,
                        shapeLabel: e.target.value,
                        templateId: b.templateId ?? "custom",
                      }))
                    }
                  />
                </label>
                <div className="two-fields">
                  <label>
                    Genişlik
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={board.width}
                      onChange={(e) => {
                        const w = Math.max(1, Math.min(20, +e.target.value));
                        setMaskUndo((h) => [...h, board]);
                        setBoard((b) => ({
                          ...b,
                          width: w,
                          mask: b.mask.map((r) =>
                            (r + "0".repeat(w)).slice(0, w),
                          ),
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Yükseklik
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={board.height}
                      onChange={(e) => {
                        const h = Math.max(1, Math.min(20, +e.target.value));
                        setMaskUndo((a) => [...a, board]);
                        setBoard((b) => ({
                          ...b,
                          height: h,
                          mask: [
                            ...b.mask,
                            ...Array(h).fill("0".repeat(b.width)),
                          ].slice(0, h),
                        }));
                      }}
                    />
                  </label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={mirror}
                    onChange={(e) => setMirror(e.target.checked)}
                  />{" "}
                  Yatay ayna ile boya
                </label>
                <div className="toolbar">
                  <button
                    disabled={!maskUndo.length}
                    onClick={() => {
                      setMaskRedo((h) => [...h, board]);
                      setBoard(maskUndo[maskUndo.length - 1]);
                      setMaskUndo((h) => h.slice(0, -1));
                    }}
                  >
                    ↶ Geri al
                  </button>
                  <button
                    disabled={!maskRedo.length}
                    onClick={() => {
                      setMaskUndo((h) => [...h, board]);
                      setBoard(maskRedo[maskRedo.length - 1]);
                      setMaskRedo((h) => h.slice(0, -1));
                    }}
                  >
                    ↷ Yinele
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Aktif alan</dt>
                    <dd>{active(board).length} hücre</dd>
                  </div>
                  <div>
                    <dt>Bağlılık</dt>
                    <dd>{topology(board).components} bileşen</dd>
                  </div>
                  <div>
                    <dt>Envanter alanı</dt>
                    <dd>
                      {set.pieces.reduce((n, p) => n + p.cells.length, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt>İç delik</dt>
                    <dd>{topology(board).holes} adet</dd>
                  </div>
                  <div>
                    <dt>Sınırlayıcı kutu</dt>
                    <dd>
                      {active(board).length
                        ? `${Math.max(...active(board).map((c) => c[0])) - Math.min(...active(board).map((c) => c[0])) + 1} × ${Math.max(...active(board).map((c) => c[1])) - Math.min(...active(board).map((c) => c[1])) + 1}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <button
                  className="full"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    revalidateRef.current = true;
                    spawn().postMessage({
                      type: "solve",
                      board,
                      set,
                      rules: defaultRules,
                      fixed: [],
                    });
                  }}
                >
                  Doldurulabilirliği kontrol et
                </button>
                <button
                  className="primary full"
                  onClick={() => {
                    try {
                      if (!connected(active(board)))
                        throw Error("Önce tek bağlı silüet çizin");
                      const s = deriveSet(
                        board,
                        `custom-${Date.now().toString(36)}`,
                      );
                      changeCatalog({
                        ...catalog,
                        pieceSets: [...catalog.pieceSets, s],
                      });
                      setSetId(`${s.id}@1`);
                      setMasks((m) => ({ ...m, [boardId]: board }));
                      setMessage(
                        "Bağlı alanlardan özel set türetildi; üretimde çözücüyle doğrulayın.",
                      );
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Bu şekil için parça seti türet
                </button>
                <button
                  className="full"
                  onClick={() => {
                    setLevel(undefined);
                    setTab("Üretici");
                  }}
                >
                  Üreticiye geç →
                </button>
                <p className="muted">
                  Her şablon kendi parça setini kullanır. Tanınabilirlik, küçük
                  tek renk önizlemede insan tarafından değerlendirilmelidir.
                </p>
              </section>
              <section className="panel editor-canvas">
                <div className="panel-title">
                  <h2>Hücre düzenleyicisi</h2>
                  <span>{board.shapeLabel ?? "Dikdörtgen"}</span>
                </div>
                <div
                  className="mask-grid"
                  style={{ gridTemplateColumns: `repeat(${board.width}, 1fr)` }}
                >
                  {board.mask.flatMap((row, y) =>
                    [...row].map((v, x) => (
                      <button
                        aria-label={`Hücre ${x},${y} ${v === "1" ? "dolu" : "boş"}`}
                        aria-pressed={v === "1"}
                        key={`${x},${y}`}
                        className={v === "1" ? "on" : ""}
                        onClick={() => updateMask(x, y)}
                      />
                    )),
                  )}
                </div>
                <div className="silhouette-previews">
                  <div>
                    <BoardView board={board} set={set} mono />
                    <p>Tek renk silüet</p>
                  </div>
                  <div>
                    <BoardView
                      board={board}
                      set={set}
                      placements={
                        results?.solutions[0]?.filter((p) =>
                          p.cells.every(([x, y]) => board.mask[y]?.[x] === "1"),
                        ) ?? []
                      }
                    />
                    <p>Son çözüm kontrolü</p>
                  </div>
                </div>
              </section>
            </div>
          )}
          {tab === "Parça setleri" && (
            <div className="editor-layout">
              <section className="panel">
                <div className="panel-title">
                  <h2>Set ve sürüm</h2>
                  <span>◈</span>
                </div>
                <label>
                  Kayıtlı set
                  <select
                    onChange={(e) => {
                      setEditingSet(
                        structuredClone(catalog.pieceSets[+e.target.value]),
                      );
                      setEditingPiece(0);
                    }}
                    defaultValue="0"
                  >
                    {catalog.pieceSets.map((s, i) => (
                      <option key={`${s.id}@${s.version}`} value={i}>
                        {s.id} · v{s.version}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Set kimliği
                  <input
                    value={editingSet.id}
                    onChange={(e) =>
                      setEditingSet((s) => ({ ...s, id: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editingSet.allowRotations ?? true}
                    onChange={(e) =>
                      setEditingSet((s) => ({
                        ...s,
                        allowRotations: e.target.checked,
                      }))
                    }
                  />{" "}
                  90° döndürmeye izin ver
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editingSet.allowReflections ?? false}
                    onChange={(e) =>
                      setEditingSet((s) => ({
                        ...s,
                        allowReflections: e.target.checked,
                      }))
                    }
                  />{" "}
                  Yansıtmaya izin ver
                </label>
                <div className="toolbar">
                  <button
                    onClick={() => {
                      setEditingSet({
                        id: `set-${Date.now().toString(36)}`,
                        version: 1,
                        pieces: [
                          {
                            id: "A",
                            symbol: "A",
                            color: colors[0],
                            cells: [[0, 0]],
                          },
                        ],
                      });
                      setEditingPiece(0);
                    }}
                  >
                    Yeni set
                  </button>
                  <button
                    onClick={() =>
                      setEditingSet((s) => ({
                        ...s,
                        id: `${s.id}-copy`,
                        version: 1,
                      }))
                    }
                  >
                    Seti kopyala
                  </button>
                </div>
                <p>
                  Toplam alan:{" "}
                  <b>
                    {editingSet.pieces.reduce((n, p) => n + p.cells.length, 0)}{" "}
                    hücre
                  </b>
                </p>
                <button className="primary full" onClick={saveSet}>
                  Yeni sürüm olarak kaydet
                </button>
                <button
                  className="full"
                  onClick={() =>
                    download(
                      JSON.stringify(editingSet, null, 2),
                      `${editingSet.id}.json`,
                    )
                  }
                >
                  Set JSON indir
                </button>
                <label className="button full">
                  Set JSON yükle
                  <input
                    type="file"
                    hidden
                    accept=".json"
                    onChange={(e) => importFile(e.target.files?.[0], true)}
                  />
                </label>
              </section>
              <section className="panel editor-canvas">
                <div className="panel-title">
                  <h2>Parçaları tasarla</h2>
                  <button
                    onClick={() => {
                      const id = String.fromCharCode(
                        65 + editingSet.pieces.length,
                      );
                      setEditingSet((s) => ({
                        ...s,
                        pieces: [
                          ...s.pieces,
                          {
                            id,
                            symbol: id,
                            color: colors[s.pieces.length % colors.length],
                            cells: [[0, 0]],
                          },
                        ],
                      }));
                      setEditingPiece(editingSet.pieces.length);
                    }}
                  >
                    ＋ Parça
                  </button>
                </div>
                <div className="tabs">
                  {editingSet.pieces.map((p, i) => (
                    <button
                      className={editingPiece === i ? "chosen" : ""}
                      key={i}
                      onClick={() => setEditingPiece(i)}
                    >
                      {p.symbol}
                    </button>
                  ))}
                </div>
                {(() => {
                  const p = editingSet.pieces[editingPiece];
                  if (!p) return null;
                  function update(values: Partial<typeof p>) {
                    setEditingSet((s) => ({
                      ...s,
                      pieces: s.pieces.map((p, i) =>
                        i === editingPiece ? { ...p, ...values } : p,
                      ),
                    }));
                  }
                  return (
                    <>
                      <div className="piece-fields">
                        <label>
                          Kimlik
                          <input
                            value={p.id}
                            onChange={(e) => update({ id: e.target.value })}
                          />
                        </label>
                        <label>
                          İsim
                          <input
                            value={p.name ?? ""}
                            onChange={(e) => update({ name: e.target.value })}
                          />
                        </label>
                        <label>
                          Sembol
                          <input
                            maxLength={3}
                            value={p.symbol}
                            onChange={(e) => update({ symbol: e.target.value })}
                          />
                        </label>
                        <label>
                          Renk
                          <input
                            type="color"
                            value={p.color}
                            onChange={(e) => update({ color: e.target.value })}
                          />
                        </label>
                      </div>
                      <div
                        className="mask-grid piece-drawing"
                        style={{ gridTemplateColumns: "repeat(6,1fr)" }}
                      >
                        {Array.from({ length: 36 }, (_, i) => {
                          const x = i % 6,
                            y = Math.floor(i / 6),
                            on = p.cells.some(([a, b]) => a === x && b === y);
                          return (
                            <button
                              key={i}
                              aria-label={`Parça hücresi ${x},${y}`}
                              aria-pressed={on}
                              style={on ? { background: p.color } : {}}
                              className={on ? "on" : ""}
                              onClick={() =>
                                update({
                                  cells: on
                                    ? p.cells.filter(
                                        ([a, b]) => a !== x || b !== y,
                                      )
                                    : [...p.cells, [x, y]],
                                })
                              }
                            />
                          );
                        })}
                      </div>
                      <button
                        disabled={editingSet.pieces.length === 1}
                        onClick={() => {
                          setEditingSet((s) => ({
                            ...s,
                            pieces: s.pieces.filter(
                              (_, i) => i !== editingPiece,
                            ),
                          }));
                          setEditingPiece(0);
                        }}
                      >
                        Parçayı sil
                      </button>
                      <h3>
                        Benzersiz yönelimler ·{" "}
                        {
                          orientations(p, {
                            ...defaultRules,
                            allowRotations: editingSet.allowRotations ?? true,
                            allowReflections:
                              editingSet.allowReflections ?? false,
                          }).length
                        }
                      </h3>
                      <div className="orientation-list">
                        {orientations(p, {
                          ...defaultRules,
                          allowRotations: editingSet.allowRotations ?? true,
                          allowReflections:
                            editingSet.allowReflections ?? false,
                        }).map(([k, cells]) => (
                          <div key={k}>
                            <svg viewBox="-1 -1 8 8">
                              {cells.map(([x, y]) => (
                                <circle
                                  key={`${x},${y}`}
                                  cx={x}
                                  cy={y}
                                  r=".43"
                                  fill={p.color}
                                />
                              ))}
                            </svg>
                            <small className="mono">{k}</small>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </section>
            </div>
          )}
          <footer>
            <span>
              SHAPE / STUDIO <span>·</span> Özgün bulmacalar için küçük bir
              atölye.
            </span>
            <span>Yerel motor · Exact cover · v{VERSION}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
