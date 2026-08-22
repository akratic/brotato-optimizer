#!/usr/bin/env python3
"""
Build the static JSON data + icons consumed by the site/ React app.

Runs the DPS optimizer (dps_optimizer.py) for every weapon it can support,
for level-up totals N=0..N_MAX, plus the eHP optimizer (ehp_optimizer.py)
once. Usage:

    python3 build_site_data.py --n 10     # fast, for local dev
    python3 build_site_data.py --n 100    # full production dataset
"""
import argparse
import csv
import json
import os
import re
import shutil
import sys
from multiprocessing import Pool

from dps_optimizer import best_split as dps_best_split
from dps_optimizer import classify_weapon, resolve_icon
from dps_optimizer import DAMAGE_STAT_PER_LEVEL, DMG_PCT_PER_LEVEL, ATK_SPD_PER_LEVEL, CRIT_CHANCE_PER_LEVEL
from ehp_optimizer import best_split as ehp_best_split
from ehp_optimizer import dodge_armor_coefficient_curve

# Line-buffer stdout even when it's not a TTY (e.g. piped into a CI log), so
# progress prints show up immediately instead of sitting in Python's default
# full-buffering mode until the process exits.
sys.stdout.reconfigure(line_buffering=True)

# Non-weapon icons used by the site's UI chrome (About/eHP page headers),
# copied from the same source icons/ tree as weapon icons - not tied to any
# specific weapon, so build_index_and_jobs never sees them.
EXTRA_ICONS = {
    "icons/items/all/medikit/medikit_icon.png": "items/medikit_icon.png",
    "icons/items/all/focus/focus_icon.png": "items/focus_icon.png",
    "icons/items/all/improved_tools/improved_tools_icon.png": "items/improved_tools_icon.png",
}

DISPLAY_FIELDS = [
    "Weapon Type",
    "Attack Type",
    "Base Dmg",
    "Cooldown Stat",
    "Base Range",
    "Recoil Duration",
    "Base Crit Chance",
    "Crit Multiplier",
    "Amount of Projectiles",
    "Bounces",
    "Amount of Pierces",
    "Base Price",
    "Weapon Note",
]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")


def compute_weapon_curve(job):
    weapon_id, row, damage_stat, n_max = job
    curve = []
    for n in range(0, n_max + 1):
        dps, a, b, c, d = dps_best_split(row, damage_stat, n)
        curve.append({
            "n": n,
            "levels": {damage_stat: a, "dmgPct": b, "atkSpd": c, "crit": d},
            "totals": {
                damage_stat: DAMAGE_STAT_PER_LEVEL[damage_stat] * a,
                "dmgPct": round(100 * DMG_PCT_PER_LEVEL * b, 2),
                "atkSpd": round(100 * ATK_SPD_PER_LEVEL * c, 2),
                "crit": round(100 * CRIT_CHANCE_PER_LEVEL * d, 2),
            },
            "dps": round(dps, 4),
        })
    return weapon_id, curve


