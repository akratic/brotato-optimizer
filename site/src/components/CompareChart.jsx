import { useEffect, useMemo, useState } from "react";

const WIDTH = 640;
const HEIGHT = 320;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
const PALETTE_SIZE = 8;

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = NICE_STEPS.find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

export default function CompareChart({ dataBase, selectedIds, pinnedN }) {
  const [weapons, setWeapons] = useState(null);
  const [hover, setHover] = useState(null); // { id, idx } | null

  useEffect(() => {
    fetch(`${dataBase}/dps-summary.json`)
      .then((r) => r.json())
      .then(setWeapons);
  }, [dataBase]);

  const selected = useMemo(() => {
    if (!weapons) return [];
    const byId = Object.fromEntries(weapons.map((w) => [w.id, w]));
    return selectedIds.map((id) => byId[id]).filter(Boolean);
  }, [weapons, selectedIds]);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const maxN = useMemo(
    () => (selected.length ? Math.max(...selected.map((w) => w.dps.length - 1)) : 100),
    [selected],
  );
  const maxY = useMemo(
    () => (selected.length ? niceMax(Math.max(...selected.map((w) => Math.max(...w.dps)))) : 100),
    [selected],
  );

  const xScale = (n) => PAD.left + (n / maxN) * innerW;
  const yScale = (v) => PAD.top + innerH - (v / maxY) * innerH;

  const paths = useMemo(() => {
    return selected.map((w, i) => ({
      id: w.id,
      name: w.name,
      colorIndex: i % PALETTE_SIZE,
      d: w.dps.map((v, idx) => `${idx === 0 ? "M" : "L"}${xScale(idx).toFixed(2)},${yScale(v).toFixed(2)}`).join(" "),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, maxN, maxY]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
  const pinnedIdx = Math.max(0, Math.min(maxN, pinnedN));

  function handlePointerMove(e) {
    if (!selected.length) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const py = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const idx = Math.round(((px - PAD.left) / innerW) * maxN);
    const clampedIdx = Math.max(0, Math.min(maxN, idx));

    let bestId = null;
    let bestDist = Infinity;
    for (const w of selected) {
      const i = Math.min(clampedIdx, w.dps.length - 1);
      const y = yScale(w.dps[i]);
      const dist = Math.abs(y - py);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = w.id;
      }
    }
    setHover({ id: bestId, idx: clampedIdx });
  }

  if (!weapons) return <p className="loading">Loading weapon comparison...</p>;
  if (!selected.length) return <p className="loading">Select at least one weapon to compare.</p>;

  const hoveredWeapon = hover && selected.find((w) => w.id === hover.id);
  const hoveredValue = hoveredWeapon ? hoveredWeapon.dps[Math.min(hover.idx, hoveredWeapon.dps.length - 1)] : null;
  const hoveredPath = hover && paths.find((p) => p.id === hover.id);
  const hoveredPoint = hoveredWeapon && [xScale(hover.idx), yScale(hoveredValue)];
  const pinnedX = xScale(pinnedIdx);

  return (
    <div className="viz-root compare-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="DPS versus N for the selected weapons"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
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
          N=0
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} className="chart-tick" textAnchor="end">
          N={maxN}
        </text>

        <line x1={pinnedX} x2={pinnedX} y1={PAD.top} y2={PAD.top + innerH} className="chart-crosshair" />

        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            className={`compare-line compare-series-${p.colorIndex}${p.id === hover?.id ? " active" : ""}`}
            fill="none"
          />
        ))}

        {hoveredPoint && (
          <circle
            cx={hoveredPoint[0]}
            cy={hoveredPoint[1]}
            r={5}
            className={`compare-marker compare-series-${hoveredPath.colorIndex}`}
          />
        )}
      </svg>

      {hoveredWeapon && hoveredPoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hoveredPoint[0] / WIDTH) * 100}%`,
            top: `${(hoveredPoint[1] / HEIGHT) * 100}%`,
            "--tooltip-anchor":
              hoveredPoint[0] / WIDTH > 0.85 ? "-100%" : hoveredPoint[0] / WIDTH < 0.15 ? "0%" : "-50%",
          }}
        >
          <div className={`chart-tooltip-value compare-series-${hoveredPath.colorIndex}`}>{hoveredWeapon.name}</div>
          <div className="chart-tooltip-label">
            {hoveredValue.toFixed(hoveredValue < 10 ? 2 : 1)} DPS &middot; N = {hover.idx}
          </div>
        </div>
      )}

      <div className="chart-legend">
        {[...paths].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
          <div key={p.id} className="chart-legend-item">
            <span className={`chart-legend-swatch compare-swatch compare-series-${p.colorIndex}`} />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}
