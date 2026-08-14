import { useEffect, useMemo, useState } from "react";

const WIDTH = 640;
const HEIGHT = 320;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = NICE_STEPS.find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

export default function AllWeaponsChart({ dataBase }) {
  const [weapons, setWeapons] = useState(null);
  const [hover, setHover] = useState(null); // { id, idx } | null

  useEffect(() => {
    fetch(`${dataBase}/dps-summary.json`)
      .then((r) => r.json())
      .then(setWeapons);
  }, [dataBase]);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const maxN = useMemo(() => (weapons ? Math.max(...weapons.map((w) => w.dps.length - 1)) : 100), [weapons]);
  const maxY = useMemo(
    () => (weapons ? niceMax(Math.max(...weapons.map((w) => Math.max(...w.dps)))) : 100),
    [weapons],
  );

  const xScale = (n) => PAD.left + (n / maxN) * innerW;
  const yScale = (v) => PAD.top + innerH - (v / maxY) * innerH;

  const paths = useMemo(() => {
    if (!weapons) return [];
    return weapons.map((w) => ({
      id: w.id,
      name: w.name,
      d: w.dps.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(2)},${yScale(v).toFixed(2)}`).join(" "),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weapons, maxN, maxY]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  function handlePointerMove(e) {
    if (!weapons) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const py = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const idx = Math.round(((px - PAD.left) / innerW) * maxN);
    const clampedIdx = Math.max(0, Math.min(maxN, idx));

    let bestId = null;
    let bestDist = Infinity;
    for (const w of weapons) {
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

  const hoveredWeapon = hover && weapons.find((w) => w.id === hover.id);
  const hoveredValue = hoveredWeapon ? hoveredWeapon.dps[Math.min(hover.idx, hoveredWeapon.dps.length - 1)] : null;
  const hoveredPath = hover && paths.find((p) => p.id === hover.id);
  const hoveredPoint = hoveredWeapon && [xScale(hover.idx), yScale(hoveredValue)];

  return (
    <div className="viz-root all-weapons-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="DPS versus N for every weapon"
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

        {paths.map((p) => (p.id === hover?.id ? null : <path key={p.id} d={p.d} className="all-chart-line" fill="none" />))}

        {hoveredPath && <path d={hoveredPath.d} className="all-chart-line-active" fill="none" />}

        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint[0]}
              x2={hoveredPoint[0]}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="chart-crosshair"
            />
            <circle cx={hoveredPoint[0]} cy={hoveredPoint[1]} r={5} className="chart-marker" />
          </>
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
          <div className="chart-tooltip-value">{hoveredWeapon.name}</div>
          <div className="chart-tooltip-label">
            {hoveredValue.toFixed(hoveredValue < 10 ? 2 : 1)} DPS &middot; N = {hover.idx}
          </div>
        </div>
      )}
    </div>
  );
}
