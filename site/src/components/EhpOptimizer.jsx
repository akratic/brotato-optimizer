import { useEffect, useState } from "react";
import DpsChart from "./DpsChart.jsx";
import CurveTable from "./CurveTable.jsx";
import { EHP_STAT_LABELS as STAT_LABELS } from "../statLabels.js";
import { usePersistentState } from "../usePersistentState.js";

function findEntry(curve, n) {
  return curve.find((c) => c.n === n) ?? curve[curve.length - 1];
}

function formatEhpTotal(key, value) {
  if (key === "hp") return value;
  if (key === "armor") return `+${value}`;
  return `+${value}%`;
}

export default function EhpOptimizer({ dataBase }) {
  const [curve, setCurve] = useState(null);
  const [n, setN] = usePersistentState("ehpN", null);

  useEffect(() => {
    fetch(`${dataBase}/ehp.json`)
      .then((r) => r.json())
      .then((data) => {
        setCurve(data.curve);
        const curveMax = data.curve[data.curve.length - 1].n;
        setN((prev) => (prev == null ? curveMax : Math.min(prev, curveMax)));
      });
  }, [dataBase]);

  if (!curve) return <p className="loading">Loading eHP data...</p>;

  const maxN = curve[curve.length - 1].n;
  const entry = findEntry(curve, n);

  return (
    <section className="ehp-view">
      <div className="weapon-header">
        <img className="weapon-icon" src={`${import.meta.env.BASE_URL}icons/items/medikit_icon.png`} alt="" />
        <h2>Effective HP Optimizer</h2>
        <p className="ehp-explainer">
          Best split of level-ups between HP, Armor, and Dodge to maximize effective HP.
        </p>
      </div>

      <div className="n-control">
        <input
          id="ehp-n-slider"
          aria-label="Level-up points spent"
          type="range"
          min={0}
          max={maxN}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
      </div>

      <table className="split-table">
        <thead>
          <tr>
            {Object.keys(entry.totals).map((key) => (
              <th key={key} scope="col">
                {STAT_LABELS[key] ?? key}
              </th>
            ))}
            <th scope="col">Effective HP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.entries(entry.totals).map(([key, value]) => (
              <td key={key}>{formatEhpTotal(key, value)}</td>
            ))}
            <td className="value-cell">{entry.ehp.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      <DpsChart curve={curve} yKey="ehp" highlightX={n} />

      <CurveTable
        curve={curve}
        totalsLabels={STAT_LABELS}
        formatTotal={formatEhpTotal}
        valueLabel="Effective HP"
        valueKey="ehp"
        highlightN={n}
      />
    </section>
  );
}
