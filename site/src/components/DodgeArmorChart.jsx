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

const LINE_CLASS = ["chart-line", "chart-line-2", "chart-line-3"];
const MARKER_CLASS = ["chart-marker-0", "chart-marker-1", "chart-marker-2"];

export default function DodgeArmorChart({ dataBase }) {
  const [data, setData] = useState(null); // { series, curve }
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    fetch(`${dataBase}/dodge-armor-coefficient.json`)
      .then((r) => r.json())
      .then(setData);
  }, [dataBase]);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const curve = data?.curve ?? [];
  const series = data?.series ?? [];

  const minX = curve.length ? curve[0].dodge : 0;
  const maxX = curve.length ? curve[curve.length - 1].dodge : 1;

  const maxY = useMemo(() => {
    let max = 0;
    for (const row of curve) {
      for (const s of series) {
        if (row[s.key] > max) max = row[s.key];
      }
    }
    return niceMax(max);
  }, [curve, series]);

  const xScale = (x) => PAD.left + ((x - minX) / (maxX - minX)) * innerW;
  const yScale = (y) => PAD.top + innerH - (y / maxY) * innerH;

  const paths = useMemo(
    () =>
      series.map((s) => ({
        key: s.key,
        d: curve
          .map((row, i) => `${i === 0 ? "M" : "L"}${xScale(row.dodge).toFixed(2)},${yScale(row[s.key]).toFixed(2)}`)
          .join(" "),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curve, series, minX, maxX, maxY],
  );

  // Drawn back-to-front so the first series (Normal) ends up on top.
  const drawOrder = series.map((_, i) => i).reverse();

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  function handlePointerMove(e) {
    if (!curve.length) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let bestDist = Infinity;
    curve.forEach((row, i) => {
      const dist = Math.abs(xScale(row.dodge) - px);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  if (!data) return <p className="loading">Loading dodge/armor comparison...</p>;

  const active = hoverIdx != null ? curve[hoverIdx] : null;
  const activeX = active ? xScale(active.dodge) : null;

  return (
    <div className="viz-root dodge-armor-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Dodge versus armor coefficient, by dodge cap"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIdx(null)}
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
              {t.toFixed(2)}
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
          Dodge={minX}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} className="chart-tick" textAnchor="end">
          Dodge={maxX}
        </text>

        {drawOrder.map((i) => (
          <path key={paths[i].key} d={paths[i].d} className={LINE_CLASS[i]} fill="none" />
        ))}

        {active && (
          <>
            <line
              x1={activeX}
              x2={activeX}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="chart-crosshair"
            />
            {drawOrder.map((i) => (
              <circle
                key={series[i].key}
                cx={activeX}
                cy={yScale(active[series[i].key])}
                r={4}
                className={MARKER_CLASS[i]}
              />
            ))}
          </>
        )}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(activeX / WIDTH) * 100}%`,
            top: `${(PAD.top / HEIGHT) * 100}%`,
            "--tooltip-anchor": activeX / WIDTH > 0.85 ? "-100%" : activeX / WIDTH < 0.15 ? "0%" : "-50%",
          }}
        >
          <div className="chart-tooltip-label">Dodge = {active.dodge}</div>
          {series.map((s, i) => (
            <div key={s.key} className={`chart-tooltip-value series-${i}`}>
              {s.label}: {active[s.key].toFixed(2)}×
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {series.map((s, i) => (
          <div key={s.key} className="chart-legend-item">
            <span className={`chart-legend-swatch series-${i}`} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
