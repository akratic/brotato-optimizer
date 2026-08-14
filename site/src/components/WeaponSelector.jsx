function byName(a, b) {
  return a.name.localeCompare(b.name);
}

export default function WeaponSelector({ weapons, selectedId, onSelect }) {
  const sorted = [...weapons].sort(byName);

  return (
    <select
      aria-label="Weapon"
      className="weapon-selector"
      value={selectedId || ""}
      onChange={(e) => onSelect(e.target.value)}
    >
      {sorted.map((w) => (
        <option key={w.id} value={w.id} disabled={!w.supported} title={w.reason || undefined}>
          {w.name}
          {w.supported ? "" : ` — not supported (${w.reason})`}
        </option>
      ))}
    </select>
  );
}
