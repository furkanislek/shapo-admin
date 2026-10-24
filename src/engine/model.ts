export type Cell = [number, number];
export type Piece = {
  id: string;
  name?: string;
  color: string;
  symbol: string;
  cells: Cell[];
};
export type PieceSet = {
  id: string;
  version: number;
  allowRotations?: boolean;
  allowReflections?: boolean;
  pieces: Piece[];
};
export type Board = {
  width: number;
  height: number;
  mask: string[];
  templateId?: string;
  shapeLabel?: string;
};
export type Rules = {
  allowRotations: boolean;
  allowReflections: boolean;
  solutionPolicy: "unique" | "any-valid";
};
export type Placement = {
  pieceId: string;
  orientationKey: string;
  origin: Cell;
  cells: Cell[];
};
export const tracks = ["baby", "easy", "medium", "hard", "expert"] as const;
export type Track = (typeof tracks)[number];
export type Result = {
  status: "complete" | "timeout" | "cancelled" | "node_limit";
  solutionCount: number;
  countIsExact: boolean;
  classification: "unsolvable" | "unique" | "multiple" | "unknown";
  solutions: Placement[][];
  stats: {
    nodes: number;
    backtracks: number;
    forcedMoves: number;
    branchingPoints: number;
    maxDepth: number;
    elapsedMs: number;
  };
};
export type Settings = {
  method?: "automatic-1" | "automatic-2" | "silhouette-1";
  pieceCount?: number;
  packingSeed?: string;
  fixedMin?: number;
  fixedMax?: number;
  seed: string;
  fixedCount: number;
  nodeLimit: number;
  attemptLimit: number;
  timeLimit: number;
  policy: "unique" | "any-valid";
  track: Track;
};
export type Level = {
  revisionHistory?: Level[];
  id: string;
  revision: number;
  order: number;
  kind: "rectangle" | "silhouette";
  pieceSetId: string;
  pieceSetVersion: number;
  pieceIds: string[];
  board: Board;
  rules: Rules;
  fixedPlacements: Placement[];
  referenceSolution?: Placement[];
  generation: Settings;
  difficulty: {
    label: Track;
    estimatedScore: number;
    metricsVersion: string;
    metrics: Result["stats"] & {
      initialPlacements?: Record<string, number>;
      rotationDiversity?: number;
      reflectionEnabled?: boolean;
    };
    manualLabel?: Track;
  };
  validation: Omit<Result, "solutions" | "stats"> & {
    symmetryPolicy: string;
    engineVersion: string;
  };
};
export type Catalog = {
  schemaVersion: number;
  game: "shape-packing-2d";
  catalogId: string;
  catalogRevision: number;
  engineVersion: string;
  coordinateSystem: "xy-zero-based";
  pieceSets: PieceSet[];
  tracks: Record<Track, Level[]>;
};
export const VERSION = "1.2.0";
