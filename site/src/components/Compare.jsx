import { useEffect, useState } from "react";
import WeaponMultiSelect from "./WeaponMultiSelect.jsx";
import CompareChart from "./CompareChart.jsx";
import { usePersistentState } from "../usePersistentState.js";

const DEFAULT_SELECTED = ["smg-3", "smg-4", "double-barrel-shotgun-3", "double-barrel-shotgun-4"];

export default function Compare({ dataBase }) {
  const [weapons, setWeapons] = useState(null);
  const [selectedIds, setSelectedIds] = usePersistentState("compareSelected", DEFAULT_SELECTED);
  const [n, setN] = usePersistentState("compareN", 100);

  useEffect(() => {
    fetch(`${dataBase}/weapons.json`)
      .then((r) => r.json())
      .then(setWeapons);
  }, [dataBase]);

  return (
    <section className="compare-view">
      <div className="weapon-header">
        <img className="weapon-icon" src={`${import.meta.env.BASE_URL}icons/items/improved_tools_icon.png`} alt="" />
        <h2>Compare</h2>
        <p className="ehp-explainer">
          Compare DPS across any set of weapons as investment (N) grows. N = {n}
        </p>
      </div>

      {weapons ? (
        <WeaponMultiSelect weapons={weapons} selectedIds={selectedIds} onChange={setSelectedIds} />
      ) : (
        <p className="loading">Loading weapons...</p>
      )}

      <div className="n-control">
        <input
          id="compare-n-slider"
          aria-label="Level-up points spent"
          type="range"
          min={0}
          max={100}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
      </div>

      <CompareChart dataBase={dataBase} selectedIds={selectedIds} pinnedN={n} />
    </section>
  );
}