def load_rows(csv_path):
    with open(csv_path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_index_and_jobs(rows, n_max, icons_dir, only_filters=None):
    index = []
    jobs = []
    seen_ids = {}

    for row in rows:
        name = row["Weapon"].strip()
        if not name:
            continue
        weapon_type = row["Weapon Type"]
        if weapon_type not in ("Ranged", "Melee"):
            continue  # section-header junk rows ("DLC Weapons", "EE Weapons")

        weapon_id = slugify(name)
        if weapon_id in seen_ids:
            raise ValueError(f"duplicate weapon id {weapon_id!r}: {name!r} and {seen_ids[weapon_id]!r}")
        seen_ids[weapon_id] = name

        supported, damage_stat, reason = classify_weapon(row)

        icon_src = resolve_icon(name, weapon_type)
        icon_out = None
        if icon_src:
            type_dir = "melee" if weapon_type == "Melee" else "ranged"
            filename = os.path.basename(icon_src)
            dest_dir = os.path.join(icons_dir, type_dir)
            os.makedirs(dest_dir, exist_ok=True)
            shutil.copyfile(icon_src, os.path.join(dest_dir, filename))
            icon_out = f"icons/{type_dir}/{filename}"
        else:
            print(f"warning: no icon found for {name!r}")

        index.append({
            "id": weapon_id,
            "name": name,
            "type": weapon_type,
            "damageStat": damage_stat,
            "supported": supported,
            "reason": reason,
            "icon": icon_out,
        })

        if supported and (not only_filters or any(f in name.lower() for f in only_filters)):
            jobs.append((weapon_id, row, damage_stat, n_max))

    return index, jobs


def write_weapon_files(jobs, results, weapons_dir):
    row_by_id = {weapon_id: row for weapon_id, row, _, _ in jobs}
    for weapon_id, curve in results:
        row = row_by_id[weapon_id]
        stats = {field: row[field] for field in DISPLAY_FIELDS if row.get(field)}
        payload = {
            "id": weapon_id,
            "name": row["Weapon"].strip(),
            "stats": stats,
            "curve": curve,
        }
        with open(os.path.join(weapons_dir, f"{weapon_id}.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f)


def build_dps_summary(index, weapons_dir):
    """
    Compact per-weapon DPS-vs-N series for the all-weapons comparison chart:
    just [dps at n=0, dps at n=1, ...] per weapon - no levels/totals detail.

    Reads back the individual weapon JSON files already on disk (rather than
    from this run's in-memory `results`) so the summary stays complete even
    after a targeted `--only` rebuild that only touched a few weapons - it
    picks up everyone else's most recent build. Note this means weapons
    rebuilt with a different --n than the rest of the set will have a
    differently-sized `dps` array; the chart handles that per-weapon rather
    than assuming a uniform length.
    """
    summary = []
    for w in index:
        if not w["supported"]:
            continue
        path = os.path.join(weapons_dir, f"{w['id']}.json")
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        summary.append({
            "id": w["id"],
            "name": w["name"],
            "dps": [c["dps"] for c in data["curve"]],
        })
    return summary


def build_ehp_curve(n_max):
    curve = []
    for n in range(0, n_max + 1):
        value, a, b, c = ehp_best_split(n)
        curve.append({
            "n": n,
            "levels": {"hp": a, "armor": b, "dodge": c},
            "totals": {"hp": 10 + 3 * a, "armor": b, "dodge": 3 * c},
            "ehp": round(value, 4),
        })
    return curve


DODGE_CAP_SERIES = [
    {"key": "normal", "label": "Normal (60% cap)", "cap": 60},
    {"key": "ghostOutfit", "label": "Ghost Outfit (70% cap)", "cap": 70},
    {"key": "ghost", "label": "Ghost (90% cap)", "cap": 90},
]


def build_dodge_armor_curve():
    series_curves = {s["key"]: dodge_armor_coefficient_curve(cap=s["cap"]) for s in DODGE_CAP_SERIES}
    dodges = [row["dodge"] for row in series_curves["normal"]]
    curve = []
    for i, dodge in enumerate(dodges):
        row = {"dodge": dodge}
        for s in DODGE_CAP_SERIES:
            row[s["key"]] = round(series_curves[s["key"]][i]["m"], 4)
        curve.append(row)
    return curve


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=10, help="max level-up total N; curves are computed for 0..N (default: 10)")
    parser.add_argument("--out", default="site/public", help="output root for data/ and icons/ (default: site/public)")
    parser.add_argument("--csv", default="weapons.csv", help="input weapons CSV (default: weapons.csv)")
    parser.add_argument(
        "--only",
        default=None,
        help="comma-separated substrings (case-insensitive); only compute curves for weapons whose "
             "name contains one of them. weapons.json's index is still written in full. For fast "
             "targeted reruns, e.g. --only 'revolver,chain gun'",
    )
    args = parser.parse_args()
    only_filters = [f.strip().lower() for f in args.only.split(",")] if args.only else None

    data_dir = os.path.join(args.out, "data")
    weapons_dir = os.path.join(data_dir, "weapons")
    icons_dir = os.path.join(args.out, "icons")
    os.makedirs(weapons_dir, exist_ok=True)
    os.makedirs(icons_dir, exist_ok=True)

    for src, dest in EXTRA_ICONS.items():
        dest_path = os.path.join(icons_dir, dest)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        if os.path.isfile(src):
            shutil.copyfile(src, dest_path)
        else:
            print(f"warning: extra icon source not found: {src!r}")

    rows = load_rows(args.csv)
    index, jobs = build_index_and_jobs(rows, args.n, icons_dir, only_filters)

    name_by_id = {weapon_id: row["Weapon"].strip() for weapon_id, row, _, _ in jobs}

    print(f"Computing DPS curves for {len(jobs)} supported weapons at N=0..{args.n}...")
    with Pool() as pool:
        results = []
        for i, result in enumerate(pool.imap_unordered(compute_weapon_curve, jobs), 1):
            results.append(result)
            weapon_id = result[0]
            print(f"  {i}/{len(jobs)} {name_by_id[weapon_id]} finished N=0..{args.n}")

    write_weapon_files(jobs, results, weapons_dir)

    with open(os.path.join(data_dir, "weapons.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)

    dps_summary = build_dps_summary(index, weapons_dir)
    with open(os.path.join(data_dir, "dps-summary.json"), "w", encoding="utf-8") as f:
        json.dump(dps_summary, f)

    ehp_curve = build_ehp_curve(args.n)
    with open(os.path.join(data_dir, "ehp.json"), "w", encoding="utf-8") as f:
        json.dump({"curve": ehp_curve}, f, indent=2)

    dodge_armor_curve = build_dodge_armor_curve()
    dodge_armor_series = [{"key": s["key"], "label": s["label"]} for s in DODGE_CAP_SERIES]
    with open(os.path.join(data_dir, "dodge-armor-coefficient.json"), "w", encoding="utf-8") as f:
        json.dump({"series": dodge_armor_series, "curve": dodge_armor_curve}, f, indent=2)

    supported_count = sum(1 for w in index if w["supported"])
    print(f"Wrote {len(index)} weapons ({supported_count} supported) at N=0..{args.n} to {data_dir}")


if __name__ == "__main__":
    main()
