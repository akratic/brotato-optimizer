import AllWeaponsChart from "./AllWeaponsChart.jsx";
import DodgeArmorChart from "./DodgeArmorChart.jsx";

export default function About({ dataBase }) {
  return (
    <section className="about-view">
      <div className="weapon-header">
        <img className="weapon-icon" src={`${import.meta.env.BASE_URL}icons/items/focus_icon.png`} alt="" />
        <h2>About</h2>
        <p className="ehp-explainer">
          Calculations based on the excellent{" "}
          <a
            href="https://docs.google.com/spreadsheets/d/1qi_KWBH_fQlrXJioDGJQScuRbwfndHzLu4Zj5Ek0Aso/edit?gid=1643867668#gid=1643867668"
            target="_blank"
            rel="noopener noreferrer"
          >
            ArosRising's Brotato MultiTool 1.4
          </a>
          .
        </p>
      </div>

      <p>
        Weapon icons from the{" "}
        <a href="https://mojimoon.github.io/brotato/" target="_blank" rel="noopener noreferrer">
          Brotato Codex
        </a>
        .
      </p>

      <p>
        Optimizer brute force tries all combinations of N grey level ups. In practice
        your items and luck will be different, but this still shows the ideal combination of
        stats for each weapon at each investment level.
      </p>

      <p>
        Found a bug or have a suggestion?{" "}
        <a href="https://github.com/akratic/brotato-optimizer/issues" target="_blank" rel="noopener noreferrer">
          Open an issue on GitHub
        </a>
        .
      </p>

      <h3 className="chart-title">DPS: All Weapons</h3>
      <AllWeaponsChart dataBase={dataBase} />

      <h3 className="chart-title">Dodge vs Armor Value</h3>
      <DodgeArmorChart dataBase={dataBase} />
      <p>
        How much one dodge level-up (+3% dodge) is worth relative to one armor level-up (+1
        armor), as a multiple, depending on how much dodge you already have. 1.0 means they're
        worth the same; above 1.0 dodge is the better pick, below 1.0 armor is.
      </p>
    </section>
  );
}
