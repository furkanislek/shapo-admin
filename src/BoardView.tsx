import type { Board, PieceSet, Placement, Cell } from "./engine/model";
export function BoardView({
  board,
  set,
  placements = [],
  fixed = [],
  grid = false,
  mono = false,
  onCell,
  selected,
  ghost = [],
  invalid = false,
}: {
  board: Board;
  set: PieceSet;
  placements?: Placement[];
  fixed?: Placement[];
  grid?: boolean;
  mono?: boolean;
  onCell?: (c: Cell) => void;
  selected?: string;
  ghost?: Cell[];
  invalid?: boolean;
}) {
  const size = 48,
    pad = 20;
  return (
    <svg
      className="board-svg"
      viewBox={`0 0 ${board.width * size + pad * 2} ${board.height * size + pad * 2}`}
      role={onCell ? "group" : "img"}
      aria-label={`${board.shapeLabel ?? "Dikdörtgen"} tahtası, ${board.width} × ${board.height}`}
    >
      <defs>
        <filter id="bead">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>
      {board.mask.flatMap((row, y) =>
        [...row].map((v, x) =>
          v === "1" ? (
            <g key={`b${x},${y}`}>
              <rect
                x={pad + x * size - 23}
                y={pad + y * size - 23}
                width={46}
                height={46}
                rx={grid ? 3 : 12}
                fill={mono ? "#303d35" : "#e6e9de"}
                stroke={grid ? "#bec6b7" : "transparent"}
              />
              <circle
                cx={pad + x * size}
                cy={pad + y * size}
                r={17}
                fill={mono ? "#303d35" : "#d4dacb"}
              />
            </g>
          ) : null,
        ),
      )}
      {placements.map((p) => {
        const piece = set.pieces.find((q) => q.id === p.pieceId);
        return (
          <g
            key={p.pieceId}
            opacity={selected && selected !== p.pieceId?.toString() ? 0.55 : 1}
          >
            {p.cells.flatMap(([x, y]) =>
              p.cells
                .filter(
                  ([a, b]) =>
                    (a === x + 1 && b === y) || (a === x && b === y + 1),
                )
                .map(([a, b]) => (
                  <line
                    key={`${x}${y}${a}${b}`}
                    x1={pad + x * size}
                    y1={pad + y * size}
                    x2={pad + a * size}
                    y2={pad + b * size}
                    stroke={mono ? "#303d35" : (piece?.color ?? "#888")}
                    strokeWidth={28}
                  />
                )),
            )}
            {p.cells.map(([x, y], i) => (
              <g key={`${x},${y}`}>
                <circle
                  cx={pad + x * size}
                  cy={pad + y * size}
                  r={20}
                  fill={mono ? "#303d35" : (piece?.color ?? "#888")}
                />
                {!mono && (
                  <>
                    <circle
                      cx={pad + x * size - 4}
                      cy={pad + y * size - 5}
                      r={12}
                      fill="white"
                      opacity=".07"
                    />
                    {i === 0 && (
                      <text
                        x={pad + x * size}
                        y={pad + y * size + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="13"
                        fontWeight="700"
                      >
                        {piece?.symbol}
                        {fixed.some((f) => f.pieceId === p.pieceId) ? "⌑" : ""}
                      </text>
                    )}
                  </>
                )}
              </g>
            ))}
          </g>
        );
      })}
      {ghost.map(([x, y]) => (
        <circle
          key={`g${x}${y}`}
          cx={pad + x * size}
          cy={pad + y * size}
          r={20}
          fill={invalid ? "#c45a50" : "#69845f"}
          opacity=".5"
        />
      ))}
      {onCell &&
        board.mask.flatMap((row, y) =>
          [...row].map((v, x) =>
            v === "1" ? (
              <rect
                key={`hit${x},${y}`}
                x={pad + x * size - 23}
                y={pad + y * size - 23}
                width="46"
                height="46"
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`Hücre ${x}, ${y}`}
                onClick={() => onCell([x, y])}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onCell([x, y]);
                }}
              />
            ) : null,
          ),
        )}
    </svg>
  );
}

export function MaskThumbnail({ board }: { board: Board }) {
  return (
    <svg
      className="silhouette-mask"
      viewBox={`0 0 ${board.width} ${board.height}`}
      role="img"
      aria-label={`${board.shapeLabel ?? "Silüet"} · tek renk şekil`}
    >
      {board.mask.flatMap((row, y) =>
        [...row].flatMap((v, x) =>
          v === "1"
            ? [
                <rect
                  key={`${x},${y}`}
                  x={x}
                  y={y}
                  width="1"
                  height="1"
                  fill="#293d30"
                />,
              ]
            : [],
        ),
      )}
    </svg>
  );
}
