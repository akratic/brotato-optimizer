import { useMemo, useState } from "react";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = NICE_STEPS.find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

export default function DpsChart({ curve, xKey = "n", yKey, unit = "", highlightX }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const xs = curve.map((d) => d[xKey]);
  const ys = curve.map((d) => d[yKey]);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const maxY = niceMax(Math.max(...ys));

  const xScale = (x) => PAD.left + ((x - minX) / (maxX - minX)) * innerW;
  const yScale = (y) => PAD.top + innerH - (y / maxY) * innerH;

  const points = useMemo(
    () => curve.map((d) => [xScale(d[xKey]), yScale(d[yKey])]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curve, xKey, yKey, minX, maxX, maxY],
  );

  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  const activeIdx = hoverIdx ?? (highlightX != null ? curve.findIndex((d) => d[xKey] === highlightX) : null);
  const active = activeIdx != null && activeIdx >= 0 ? curve[activeIdx] : null;
  const activePoint = activeIdx != null && activeIdx >= 0 ? points[activeIdx] : null;

  function handlePointerMove(e) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let bestDist = Infinity;
    points.forEach(([x], i) => {
      const dist = Math.abs(x - px);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  function handleKeyDown(e) {
    setHoverIdx((prev) => {
      const cur = prev ?? curve.findIndex((d) => d[xKey] === highlightX) ?? 0;
      if (e.key === "ArrowRight") return Math.min(curve.length - 1, cur + 1);
      if (e.key === "ArrowLeft") return Math.max(0, cur - 1);
      return prev;
    });
  }

  return (
    <div className="viz-root dps-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${yKey} versus ${xKey} chart`}
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIdx(null)}
        onKeyDown={handleKeyDown}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yScale(t)}
              y2={yScale(t)}
              className="chart-gridline"
            />
            <text x={PAD.left - 8} y={yScale(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          className="chart-axis"
        />
        <text x={PAD.left} y={HEIGHT - 6} className="chart-tick">
          N={minX}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} className="chart-tick" textAnchor="end">
          N={maxX}
        </text>

        <path d={pathD} className="chart-line" fill="none" />

        {activePoint && (
          <>
            <line
              x1={activePoint[0]}
              x2={activePoint[0]}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="chart-crosshair"
            />
            <circle cx={activePoint[0]} cy={activePoint[1]} r={5} className="chart-marker" />
          </>
        )}
      </svg>

      {active && activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(activePoint[0] / WIDTH) * 100}%`,
            top: `${(activePoint[1] / HEIGHT) * 100}%`,
            "--tooltip-anchor":
              activePoint[0] / WIDTH > 0.85 ? "-100%" : activePoint[0] / WIDTH < 0.15 ? "0%" : "-50%",
          }}
        >
          <div className="chart-tooltip-value">
            {active[yKey].toFixed(active[yKey] < 10 ? 2 : 1)}
            {unit}
          </div>
          <div className="chart-tooltip-label">N = {active[xKey]}</div>
        </div>
      )}
    </div>
  );
}
