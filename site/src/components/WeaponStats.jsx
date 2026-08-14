import { useState } from "react";
import WeaponSelector from "./WeaponSelector.jsx";
import { WEAPON_STAT_LABELS as STAT_LABELS, formatWeaponTotal } from "../statLabels.js";

function findEntry(curve, n) {
  return curve.find((c) => c.n === n) ?? curve[curve.length - 1];
}

export default function WeaponStats({ meta, data, n, maxN, onChangeN, weapons, selectedId, onSelectWeapon }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const damageStat = meta.damageStat;
  const entry = data ? findEntry(data.curve, n) : null;

  return (
    <section className="weapon-stats">
      <div className="weapon-header">
        {meta.icon ? (
          <img className="weapon-icon" src={`${import.meta.env.BASE_URL}${meta.icon}`} alt="" />
        ) : (
          <div className="weapon-icon weapon-icon-placeholder" aria-hidden="true">
            {meta.type[0]}
          </div>
        )}
        <WeaponSelector weapons={weapons} selectedId={selectedId} onSelect={onSelectWeapon} />
        {data && (
          <button
            type="button"
            className="weapon-info-toggle"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((open) => !open)}
          >
            {infoOpen ? "▾" : "▸"} Weapon info
          </button>
        )}
      </div>

      {data && infoOpen && (
        <table className="base-stats">
          <tbody>
            {Object.entries(data.stats).map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <>
          <div className="n-control">
            <input
              id="n-slider"
              aria-label="Level-up points spent"
              type="range"
              min={0}
              max={maxN}
              value={n}
              onChange={(e) => onChangeN(Number(e.target.value))}
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
                <th scope="col">DPS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {Object.entries(entry.totals).map(([key, value]) => (
                  <td key={key}>{formatWeaponTotal(key, value, damageStat)}</td>
                ))}
                <td className="value-cell">{entry.dps.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
