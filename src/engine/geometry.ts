import type { Cell, Piece, Rules, Board, PieceSet, Placement } from "./model";
export const key = (c: Cell) => c.join(",");
export function normalize(cells: Cell[]): Cell[] {
  const x = Math.min(...cells.map((c) => c[0])),
    y = Math.min(...cells.map((c) => c[1]));
  return cells
    .map((c) => [c[0] - x, c[1] - y] as Cell)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const shapeKey = (cells: Cell[]) => normalize(cells).map(key).join(";");
export function orientations(
  piece: Piece,
  rules: Pick<Rules, "allowRotations" | "allowReflections">,
) {
  const out = new Map<string, Cell[]>();
  for (let f = 0; f < (rules.allowReflections ? 2 : 1); f++) {
    let c = piece.cells.map(([x, y]) => [f ? -x : x, y] as Cell);
    for (let r = 0; r < (rules.allowRotations ? 4 : 1); r++) {
      c = normalize(c);
      out.set(shapeKey(c), c);
      c = c.map(([x, y]) => [-y, x]);
    }
  }
  return [...out].sort(([a], [b]) => a.localeCompare(b));
}
export function connected(cells: Cell[]) {
  if (!cells.length) return false;
  const left = new Set(cells.map(key)),
    stack = [cells[0]];
  left.delete(key(cells[0]));
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const c of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as Cell[])
      if (left.delete(key(c))) stack.push(c);
  }
  return !left.size;
}
export const active = (b: Board): Cell[] =>
  b.mask.flatMap((row, y) =>
    [...row].flatMap((v, x) => (v === "1" ? [[x, y] as Cell] : [])),
  );
export function validateSet(s: PieceSet, r: Rules) {
  const ids = new Set(),
    shapes = new Set();
  if (
    !s.id ||
    !Number.isInteger(s.version) ||
    s.version < 1 ||
    !s.pieces.length ||
    s.pieces.length > 30
  )
    throw Error("pieceSet: geçersiz kimlik, sürüm veya parça sayısı");
  for (const p of s.pieces) {
    if (ids.has(p.id) || !p.id) throw Error(`pieces.${p.id}: yinelenen kimlik`);
    ids.add(p.id);
    if (
      typeof p.symbol !== "string" ||
      !p.symbol.length ||
      p.symbol.length > 3 ||
      !/^#[0-9a-fA-F]{6}$/.test(p.color)
    )
      throw Error(`pieces.${p.id}: renk veya sembol geçersiz`);
    if (
      !p.cells.length ||
      p.cells.length > 100 ||
      p.cells.some((c) => c.length !== 2 || !c.every(Number.isInteger)) ||
      new Set(p.cells.map(key)).size !== p.cells.length ||
      !connected(p.cells)
    )
      throw Error(
        `pieces.${p.id}: hücreler benzersiz, tamsayı ve bağlı olmalı`,
      );
    if (JSON.stringify(p.cells) !== JSON.stringify(normalize(p.cells)))
      throw Error(`pieces.${p.id}: normalize edilmemiş şekil`);
    const k = orientations(p, r)
      .map(([k]) => k)
      .sort()[0];
    if (shapes.has(k))
      throw Error(`pieces.${p.id}: aynı geometriye sahip ikinci parça`);
    shapes.add(k);
  }
}
export function preflight(b: Board, s: PieceSet, r: Rules) {
  validateSet(s, r);
  if (
    !Number.isInteger(b.width) ||
    !Number.isInteger(b.height) ||
    b.width < 1 ||
    b.height < 1 ||
    b.width > 20 ||
    b.height > 20 ||
    b.mask.length !== b.height ||
    b.mask.some((row) => row.length !== b.width || /[^01]/.test(row))
  )
    throw Error("board.mask: boyut veya hücre değeri geçersiz");
  const cells = active(b),
    area = s.pieces.reduce((n, p) => n + p.cells.length, 0);
  if (cells.length !== area)
    throw Error(`Tahta ${cells.length} hücre, parça envanteri ${area} hücre`);
  if (!connected(cells)) throw Error("board.mask: tek bağlı bileşen gerekli");
}
export function placements(b: Board, p: Piece, r: Rules): Placement[] {
  const out: Placement[] = [];
  for (const [orientationKey, c] of orientations(p, r))
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        const cells = c.map(([a, d]) => [a + x, d + y] as Cell);
        if (cells.every(([a, d]) => b.mask[d]?.[a] === "1"))
          out.push({ pieceId: p.id, orientationKey, origin: [x, y], cells });
      }
  return out;
}
export function validatePlacements(
  b: Board,
  s: PieceSet,
  r: Rules,
  ps: Placement[],
  full = false,
) {
  const used = new Set(),
    occupied = new Set();
  for (const p of ps) {
    const piece = s.pieces.find((q) => q.id === p.pieceId);
    if (!piece || used.has(p.pieceId))
      throw Error(`${p.pieceId}: bilinmeyen veya tekrarlanan parça`);
    used.add(p.pieceId);
    const c = orientations(piece, r).find(([k]) => k === p.orientationKey)?.[1];
    if (
      !c ||
      !p.origin.every(Number.isInteger) ||
      JSON.stringify(c.map(([x, y]) => [x + p.origin[0], y + p.origin[1]])) !==
        JSON.stringify(p.cells)
    )
      throw Error(`${p.pieceId}: orientationKey, origin ve cells tutarsız`);
    for (const cell of p.cells) {
      const [x, y] = cell,
        k = key(cell);
      if (b.mask[y]?.[x] !== "1" || occupied.has(k))
        throw Error(`${p.pieceId}: (${x},${y}) çakışıyor veya tahta dışında`);
      occupied.add(k);
    }
  }
  if (
    full &&
    (used.size !== s.pieces.length || occupied.size !== active(b).length)
  )
    throw Error("Çözüm tüm envanteri ve aktif hücreleri kaplamıyor");
  return true;
}

export function topology(board: Board) {
  function components(cells: Cell[]) {
    const left = new Map(cells.map((c) => [key(c), c]));
    let count = 0,
      holes = 0;
    while (left.size) {
      count++;
      const first = left.values().next().value!;
      left.delete(key(first));
      const stack = [first];
      let edge = false;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        if (
          x === 0 ||
          y === 0 ||
          x === board.width - 1 ||
          y === board.height - 1
        )
          edge = true;
        for (const c of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as Cell[])
          if (left.delete(key(c))) stack.push(c);
      }
      if (!edge) holes++;
    }
    return { count, holes };
  }
  const cells = active(board),
    empty = board.mask.flatMap((row, y) =>
      [...row].flatMap((v, x) => (v === "0" ? [[x, y] as Cell] : [])),
    );
  return {
    area: cells.length,
    components: components(cells).count,
    holes: components(empty).holes,
    boundingBox: cells.length
      ? [
          Math.max(...cells.map((c) => c[0])) -
            Math.min(...cells.map((c) => c[0])) +
            1,
          Math.max(...cells.map((c) => c[1])) -
            Math.min(...cells.map((c) => c[1])) +
            1,
        ]
      : [0, 0],
  };
}
