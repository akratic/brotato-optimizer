import { useEffect, useRef } from "react";

export default function CurveTable({ curve, totalsLabels, formatTotal, valueLabel, valueKey, highlightN }) {
  const rowRefs = useRef({});

  useEffect(() => {
    const el = rowRefs.current[highlightN];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightN]);

  const totalsKeys = Object.keys(curve[0].totals);

  return (
    <div className="curve-table-wrap">
      <table className="curve-table">
        <thead>
          <tr>
            <th scope="col">N</th>
            {totalsKeys.map((key) => (
              <th key={key} scope="col">
                {totalsLabels[key] ?? key}
              </th>
            ))}
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {curve.map((row) => (
            <tr
              key={row.n}
              ref={(el) => {
                rowRefs.current[row.n] = el;
              }}
              className={row.n === highlightN ? "curve-row-active" : undefined}
            >
              <td>{row.n}</td>
              {totalsKeys.map((key) => (
                <td key={key}>{formatTotal(key, row.totals[key])}</td>
              ))}
              <td className="value-cell">{row[valueKey].toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
