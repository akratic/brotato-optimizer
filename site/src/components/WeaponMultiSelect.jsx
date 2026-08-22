import { useState } from "react";

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

export default function WeaponMultiSelect({ weapons, selectedIds, onChange }) {
  const [filter, setFilter] = useState("");

  const byId = Object.fromEntries(weapons.map((w) => [w.id, w]));
  const selected = selectedIds.map((id) => byId[id]).filter(Boolean).sort(byName);

  const filtered = weapons.filter((w) => w.name.toLowerCase().includes(filter.trim().toLowerCase())).sort(byName);

  function toggle(id) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  return (
    <div className="weapon-multiselect">
      {selected.length > 0 ? (
        <div className="weapon-multiselect-chips">
          {selected.map((w) => (
            <span key={w.id} className="weapon-multiselect-chip">
              {w.name}
              <button type="button" aria-label={`Remove ${w.name}`} onClick={() => remove(w.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="weapon-multiselect-empty">No weapons selected.</p>
      )}

      <input
        type="text"
        className="weapon-multiselect-filter"
        placeholder="Filter weapons…"
        aria-label="Filter weapons"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="weapon-multiselect-list" role="listbox" aria-label="Weapons" aria-multiselectable="true">
        {filtered.map((w) => (
          <label key={w.id} className={`weapon-multiselect-option${w.supported ? "" : " disabled"}`}>
            <input
              type="checkbox"
              checked={selectedIds.includes(w.id)}
              disabled={!w.supported}
              title={w.reason || undefined}
              onChange={() => toggle(w.id)}
            />
            {w.name}
            {w.supported ? "" : ` — not supported (${w.reason})`}
          </label>
        ))}
      </div>
    </div>
  );
}
