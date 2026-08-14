import AllWeaponsChart from "./AllWeaponsChart.jsx";

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
        Optimizer simply brute forces trying all combinations of N grey level ups. In practice
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

      <AllWeaponsChart dataBase={dataBase} />
    </section>
  );
}
