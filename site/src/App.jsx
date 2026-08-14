import { useEffect, useState } from "react";
import WeaponStats from "./components/WeaponStats.jsx";
import DpsChart from "./components/DpsChart.jsx";
import CurveTable from "./components/CurveTable.jsx";
import EhpOptimizer from "./components/EhpOptimizer.jsx";
import About from "./components/About.jsx";
import { WEAPON_STAT_LABELS, formatWeaponTotal } from "./statLabels.js";
import { usePersistentState } from "./usePersistentState.js";

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

export default function App() {
  const [tab, setTab] = usePersistentState("tab", "weapon");
  const [weapons, setWeapons] = useState([]);
  const [selectedId, setSelectedId] = usePersistentState("selectedId", null);
  const [weaponData, setWeaponData] = useState(null);
  const [n, setN] = usePersistentState("n", null);
  const [maxN, setMaxN] = useState(10);

  useEffect(() => {
    fetch(`${DATA_BASE}/weapons.json`)
      .then((r) => r.json())
      .then((list) => {
        setWeapons(list);
        setSelectedId((prev) => {
          if (prev && list.some((w) => w.id === prev && w.supported)) return prev;
          const defaultWeapon = list.find((w) => w.id === "smg-1" && w.supported);
          const fallback = list.find((w) => w.supported);
          return (defaultWeapon ?? fallback)?.id ?? null;
        });
      });
  }, [setSelectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`${DATA_BASE}/weapons/${selectedId}.json`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWeaponData(data);
        const curveMax = data.curve[data.curve.length - 1].n;
        setMaxN(curveMax);
        setN((prev) => (prev == null ? curveMax : Math.min(prev, curveMax)));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedMeta = weapons.find((w) => w.id === selectedId);
  const readyData = weaponData && weaponData.id === selectedId ? weaponData : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Brotato Optimizer</h1>
        <nav className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "weapon"}
            className={tab === "weapon" ? "active" : ""}
            onClick={() => setTab("weapon")}
          >
            DPS
          </button>
          <button
            role="tab"
            aria-selected={tab === "ehp"}
            className={tab === "ehp" ? "active" : ""}
            onClick={() => setTab("ehp")}
          >
            eHP
          </button>
          <button
            role="tab"
            aria-selected={tab === "about"}
            className={tab === "about" ? "active" : ""}
            onClick={() => setTab("about")}
          >
            About
          </button>
        </nav>
      </header>

      {tab === "weapon" && (
        <main className="weapon-view">
          {selectedMeta && (
            <WeaponStats
              meta={selectedMeta}
              data={readyData}
              n={n}
              maxN={maxN}
              onChangeN={setN}
              weapons={weapons}
              selectedId={selectedId}
              onSelectWeapon={setSelectedId}
            />
          )}
          {readyData && selectedMeta && (
            <>
              <DpsChart curve={readyData.curve} yKey="dps" highlightX={n} />
              <CurveTable
                curve={readyData.curve}
                totalsLabels={WEAPON_STAT_LABELS}
                formatTotal={(key, value) => formatWeaponTotal(key, value, selectedMeta.damageStat)}
                valueLabel="DPS"
                valueKey="dps"
                highlightN={n}
              />
            </>
          )}
        </main>
      )}

      {tab === "ehp" && <EhpOptimizer dataBase={DATA_BASE} />}

      {tab === "about" && <About dataBase={DATA_BASE} />}
    </div>
  );
}
